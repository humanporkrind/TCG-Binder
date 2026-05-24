import { useStore } from '@/store/useStore'
import type { Card } from '@/types'
import { COUNTRY_FLAGS } from '@/types'
import styles from './CardSlot.module.css'

interface Props {
  card: Card
  isOwned: boolean
  onClick: () => void
}

export default function CardSlot({ card, isOwned, onClick }: Props): JSX.Element {
  const { toggleOwned } = useStore()

  const handleRightClick = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    toggleOwned(card.id)
  }

  const imgSrc = card.image_path
    ? card.image_path.startsWith('app://') || card.image_path.startsWith('https://')
      ? card.image_path
      : `app://images/${card.image_path}`
    : null

  return (
    <div
      className={`${styles.slot} ${isOwned ? styles.owned : ''}`}
      onClick={onClick}
      onContextMenu={handleRightClick}
      title={`${card.name} — ${card.set_name} ${card.card_number}\nRight-click to toggle owned`}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={card.name} className={styles.img} loading="lazy" />
      ) : (
        <div className={styles.noImg}>
          <span className={styles.icon}>
            {card.country && COUNTRY_FLAGS[card.country] ? COUNTRY_FLAGS[card.country] : '⚡'}
          </span>
          <span className={styles.name}>{card.name}</span>
          <span className={styles.set}>{card.set_name}</span>
          {card.card_number && <span className={styles.num}>{card.card_number}</span>}
          {card.rarity && <span className={styles.badge}>{card.rarity}</span>}
        </div>
      )}
      {isOwned && (
        <>
          <div className={styles.ownedOverlay}>
            <span className={styles.ownedLabel}>✓ Owned</span>
          </div>
          <div className={styles.ownedCorner} aria-label="Owned">✓</div>
        </>
      )}
    </div>
  )
}
