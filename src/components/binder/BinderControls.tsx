import { useStore } from '@/store/useStore'
import type { FilterMode } from '@/types'
import styles from './BinderControls.module.css'

interface Props {
  onAddCard: () => void
  totalShown: number
}

export default function BinderControls({ onAddCard, totalShown }: Props): JSX.Element {
  const { filterMode, setFilterMode, searchQuery, setSearchQuery, cards, owned, activeBinder } = useStore()

  const handleExportCSV = async (): Promise<void> => {
    await window.electronAPI.exportCSV(activeBinder?.id ?? 0, { filter: filterMode })
  }

  return (
    <div className={styles.controls}>
      <input
        type="text"
        className={styles.search}
        placeholder="Search cards…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <select
        value={filterMode}
        onChange={(e) => setFilterMode(e.target.value as FilterMode)}
      >
        <option value="all">All cards ({cards.length})</option>
        <option value="owned">Owned ({Object.keys(owned).length})</option>
        <option value="missing">Missing ({cards.length - Object.keys(owned).length})</option>
      </select>

      <button className="btn-primary" onClick={onAddCard}>+ Add Card</button>
      <button className="btn-secondary" onClick={handleExportCSV}>Export CSV</button>

      <span className={styles.count}>{totalShown} shown</span>
    </div>
  )
}
