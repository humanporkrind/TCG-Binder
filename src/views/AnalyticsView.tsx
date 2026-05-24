import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import styles from './AnalyticsView.module.css'

export default function AnalyticsView(): JSX.Element {
  const { cards, owned } = useStore()

  const stats = useMemo(() => {
    const ownedIds = new Set(Object.keys(owned).map(Number))
    const totalValue = cards.reduce((s, c) => s + (c.price_eur ?? 0), 0)
    const ownedValue = cards
      .filter((c) => ownedIds.has(c.id))
      .reduce((s, c) => s + (c.price_eur ?? 0), 0)

    // By year
    const byYear: Record<number, { total: number; owned: number; value: number }> = {}
    for (const c of cards) {
      const y = c.release_year
      if (!byYear[y]) byYear[y] = { total: 0, owned: 0, value: 0 }
      byYear[y].total++
      if (ownedIds.has(c.id)) { byYear[y].owned++; byYear[y].value += c.price_eur ?? 0 }
    }

    // By rarity
    const byRarity: Record<string, { total: number; owned: number }> = {}
    for (const c of cards) {
      const r = c.rarity || 'Unknown'
      if (!byRarity[r]) byRarity[r] = { total: 0, owned: 0 }
      byRarity[r].total++
      if (ownedIds.has(c.id)) byRarity[r].owned++
    }

    // Top valuable owned
    const topOwned = cards
      .filter((c) => ownedIds.has(c.id) && c.price_eur)
      .sort((a, b) => (b.price_eur ?? 0) - (a.price_eur ?? 0))
      .slice(0, 10)

    // Top valuable missing
    const topMissing = cards
      .filter((c) => !ownedIds.has(c.id) && c.price_eur)
      .sort((a, b) => (b.price_eur ?? 0) - (a.price_eur ?? 0))
      .slice(0, 10)

    return { ownedCount: ownedIds.size, totalValue, ownedValue, byYear, byRarity, topOwned, topMissing }
  }, [cards, owned])

  const years = Object.keys(stats.byYear).map(Number).sort()
  const maxPct = Math.max(...years.map((y) => stats.byYear[y].owned / stats.byYear[y].total * 100))

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <h1 className={styles.title}>Collection Analytics</h1>
      </div>

      <div className={styles.content}>
        {/* Summary cards */}
        <div className={styles.statGrid}>
          <StatCard label="Total Cards" value={String(cards.length)} />
          <StatCard label="Owned" value={`${stats.ownedCount} (${cards.length ? Math.round(stats.ownedCount / cards.length * 100) : 0}%)`} />
          <StatCard label="Missing" value={String(cards.length - stats.ownedCount)} />
          <StatCard label="Owned Value" value={`€${stats.ownedValue.toFixed(2)}`} />
          <StatCard label="Full Set Value" value={`€${stats.totalValue.toFixed(2)}`} />
          <StatCard label="Missing Value" value={`€${(stats.totalValue - stats.ownedValue).toFixed(2)}`} />
        </div>

        <div className={styles.grid2}>
          {/* By Year */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Completion by Year</h2>
            <div className={styles.barList}>
              {years.map((year) => {
                const { total, owned: o } = stats.byYear[year]
                const pct = Math.round(o / total * 100)
                return (
                  <div key={year} className={styles.barRow}>
                    <span className={styles.barLabel}>{year}</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.barVal}>{o}/{total} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Rarity */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>By Rarity</h2>
            <table className={styles.table}>
              <thead>
                <tr><th>Rarity</th><th>Total</th><th>Owned</th><th>%</th></tr>
              </thead>
              <tbody>
                {Object.entries(stats.byRarity)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([rarity, { total, owned: o }]) => (
                    <tr key={rarity}>
                      <td>{rarity}</td>
                      <td>{total}</td>
                      <td>{o}</td>
                      <td>{Math.round(o / total * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.grid2}>
          {/* Top owned by value */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Most Valuable Owned</h2>
            <table className={styles.table}>
              <thead><tr><th>Card</th><th>Set</th><th>Price</th></tr></thead>
              <tbody>
                {stats.topOwned.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className={styles.dimCell}>{c.set_name}</td>
                    <td className={styles.priceCell}>€{c.price_eur!.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top missing by value */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Most Valuable Missing</h2>
            <table className={styles.table}>
              <thead><tr><th>Card</th><th>Set</th><th>Price</th></tr></thead>
              <tbody>
                {stats.topMissing.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className={styles.dimCell}>{c.set_name}</td>
                    <td className={styles.priceCell}>€{c.price_eur!.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '.7rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--gold)' }}>{value}</div>
    </div>
  )
}
