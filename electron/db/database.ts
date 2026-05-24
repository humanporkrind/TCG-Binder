import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, copyFileSync, existsSync } from 'fs'
import { SEED_CARDS } from './seed-cards'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  mkdirSync(join(userDataPath, 'images'), { recursive: true })

  const dbPath = join(userDataPath, 'tcg-binder.db')

  // Backup before any destructive migration
  if (existsSync(dbPath)) {
    const backupPath = join(userDataPath, 'tcg-binder.backup.db')
    try { copyFileSync(dbPath, backupPath) } catch { /* non-fatal */ }
  }

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
  seedBinderIfEmpty()
}

function hasColumn(table: string, col: string): boolean {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return info.some((c) => c.name === col)
}

function tableExists(name: string): boolean {
  return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name)
}

function runMigrations(): void {
  // Detect old (pre-binder) schema and migrate if needed
  if (tableExists('cards') && !hasColumn('cards', 'binder_id')) {
    migrateV1toV2()
  }

  // ── Binders ──────────────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS binders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      pokemon     TEXT    NOT NULL DEFAULT '',
      cover_image TEXT,
      grid_cols   INTEGER NOT NULL DEFAULT 3,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  if (!hasColumn('binders', 'grid_cols')) {
    db.prepare(`ALTER TABLE binders ADD COLUMN grid_cols INTEGER NOT NULL DEFAULT 3`).run()
  }

  // ── Cards ─────────────────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS cards (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      binder_id    INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      set_name     TEXT    NOT NULL DEFAULT '',
      card_number  TEXT    NOT NULL DEFAULT '',
      rarity       TEXT    NOT NULL DEFAULT '',
      release_year INTEGER NOT NULL DEFAULT 0,
      price_eur    REAL,
      image_path   TEXT,
      country      TEXT    NOT NULL DEFAULT '',
      notes        TEXT    NOT NULL DEFAULT '',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  if (!hasColumn('cards', 'country')) {
    db.prepare(`ALTER TABLE cards ADD COLUMN country TEXT NOT NULL DEFAULT ''`).run()
  }

  // ── Owned cards ───────────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS owned_cards (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id        INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      binder_id      INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
      condition      TEXT NOT NULL DEFAULT 'NM',
      purchase_date  TEXT,
      purchase_price REAL,
      notes          TEXT NOT NULL DEFAULT '',
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(card_id, binder_id)
    )
  `).run()

  // ── Sets ──────────────────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      binder_id  INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      year       INTEGER,
      card_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(binder_id, name)
    )
  `).run()

  // ── Card prices (cached from Pokémon TCG API) ──────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS card_prices (
      card_id    INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
      tcg_price  REAL,
      tcg_url    TEXT,
      cm_price   REAL,
      cm_url     TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_cards_binder ON cards(binder_id)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_cards_set    ON cards(binder_id, set_name)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_cards_year   ON cards(release_year)`).run()
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_owned_binder ON owned_cards(binder_id)`).run()
}

