import { useState, type ReactNode } from 'react'
import { useStore } from '@/store/useStore'
import type { Binder, ViewMode } from '@/types'
import BinderPickerModal from '@/components/ui/BinderPickerModal'
import styles from './AppShell.module.css'

const NAV_ITEMS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'binder',        label: 'Binder',        icon: '📖' },
  { id: 'analytics',    label: 'Analytics',     icon: '📊' },
  { id: 'import-export',label: 'Import/Export', icon: '↕' }
]

interface Props {
  children: ReactNode
  onRefreshPrices?: () => void
}

export default function AppShell({ children, onRefreshPrices }: Props): JSX.Element {
  const { view, setView, cards, owned, activeBinder, binders, theme, toggleTheme, marketplace, setMarketplace, priceStatus, priceProgress } = useStore()
  const [showPicker, setShowPicker] = useState(false)

  const ownedCount = Object.keys(owned).length
  const totalValue = cards
    .filter((c) => owned[c.id])
    .reduce((sum, c) => sum + (c.price_eur ?? 0), 0)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.bolt}>⚡</span>
          <span>TCG<br />Binder</span>
        </div>

        {/* Binder switcher */}
        <button className={styles.binderBtn} onClick={() => setShowPicker(true)}>
          <span className={styles.binderName}>{activeBinder?.name ?? 'No binder'}</span>
          <span className={styles.binderChevron}>▾</span>
        </button>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`${styles.navBtn} ${view === item.id ? styles.active : ''}`}
              onClick={() => setView(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.prefs}>
          <div className={styles.prefRow}>
            <span className={styles.prefLabel}>Shop</span>
            <div className={styles.prefBtns}>
              {(['cardmarket', 'tcgplayer', 'both'] as const).map((m) => (
                <button
                  key={m}
                  className={`${styles.prefBtn} ${marketplace === m ? styles.prefBtnActive : ''}`}
                  onClick={() => setMarketplace(m)}
                  title={m === 'cardmarket' ? 'Cardmarket only' : m === 'tcgplayer' ? 'TCGPlayer only' : 'Show both'}
                >
                  {m === 'cardmarket' ? 'CM' : m === 'tcgplayer' ? 'TCG' : 'Both'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.prefRow}>
            <span className={styles.prefLabel}>Theme</span>
            <button className={styles.themeBtn} onClick={toggleTheme}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {priceStatus === 'fetching' && priceProgress ? (
          <div className={styles.priceBar}>
            <div
              className={styles.priceBarFill}
              style={{ width: `${Math.round(priceProgress.processed / Math.max(priceProgress.total, 1) * 100)}%` }}
            />
            <span className={styles.priceBarLabel}>
              Prices {priceProgress.processed}/{priceProgress.total}
            </span>
          </div>
        ) : (
          onRefreshPrices && (
            <button className={styles.refreshBtn} onClick={onRefreshPrices} title="Re-fetch prices and images from API">
              ↻ Refresh Prices
            </button>
          )
        )}

        <div className={styles.sideStats}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Owned</span>
            <span className={styles.statVal}>{ownedCount} / {cards.length}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Complete</span>
            <span className={styles.statVal}>
              {cards.length ? Math.round(ownedCount / cards.length * 100) : 0}%
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Value</span>
            <span className={styles.statVal}>€{totalValue.toFixed(2)}</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>

      {showPicker && <BinderPickerModal onClose={() => setShowPicker(false)} />}
    </div>
  )
}
