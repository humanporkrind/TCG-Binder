import type { Card, OwnedCard } from '@/types'
import CardSlot from './CardSlot'
import styles from './BinderPage.module.css'

interface Props {
  pageNumber: number
  cards: Card[]
  owned: Record<number, OwnedCard>
  onCardClick: (id: number) => void
  gridCols: number
}

export default function BinderPage({ pageNumber, cards, owned, onCardClick, gridCols }: Props): JSX.Element {
  const perPage = gridCols * gridCols
  const slots: (Card | null)[] = [...cards]
  while (slots.length < perPage) slots.push(null)

  return (
    <div className={styles.page}>
      <div className={styles.pageNum}>Page {pageNumber}</div>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {slots.map((card, i) =>
          card ? (
            <CardSlot
              key={card.id}
              card={card}
              isOwned={!!owned[card.id]}
              onClick={() => onCardClick(card.id)}
            />
          ) : (
            <div key={`empty-${i}`} className={styles.emptySlot} />
          )
        )}
      </div>
    </div>
  )
}
