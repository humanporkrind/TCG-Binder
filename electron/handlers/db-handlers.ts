import { ipcMain } from 'electron'
import { getDb } from '../db/database'

export function registerDbHandlers(): void {
  const db = () => getDb()

  // ── Binders ────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getAllBinders', () => {
    return db().prepare('SELECT * FROM binders ORDER BY created_at').all()
  })

  ipcMain.handle('db:createBinder', (_e, data: Record<string, unknown>) => {
    const result = db().prepare(`
      INSERT INTO binders (name, description, pokemon, grid_cols)
      VALUES (@name, @description, @pokemon, @grid_cols)
    `).run({
      name: data.name ?? 'New Binder',
      description: data.description ?? '',
      pokemon: data.pokemon ?? '',
      grid_cols: data.grid_cols ?? 3
    })
    return result.lastInsertRowid
  })

  ipcMain.handle('db:updateBinder', (_e, id: number, data: Record<string, unknown>) => {
    db().prepare(`
      UPDATE binders SET name = @name, description = @description, pokemon = @pokemon, grid_cols = @grid_cols WHERE id = @id
    `).run({ id, name: data.name, description: data.description ?? '', pokemon: data.pokemon ?? '', grid_cols: data.grid_cols ?? 3 })
    return true
  })

  ipcMain.handle('db:deleteBinder', (_e, id: number) => {
    db().prepare('DELETE FROM binders WHERE id = ?').run(id)
    return true
  })

  // ── Cards (binder-scoped) ──────────────────────────────────────────────────

  ipcMain.handle('db:getAllCards', (_e, binderId: number) => {
    return db().prepare('SELECT * FROM cards WHERE binder_id = ? ORDER BY release_year, id').all(binderId)
  })

  ipcMain.handle('db:getCard', (_e, id: number) => {
    return db().prepare('SELECT * FROM cards WHERE id = ?').get(id)
  })

  ipcMain.handle('db:addCard', (_e, card: Record<string, unknown>) => {
    const result = db().prepare(`
      INSERT INTO cards (binder_id, name, set_name, card_number, rarity, release_year, price_eur, notes)
      VALUES (@binder_id, @name, @set_name, @card_number, @rarity, @release_year, @price_eur, @notes)
    `).run({
      binder_id: card.binder_id,
      name: card.name ?? '',
      set_name: card.set_name ?? '',
      card_number: card.card_number ?? '',
      rarity: card.rarity ?? '',
      release_year: card.release_year ?? 0,
      price_eur: card.price_eur ?? null,
      notes: card.notes ?? ''
    })
    return result.lastInsertRowid
  })

  ipcMain.handle('db:updateCard', (_e, id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data)
      .filter((k) => !['id', 'binder_id', 'created_at'].includes(k))
      .map((k) => `${k} = @${k}`)
      .join(', ')
    if (!fields) return false
    db().prepare(`UPDATE cards SET ${fields} WHERE id = @id`).run({ ...data, id })
    return true
  })

  ipcMain.handle('db:deleteCard', (_e, id: number) => {
    db().prepare('DELETE FROM cards WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('db:importCards', (_e, binderId: number, cards: Record<string, unknown>[]) => {
    const insert = db().prepare(`
      INSERT OR IGNORE INTO cards (binder_id, name, set_name, card_number, rarity, release_year, price_eur)
      VALUES (@binder_id, @name, @set_name, @card_number, @rarity, @release_year, @price_eur)
    `)
    const insertMany = db().transaction((rows: Record<string, unknown>[]) => {
      let count = 0
      for (const row of rows) {
        const res = insert.run({ ...row, binder_id: binderId })
        count += res.changes
      }
      return count
    })
    const count = insertMany(cards)
    refreshSets(binderId)
    return count
  })

  // ── Owned (binder-scoped) ──────────────────────────────────────────────────

  ipcMain.handle('db:getAllOwned', (_e, binderId: number) => {
    return db().prepare('SELECT * FROM owned_cards WHERE binder_id = ?').all(binderId)
  })

  ipcMain.handle('db:setOwned', (_e, cardId: number, binderId: number, data: Record<string, unknown> | null) => {
    if (data === null) {
      db().prepare('DELETE FROM owned_cards WHERE card_id = ? AND binder_id = ?').run(cardId, binderId)
    } else {
      db().prepare(`
        INSERT INTO owned_cards (card_id, binder_id, condition, purchase_date, purchase_price, notes, updated_at)
        VALUES (@card_id, @binder_id, @condition, @purchase_date, @purchase_price, @notes, datetime('now'))
        ON CONFLICT(card_id, binder_id) DO UPDATE SET
          condition      = excluded.condition,
          purchase_date  = excluded.purchase_date,
          purchase_price = excluded.purchase_price,
          notes          = excluded.notes,
          updated_at     = excluded.updated_at
      `).run({
        card_id: cardId,
        binder_id: binderId,
        condition: data.condition ?? 'NM',
        purchase_date: data.purchase_date ?? null,
        purchase_price: data.purchase_price ?? null,
        notes: data.notes ?? ''
      })
    }
    return true
  })

  // ── Sets ───────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getAllSets', (_e, binderId: number) => {
    return db().prepare('SELECT * FROM sets WHERE binder_id = ? ORDER BY year, name').all(binderId)
  })
}

function refreshSets(binderId: number): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO sets (binder_id, name, year, card_count)
    SELECT binder_id, set_name, release_year, COUNT(*)
    FROM cards WHERE binder_id = ?
    GROUP BY set_name, release_year
  `).run(binderId)
}
