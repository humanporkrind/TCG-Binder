import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db/database'

type TCGCard = {
  id: string
  number: string
  images?: { small: string; large: string }
  tcgplayer?: {
    url: string
    prices?: Record<string, { market?: number | null; low?: number | null } | undefined>
  }
  cardmarket?: {
    url: string
    prices?: { averageSellPrice?: number | null; trendPrice?: number | null }
  }
}

type APISet = { id: string; name: string }

function send(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send(channel, data)
}

// Hard overrides for names that can't be derived by pattern
const SET_NAME_OVERRIDES: Record<string, string> = {
  'Base Set': 'Base',
  'Expedition': 'Expedition Base Set',
}

function resolveApiSetId(dbName: string, apiSets: APISet[]): string | null {
  const find = (name: string) => apiSets.find((s) => s.name === name)

  // Hardcoded overrides
  const override = SET_NAME_OVERRIDES[dbName]
  if (override) return find(override)?.id ?? null

  // Exact match
  const exact = find(dbName)
  if (exact) return exact.id

  // Strip "EX " prefix: "EX Sandstorm" → "Sandstorm"
  if (dbName.startsWith('EX ')) {
    const without = find(dbName.slice(3))
    if (without) return without.id
  }

  // "X Promo" → "X Black Star Promos"
  if (dbName.endsWith(' Promo')) {
    const expanded = find(dbName.slice(0, -6) + ' Black Star Promos')
    if (expanded) return expanded.id
  }

  // "HS—" prefix: "Undaunted" → "HS—Undaunted"
  const hs = find('HS—' + dbName)
  if (hs) return hs.id

  // McDonald's YEAR → McDonald's Collection YEAR
  const mcMatch = dbName.match(/^McDonald's (\d{4})$/)
  if (mcMatch) {
    const mc = find(`McDonald's Collection ${mcMatch[1]}`)
    if (mc) return mc.id
  }

  // Normalize & connectors: "HeartGold SoulSilver" ↔ "HeartGold & SoulSilver"
  const norm = (s: string) =>
    s.toLowerCase().replace(/ ?& ?/g, ' ').replace(/ +/g, ' ').trim()
  const normMatch = apiSets.find((s) => norm(s.name) === norm(dbName))
  if (normMatch) return normMatch.id

  return null
}

async function fetchAllApiSets(): Promise<APISet[]> {
  const res = await fetch(
    'https://api.pokemontcg.io/v2/sets?pageSize=250&select=id,name',
    { headers: { 'User-Agent': 'PikachuBinder/1.0' } }
  )
  if (!res.ok) return []
  const json = await res.json() as { data: APISet[] }
  return json.data ?? []
}

async function fetchSetCards(setId: string): Promise<TCGCard[]> {
  const all: TCGCard[] = []
  let page = 1

  while (true) {
    const q = encodeURIComponent(`set.id:${setId}`)
    const url =
      `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=250&page=${page}` +
      `&select=id,number,images,tcgplayer,cardmarket`

    const res = await fetch(url, { headers: { 'User-Agent': 'PikachuBinder/1.0' } })
    if (!res.ok) break

    const json = await res.json() as { data: TCGCard[]; totalCount: number }
    all.push(...(json.data ?? []))
    if (all.length >= json.totalCount || (json.data ?? []).length === 0) break
    page++
  }

  return all
}

export function registerPriceHandlers(): void {
  ipcMain.handle('prices:fetchAll', async (_e, binderId: number) => {
    const db = getDb()

    const sets = db.prepare(
      `SELECT DISTINCT set_name FROM cards WHERE binder_id = ? AND set_name != ''`
    ).all(binderId) as { set_name: string }[]

    // Fetch full API set list once for name → ID resolution
    const apiSets = await fetchAllApiSets()

    const total = sets.length
    let processed = 0

    const upsertPrice = db.prepare(`
      INSERT INTO card_prices (card_id, tcg_price, tcg_url, cm_price, cm_url, fetched_at)
      VALUES (@card_id, @tcg_price, @tcg_url, @cm_price, @cm_url, datetime('now'))
      ON CONFLICT(card_id) DO UPDATE SET
        tcg_price  = excluded.tcg_price,
        tcg_url    = excluded.tcg_url,
        cm_price   = excluded.cm_price,
        cm_url     = excluded.cm_url,
        fetched_at = excluded.fetched_at
    `)

    // Only set API image if no user-uploaded image (user images start with app://)
    const setImage = db.prepare(`
      UPDATE cards SET image_path = ?
      WHERE id = ? AND (image_path IS NULL OR image_path = '' OR image_path NOT LIKE 'app://%')
    `)

    for (const { set_name } of sets) {
      try {
        const setId = resolveApiSetId(set_name, apiSets)

        if (!setId) {
          // Japanese / promo / custom sets not in the API — skip silently
          processed++
          send('prices:progress', { processed, total, updated: 0, images: 0 })
          await new Promise((r) => setTimeout(r, 20))
          continue
        }

        const apiCards = await fetchSetCards(setId)
        const byNumber = new Map(apiCards.map((c) => [c.number, c]))

        const dbCards = db.prepare(
          `SELECT id, card_number FROM cards WHERE binder_id = ? AND set_name = ?`
        ).all(binderId, set_name) as { id: number; card_number: string }[]

        const priceUpdates: Array<{
          card_id: number
          tcg_price: number | null
          tcg_url: string | null
          cm_price: number | null
          cm_url: string | null
        }> = []
        const imageUpdates: Array<{ id: number; url: string }> = []

        for (const { id, card_number } of dbCards) {
          // DB stores "58/102"; API stores "58" — try exact first, then strip set-total
          const numKey = card_number.includes('/') ? card_number.split('/')[0] : card_number
          const api = byNumber.get(card_number) ?? byNumber.get(numKey)
          if (!api) continue

          const p = api.tcgplayer?.prices ?? {}
          const tcgMarket =
            p['holofoil']?.market ??
            p['normal']?.market ??
            p['reverseHolofoil']?.market ??
            null

          const cm = api.cardmarket?.prices
          const cmPrice = cm?.averageSellPrice ?? cm?.trendPrice ?? null

          priceUpdates.push({
            card_id: id,
            tcg_price: typeof tcgMarket === 'number' ? tcgMarket : null,
            tcg_url: api.tcgplayer?.url ?? null,
            cm_price: typeof cmPrice === 'number' ? cmPrice : null,
            cm_url: api.cardmarket?.url ?? null
          })

          if (api.images?.large) {
            imageUpdates.push({ id, url: api.images.large })
          }
        }

        if (priceUpdates.length > 0 || imageUpdates.length > 0) {
          db.transaction(() => {
            for (const u of priceUpdates) upsertPrice.run(u)
            for (const { id, url } of imageUpdates) setImage.run(url, id)
          })()
        }

        processed++
        send('prices:progress', {
          processed,
          total,
          updated: priceUpdates.length,
          images: imageUpdates.length
        })

        await new Promise((r) => setTimeout(r, 150))
      } catch {
        processed++
        send('prices:progress', { processed, total, updated: 0 })
      }
    }

    send('prices:done', { processed })
    return processed
  })

  ipcMain.handle('prices:getForBinder', (_e, binderId: number) => {
    return getDb().prepare(`
      SELECT cp.card_id, cp.tcg_price, cp.tcg_url, cp.cm_price, cp.cm_url, cp.fetched_at
      FROM card_prices cp
      JOIN cards c ON c.id = cp.card_id
      WHERE c.binder_id = ?
    `).all(binderId)
  })
}