function migrateV1toV2(): void {
  db.pragma('foreign_keys = OFF')

  db.transaction(() => {
    // ── Rename old tables ───────────────────────────────────────────────────
    db.prepare(`ALTER TABLE cards RENAME TO _cards_v1`).run()
    if (tableExists('owned_cards')) db.prepare(`ALTER TABLE owned_cards RENAME TO _owned_v1`).run()
    if (tableExists('sets'))        db.prepare(`ALTER TABLE sets RENAME TO _sets_v1`).run()

    // ── Create binders ──────────────────────────────────────────────────────
    db.prepare(`
      CREATE TABLE IF NOT EXISTS binders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT    NOT NULL DEFAULT '',
        pokemon     TEXT    NOT NULL DEFAULT '',
        cover_image TEXT,
        grid_cols   INTEGER NOT NULL DEFAULT 3,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run()

    const binderId = db.prepare(`
      INSERT INTO binders (name, description, pokemon)
      VALUES ('My Binder', '', '')
    `).run().lastInsertRowid

    // ── Recreate cards with binder_id ───────────────────────────────────────
    db.prepare(`
      CREATE TABLE cards (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        binder_id    INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
        name         TEXT    NOT NULL,
        set_name     TEXT    NOT NULL DEFAULT '',
        card_number  TEXT    NOT NULL DEFAULT '',
        rarity       TEXT    NOT NULL DEFAULT '',
        release_year INTEGER NOT NULL DEFAULT 0,
        price_eur    REAL,
        image_path   TEXT,
        country      TEXT    NOT NULL DEFAULT '',
        notes        TEXT    NOT NULL DEFAULT '',
        created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run()

    const v1CardCols = (db.prepare(`PRAGMA table_info(_cards_v1)`).all() as { name: string }[]).map(c => c.name)
    const hasCols = (cols: string[]) => cols.every(c => v1CardCols.includes(c))
    const imageCol = v1CardCols.includes('image_path') ? 'image_path' : 'NULL'
    const notesCol = v1CardCols.includes('notes') ? 'notes' : "''"
    const createdCol = v1CardCols.includes('created_at') ? 'created_at' : "datetime('now')"

    db.prepare(`
      INSERT INTO cards (id, binder_id, name, set_name, card_number, rarity, release_year, price_eur, image_path, country, notes, created_at)
      SELECT rowid, ${binderId}, name,
             ${hasCols(['set_name']) ? 'set_name' : "''"},
             ${hasCols(['card_number']) ? 'card_number' : "''"},
             ${hasCols(['rarity']) ? 'rarity' : "''"},
             ${hasCols(['release_year']) ? 'release_year' : '0'},
             ${hasCols(['price_eur']) ? 'price_eur' : 'NULL'},
             ${imageCol}, '', ${notesCol}, ${createdCol}
      FROM _cards_v1
    `).run()

    // ── Recreate owned_cards with binder_id ─────────────────────────────────
    db.prepare(`
      CREATE TABLE owned_cards (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id        INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        binder_id      INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
        condition      TEXT NOT NULL DEFAULT 'NM',
        purchase_date  TEXT,
        purchase_price REAL,
        notes          TEXT NOT NULL DEFAULT '',
        updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(card_id, binder_id)
      )
    `).run()

    if (tableExists('_owned_v1')) {
      db.prepare(`
        INSERT INTO owned_cards (id, card_id, binder_id, condition, purchase_date, purchase_price, notes, updated_at)
        SELECT rowid, card_id, ${binderId}, condition, purchase_date, purchase_price, notes, updated_at
        FROM _owned_v1
      `).run()
    }

    // ── Recreate sets with binder_id ────────────────────────────────────────
    db.prepare(`
      CREATE TABLE sets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        binder_id  INTEGER NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        year       INTEGER,
        card_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(binder_id, name)
      )
    `).run()

    if (tableExists('_sets_v1')) {
      db.prepare(`
        INSERT INTO sets (id, binder_id, name, year, card_count)
        SELECT rowid, ${binderId}, name, year, card_count FROM _sets_v1
      `).run()
    }

    // ── Drop old tables ─────────────────────────────────────────────────────
    db.prepare(`DROP TABLE _cards_v1`).run()
    if (tableExists('_owned_v1')) db.prepare(`DROP TABLE _owned_v1`).run()
    if (tableExists('_sets_v1'))  db.prepare(`DROP TABLE _sets_v1`).run()
  })()

  db.pragma('foreign_keys = ON')
}

function seedBinderIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) as n FROM binders').get() as { n: number }
  if (row.n > 0) return

  // Create the default Pikachu binder
  const binderId = db.prepare(`
    INSERT INTO binders (name, description, pokemon)
    VALUES ('Pikachu Binder', 'Complete Pikachu TCG collection — 570 cards', 'Pikachu')
  `).run().lastInsertRowid

  const insert = db.prepare(`
    INSERT OR IGNORE INTO cards (binder_id, name, set_name, card_number, rarity, release_year, price_eur)
    VALUES (@binder_id, @name, @set_name, @card_number, @rarity, @release_year, @price_eur)
  `)

  const insertMany = db.transaction(() => {
    for (const card of SEED_CARDS) {
      insert.run({ ...card, binder_id: binderId, id: undefined })
    }
  })
  insertMany()

  db.prepare(`
    INSERT OR IGNORE INTO sets (binder_id, name, year, card_count)
    SELECT binder_id, set_name, release_year, COUNT(*)
    FROM cards WHERE binder_id = ?
    GROUP BY set_name, release_year
  `).run(binderId)
}
