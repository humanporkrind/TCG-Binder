import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { Card, OwnedCard, CardSet } from '@/types'
import styles from './ImportExportView.module.css'

export default function ImportExportView(): JSX.Element {
  const { setCards, setOwned, setSets, activeBinder } = useStore()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (label: string, fn: () => Promise<string | number | null>): Promise<void> => {
    setBusy(true)
    setStatus('')
    try {
      const result = await fn()
      if (result !== null) setStatus(`✓ ${label}: ${result}`)
      else setStatus('Cancelled.')
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const reload = async (): Promise<void> => {
    if (!activeBinder) return
    const [cards, owned, sets] = await Promise.all([
      window.electronAPI.getAllCards(activeBinder.id) as Promise<Card[]>,
      window.electronAPI.getAllOwned(activeBinder.id) as Promise<OwnedCard[]>,
      window.electronAPI.getAllSets(activeBinder.id) as Promise<CardSet[]>
    ])
    setCards(cards)
    setOwned(owned)
    setSets(sets)
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h1 className={styles.title}>Import / Export</h1>
      </div>

      <div className={styles.content}>
        {/* Owned Cards */}
        <Section title="Owned Cards" desc="Save or restore which cards you own.">
          <ActionRow
            label="Export Owned (JSON)"
            desc="Save your owned list to a JSON file — useful for backups or sharing."
            btnLabel="Export JSON"
            busy={busy}
            onClick={() => run('Saved to', () => window.electronAPI.exportOwnedJSON(activeBinder?.id ?? 0) as Promise<string | null>)}
          />
          <ActionRow
            label="Import Owned (JSON)"
            desc="Load a previously exported JSON file to restore or merge your collection."
            btnLabel="Import JSON"
            busy={busy}
            onClick={async () => {
              await run('Imported cards', () => window.electronAPI.importOwnedJSON(activeBinder?.id ?? 0) as Promise<number | null>)
              await reload()
            }}
          />
        </Section>

        {/* New Sets */}
        <Section title="Import New Set (CSV)" desc="Add cards from a new Pokémon set. CSV must have columns: Name, Set, Card No., Rarity, Year, Price (EUR). You can create this in Excel or Google Sheets.">
          <ActionRow
            label="Import Set CSV"
            desc="Pick a CSV file to add cards. Existing cards (by ID) won't be duplicated."
            btnLabel="Choose CSV…"
            busy={busy}
            onClick={async () => {
              await run('Added cards', () => window.electronAPI.importSetCSV(activeBinder?.id ?? 0) as Promise<number | null>)
              await reload()
            }}
          />
        </Section>

        {/* Export Lists */}
        <Section title="Export for Printing" desc="Generate a printable card list for card shows or want lists.">
          <ActionRow
            label="All Cards (CSV)"
            desc="Export the full card list with owned status, condition, and prices."
            btnLabel="Export All"
            busy={busy}
            onClick={() => run('Saved to', () => window.electronAPI.exportCSV(activeBinder?.id ?? 0, { filter: 'all' }) as Promise<string | null>)}
          />
          <ActionRow
            label="Owned Cards (CSV)"
            desc="Export only your owned cards — useful for trading or sharing your collection."
            btnLabel="Export Owned"
            busy={busy}
            onClick={() => run('Saved to', () => window.electronAPI.exportCSV(activeBinder?.id ?? 0, { filter: 'owned' }) as Promise<string | null>)}
          />
          <ActionRow
            label="Missing Cards (CSV)"
            desc="Export your want list — cards you're still looking for."
            btnLabel="Export Missing"
            busy={busy}
            onClick={() => run('Saved to', () => window.electronAPI.exportCSV(activeBinder?.id ?? 0, { filter: 'missing' }) as Promise<string | null>)}
          />
          <ActionRow
            label="Print View"
            desc="Open the system print dialog to print your current binder view."
            btnLabel="Print…"
            busy={busy}
            onClick={() => run('Print dialog opened', async () => { await window.electronAPI.printCardList({ binderId: activeBinder?.id ?? 0 }); return 'done' })}
          />
        </Section>

        {status && (
          <div className={`${styles.status} ${status.startsWith('Error') ? styles.error : styles.ok}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <p className={styles.sectionDesc}>{desc}</p>
      <div className={styles.actions}>{children}</div>
    </div>
  )
}

function ActionRow({ label, desc, btnLabel, busy, onClick }: {
  label: string; desc: string; btnLabel: string; busy: boolean; onClick: () => void
}): JSX.Element {
  return (
    <div className={styles.actionRow}>
      <div className={styles.actionInfo}>
        <span className={styles.actionLabel}>{label}</span>
        <span className={styles.actionDesc}>{desc}</span>
      </div>
      <button className="btn-secondary" disabled={busy} onClick={onClick}>{btnLabel}</button>
    </div>
  )
}
