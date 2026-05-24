import { useMemo, useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import BinderPage from '@/components/binder/BinderPage'
import CardDetailModal from '@/components/card/CardDetailModal'
import AddCardModal from '@/components/card/AddCardModal'
import BinderControls from '@/components/binder/BinderControls'
import type { Card } from '@/types'
import styles from './BinderView.module.css'

export default function BinderView(): JSX.Element {
  const { cards, owned, filterMode, searchQuery, selectedCardId, setSelectedCard, isLoading, activeBinder } = useStore()
  const [showAddCard, setShowAddCard] = useState(false)
  const gridCols = activeBinder?.grid_cols ?? 3

  const filtered = useMemo(() => {
    let list = cards
    if (filterMode === 'owned')   list = list.filter((c) => owned[c.id])
    if (filterMode === 'missing') list = list.filter((c) => !owned[c.id])
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.set_name.toLowerCase().includes(q) ||
          c.card_number.toLowerCase().includes(q) ||
          String(c.id) === q
      )
    }
    return list
  }, [cards, owned, filterMode, searchQuery])

  const pages = useMemo(() => {
    const perPage = gridCols * gridCols
    const result: Card[][] = []
    for (let i = 0; i < filtered.length; i += perPage) {
      result.push(filtered.slice(i, i + perPage))
    }
    return result
  }, [filtered, gridCols])

  const selectedCard = useMemo(
    () => (selectedCardId != null ? cards.find((c) => c.id === selectedCardId) ?? null : null),
    [cards, selectedCardId]
  )

  const handleCardClick = useCallback((cardId: number) => {
    setSelectedCard(cardId)
  }, [setSelectedCard])

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading collection…</p>
      </div>
    )
  }

  return (
    <div className={styles.view}>
      <BinderControls onAddCard={() => setShowAddCard(true)} totalShown={filtered.length} />

      <div className={styles.pages}>
        {pages.map((pageCards, i) => (
          <BinderPage
            key={i}
            pageNumber={i + 1}
            cards={pageCards}
            owned={owned}
            onCardClick={handleCardClick}
            gridCols={gridCols}
          />
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>No cards match your filters.</p>
          </div>
        )}
      </div>

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}

      {showAddCard && <AddCardModal onClose={() => setShowAddCard(false)} />}
    </div>
  )
}
