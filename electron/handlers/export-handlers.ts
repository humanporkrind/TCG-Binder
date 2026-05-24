import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { getDb } from '../db/database'

export function registerExportHandlers(): void {
  // ── Marketplace open ──────────────────────────────────────────────────────

  ipcMain.handle('cards:openMarketplace', (_e, cardId: number, marketplace: 'cardmarket' | 'tcgplayer') => {
    const card = getDb().prepare('SELECT set_name, card_number FROM cards WHERE id = ?').get(cardId) as
      | { set_name: string; card_number: string }
      | undefined
    if (!card) return false

    const cached = getDb().prepare(
      'SELECT tcg_url, cm_url FROM card_prices WHERE card_id = ?'
    ).get(cardId) as { tcg_url: string | null; cm_url: string | null } | undefined

    if (marketplace === 'tcgplayer' && cached?.tcg_url) {
      shell.openExternal(cached.tcg_url)
      return true
    }
    if (marketplace === 'cardmarket' && cached?.cm_url) {
      shell.openExternal(cached.cm_url)
      return true
    }

    // Fallback: search URL
    const q = encodeURIComponent(`${card.card_number} ${card.set_name}`.trim())
    const fallback: Record<string, string> = {
      cardmarket: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${q}`,
      tcgplayer:  `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${q}`
    }
    shell.openExternal(fallback[marketplace] ?? fallback.cardmarket)
    return true
  })

  // ── Export owned JSON ──────────────────────────────────────────────────────

  ipcMain.handle('export:ownedJSON', async (_e, binderId: number) => {
    const owned = getDb().prepare('SELECT * FROM owned_cards WHERE binder_id = ?').all(binderId)
    const binder = getDb().prepare('SELECT name FROM binders WHERE id = ?').get(binderId) as { name: string } | undefined

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Owned Cards',
      defaultPath: `${binder?.name ?? 'binder'}-owned.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null

    const payload = JSON.stringify({ version: 3, exported: new Date().toISOString(), binderId, owned }, null, 2)
    writeFileSync(filePath, payload, 'utf8')
    return filePath
  })

  // ── Import owned JSON ──────────────────────────────────────────────────────

  ipcMain.handle('export:importOwnedJSON', async (_e, binderId: number) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import Owned Cards',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const raw = JSON.parse(readFileSync(filePaths[0], 'utf8'))
    const ownedList: Array<{ card_id: number; condition?: string }> = Array.isArray(raw.owned) ? raw.owned : []

    const upsert = getDb().prepare(`
      INSERT INTO owned_cards (card_id, binder_id, condition, updated_at)
      VALUES (@card_id, @binder_id, @condition, datetime('now'))
      ON CONFLICT(card_id, binder_id) DO UPDATE SET
        condition  = excluded.condition,
        updated_at = excluded.updated_at
    `)
    const importAll = getDb().transaction((rows: typeof ownedList) => {
      for (const row of rows) {
        upsert.run({ card_id: row.card_id, binder_id: binderId, condition: row.condition ?? 'NM' })
      }
    })
    importAll(ownedList)
    return ownedList.length
  })

  // ── Import a whole binder from JSON ───────────────────────────────────────

  ipcMain.handle('export:importBinder', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import Binder (JSON)',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const raw = JSON.parse(readFileSync(filePaths[0], 'utf8'))
    const binderData = raw.binder ?? {}
    const cards: Record<string, unknown>[] = raw.cards ?? []

    // Create the new binder
    const binderId = getDb().prepare(`
      INSERT INTO binders (name, description, pokemon, grid_cols)
      VALUES (@name, @description, @pokemon, @grid_cols)
    `).run({
      name: binderData.name ?? 'Imported Binder',
      description: binderData.description ?? '',
      pokemon: binderData.pokemon ?? '',
      grid_cols: binderData.grid_cols ?? 3
    }).lastInsertRowid

    // Insert cards
    const insert = getDb().prepare(`
      INSERT INTO cards (binder_id, name, set_name, card_number, rarity, release_year, price_eur)
      VALUES (@binder_id, @name, @set_name, @card_number, @rarity, @release_year, @price_eur)
    `)
    const insertAll = getDb().transaction(() => {
      for (const card of cards) {
        insert.run({ ...card, binder_id: binderId })
      }
    })
    insertAll()

    // Refresh sets
    getDb().prepare(`
      INSERT OR IGNORE INTO sets (binder_id, name, year, card_count)
      SELECT binder_id, set_name, release_year, COUNT(*)
      FROM cards WHERE binder_id = ?
      GROUP BY set_name, release_year
    `).run(binderId)

    return { binderId, name: binderData.name ?? 'Imported Binder', count: cards.length }
  })

  // ── Import a new set from CSV into an existing binder ─────────────────────

  ipcMain.handle('export:importSetCSV', async (_e, binderId: number) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Import Set (CSV)',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    const csv = readFileSync(filePaths[0], 'utf8')
    const lines = csv.trim().split('\n')
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

    const cards = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })

      const priceRaw = obj.price_eur ?? obj.price ?? ''
      const priceMatch = priceRaw.match(/([\d.]+)/)

      return {
        name: obj.name ?? '',
        set_name: obj.set_name ?? obj.set ?? '',
        card_number: obj.card_number ?? obj.card_no ?? '',
        rarity: obj.rarity ?? '',
        release_year: parseInt(obj.year ?? obj.release_year ?? '0') || 0,
        price_eur: priceMatch ? parseFloat(priceMatch[1]) : null
      }
    })

    const insert = getDb().prepare(`
      INSERT INTO cards (binder_id, name, set_name, card_number, rarity, release_year, price_eur)
      VALUES (@binder_id, @name, @set_name, @card_number, @rarity, @release_year, @price_eur)
    `)
    const insertMany = getDb().transaction(() => {
      for (const card of cards) insert.run({ ...card, binder_id: binderId })
    })
    insertMany()

    getDb().prepare(`
      INSERT OR REPLACE INTO sets (binder_id, name, year, card_count)
      SELECT binder_id, set_name, release_year, COUNT(*)
      FROM cards WHERE binder_id = ?
      GROUP BY set_name, release_year
    `).run(binderId)

    return cards.length
  })

  // ── Export binder as JSON (shareable) ─────────────────────────────────────

  ipcMain.handle('export:exportBinder', async (_e, binderId: number) => {
    const binder = getDb().prepare('SELECT * FROM binders WHERE id = ?').get(binderId) as Record<string, unknown>
    const cards = getDb().prepare('SELECT * FROM cards WHERE binder_id = ?').all(binderId)

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Binder',
      defaultPath: `${String(binder?.name ?? 'binder').toLowerCase().replace(/\s+/g, '-')}.binder.json`,
      filters: [{ name: 'Binder JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null

    writeFileSync(filePath, JSON.stringify({ binder, cards }, null, 2), 'utf8')
    return filePath
  })

  // ── Export CSV ─────────────────────────────────────────────────────────────

  ipcMain.handle('export:exportCSV', async (_e, binderId: number, options: { filter?: string }) => {
    const filter = options?.filter ?? 'all'

    let query = `SELECT c.*, o.condition, o.purchase_price, o.purchase_date
                 FROM cards c LEFT JOIN owned_cards o ON c.id = o.card_id AND o.binder_id = c.binder_id
                 WHERE c.binder_id = ${binderId}`
    if (filter === 'owned')   query += ' AND o.card_id IS NOT NULL'
    if (filter === 'missing') query += ' AND o.card_id IS NULL'
    query += ' ORDER BY c.release_year, c.id'

    const rows = getDb().prepare(query).all() as Record<string, unknown>[]
    const headers = ['ID','Name','Set','Card No','Rarity','Year','Price (EUR)','Owned','Condition','Purchase Price','Purchase Date']
    const csvRows = rows.map((r) => [
      r.id, r.name, r.set_name, r.card_number, r.rarity, r.release_year,
      r.price_eur ?? '', r.condition ? 'Yes' : 'No', r.condition ?? '',
      r.purchase_price ?? '', r.purchase_date ?? ''
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))

    const csv = [headers.join(','), ...csvRows].join('\n')

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Card List',
      defaultPath: `binder-${filter}-${new Date().toISOString().slice(0,10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, csv, 'utf8')
    return filePath
  })

  // ── Print ──────────────────────────────────────────────────────────────────

  ipcMain.handle('export:printCardList', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    win.webContents.print({ silent: false, printBackground: true })
    return true
  })
}
