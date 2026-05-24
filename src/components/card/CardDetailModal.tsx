import { useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import type { Card, CardCondition } from '@/types'
import { CARD_CONDITIONS, COUNTRY_FLAGS, COUNTRY_OPTIONS } from '@/types'
import styles from './CardDetailModal.module.css'

interface Props {
  card: Card
  onClose: () => void
}

export default function CardDetailModal({ card, onClose }: Props): JSX.Element {
  const { owned, toggleOwned, updateOwned, updateCard, removeCard, marketplace, prices } = useStore()
  const price = prices[card.id]
  const ownedData = owned[card.id]
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...card })
  const resolveImg = (p: string | null): string | null =>
    p
      ? p.startsWith('app://') || p.startsWith('https://')
        ? p
        : `app://images/${p}`
      : null

  const [imgSrc, setImgSrc] = useState<string | null>(() => resolveImg(card.image_path))

  // Keep image in sync if the background fetch populates it while modal is open
  useEffect(() => {
    setImgSrc(resolveImg(card.image_path))
  }, [card.image_path])

  const handlePickImage = async (): Promise<void> => {
    const url = await window.electronAPI.pickAndSetCardImage(card.id)
    if (url) {
      setImgSrc(url as string)
      updateCard({ ...card, image_path: url as string })
    }
  }

  const handleDeleteImage = async (): Promise<void> => {
    await window.electronAPI.deleteCardImage(card.id)
    setImgSrc(null)
    updateCard({ ...card, image_path: null })
  }

  const handleSaveEdit = async (): Promise<void> => {
    await window.electronAPI.updateCard(card.id, editForm)
    updateCard(editForm as Card)
    setEditing(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`Delete "${card.name}" from your collection? This cannot be undone.`)) return
    await window.electronAPI.deleteCard(card.id)
    removeCard(card.id)
    onClose()
  }

  const handleConditionChange = (condition: CardCondition): void => {
    updateOwned(card.id, { ...ownedData, condition })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        <div className={styles.layout}>
          {/* Image panel */}
          <div className={styles.imagePanel}>
            <div className={styles.imageFrame}>
              {imgSrc ? (
                <img src={imgSrc} alt={card.name} className={styles.cardImg} />
              ) : (
                <div className={styles.noImage}>
                  <span>⚡</span>
                  <p>No image</p>
                </div>
              )}
            </div>
            <div className={styles.imageActions}>
              <button className="btn-secondary" onClick={handlePickImage}>
                📁 {imgSrc ? 'Change Image' : 'Add Image'}
              </button>
              {imgSrc && (
                <button className="btn-danger" onClick={handleDeleteImage}>Remove</button>
              )}
            </div>
          </div>

          {/* Info panel */}
          <div className={styles.infoPanel}>
            {editing ? (
              <div className={styles.editForm}>
                <div className="form-row">
                  <label>Name</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Set</label>
                  <input value={editForm.set_name} onChange={(e) => setEditForm({ ...editForm, set_name: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Card Number</label>
                  <input value={editForm.card_number} onChange={(e) => setEditForm({ ...editForm, card_number: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Rarity</label>
                  <input value={editForm.rarity} onChange={(e) => setEditForm({ ...editForm, rarity: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Year</label>
                  <input type="number" value={editForm.release_year} onChange={(e) => setEditForm({ ...editForm, release_year: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-row">
                  <label>Price (EUR)</label>
                  <input type="number" step="0.01" value={editForm.price_eur ?? ''} onChange={(e) => setEditForm({ ...editForm, price_eur: e.target.value ? parseFloat(e.target.value) : null })} />
                </div>
                <div className="form-row">
                  <label>Language / Country</label>
                  <select value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}>
                    {COUNTRY_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Notes</label>
                  <textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div className="form-actions">
                  <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveEdit}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className={styles.cardName}>{card.name}</h2>
                <div className={styles.meta}>
                  <Row label="Set" value={card.set_name} />
                  <Row label="Card No." value={card.card_number || '—'} />
                  <Row label="Rarity" value={card.rarity || '—'} />
                  <Row label="Year" value={String(card.release_year || '—')} />
                  <Row label="Price" value={card.price_eur ? `€${card.price_eur.toFixed(2)}` : '—'} />
                  {card.country && (
                    <Row label="Language" value={`${COUNTRY_FLAGS[card.country] ?? ''} ${card.country}`} />
                  )}
                  {card.notes && <Row label="Notes" value={card.notes} />}
                </div>

                {price && (price.tcg_price != null || price.cm_price != null) && (
                  <div className={styles.priceSection}>
                    {price.tcg_price != null && (
                      <div className={styles.priceRow}>
                        <span className={styles.priceSource}>TCGPlayer</span>
                        <span className={styles.priceVal}>${price.tcg_price.toFixed(2)}</span>
                      </div>
                    )}
                    {price.cm_price != null && (
                      <div className={styles.priceRow}>
                        <span className={styles.priceSource}>Cardmarket</span>
                        <span className={styles.priceVal}>€{price.cm_price.toFixed(2)}</span>
                      </div>
                    )}
                    <span className={styles.priceAge}>
                      updated {new Date(price.fetched_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className={styles.ownedSection}>
                  <div className={styles.ownedToggle}>
                    <span className={`tag ${ownedData ? 'tag-owned' : 'tag-missing'}`}>
                      {ownedData ? '✓ Owned' : '✗ Missing'}
                    </span>
                    <button
                      className={ownedData ? 'btn-danger' : 'btn-primary'}
                      onClick={() => toggleOwned(card.id)}
                    >
                      {ownedData ? 'Mark Missing' : 'Mark Owned'}
                    </button>
                  </div>

                  {ownedData && (
                    <div className={styles.conditionRow}>
                      <label>Condition</label>
                      <div className={styles.conditions}>
                        {CARD_CONDITIONS.map((cond) => (
                          <button
                            key={cond}
                            className={`${styles.condBtn} ${ownedData.condition === cond ? styles.condActive : ''}`}
                            onClick={() => handleConditionChange(cond)}
                          >
                            {cond}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button className="btn-secondary" onClick={() => setEditing(true)}>Edit Card</button>
                  {(marketplace === 'cardmarket' || marketplace === 'both') && (
                    <button className="btn-secondary" onClick={() => window.electronAPI.openMarketplace(card.id, 'cardmarket')}>
                      Cardmarket
                    </button>
                  )}
                  {(marketplace === 'tcgplayer' || marketplace === 'both') && (
                    <button className="btn-secondary" onClick={() => window.electronAPI.openMarketplace(card.id, 'tcgplayer')}>
                      TCGPlayer
                    </button>
                  )}
                  <button className="btn-danger" onClick={handleDelete}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
      <span style={{ fontSize: '.7rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: 1, minWidth: 70 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: '.9rem' }}>{value}</span>
    </div>
  )
}
