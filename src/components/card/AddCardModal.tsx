import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { Card } from '@/types'
import { COUNTRY_OPTIONS } from '@/types'

interface Props {
  onClose: () => void
}

const BLANK = {
  name: '', set_name: '', card_number: '', rarity: '', release_year: new Date().getFullYear(), price_eur: '', country: '', notes: ''
}

export default function AddCardModal({ onClose }: Props): JSX.Element {
  const { addCard } = useStore()
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const f = (field: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: e.target.value })

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const id = await window.electronAPI.addCard({
        name: form.name.trim(),
        set_name: form.set_name.trim(),
        card_number: form.card_number.trim(),
        rarity: form.rarity.trim(),
        release_year: parseInt(String(form.release_year)) || 0,
        price_eur: form.price_eur ? parseFloat(String(form.price_eur)) : null,
        country: form.country,
        notes: form.notes.trim()
      })
      addCard({
        id: id as number,
        name: form.name.trim(),
        set_name: form.set_name.trim(),
        card_number: form.card_number.trim(),
        rarity: form.rarity.trim(),
        release_year: parseInt(String(form.release_year)) || 0,
        price_eur: form.price_eur ? parseFloat(String(form.price_eur)) : null,
        image_path: null,
        country: form.country,
        notes: form.notes.trim(),
        created_at: new Date().toISOString()
      } as Card)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Add New Card</div>

        <div className="form-row">
          <label>Name *</label>
          <input placeholder="e.g. Pikachu" value={form.name} onChange={f('name')} autoFocus />
        </div>
        <div className="form-row">
          <label>Set</label>
          <input placeholder="e.g. Base Set" value={form.set_name} onChange={f('set_name')} />
        </div>
        <div className="form-row">
          <label>Card Number</label>
          <input placeholder="e.g. 58/102" value={form.card_number} onChange={f('card_number')} />
        </div>
        <div className="form-row">
          <label>Rarity</label>
          <input placeholder="e.g. Common, Rare, Secret" value={form.rarity} onChange={f('rarity')} />
        </div>
        <div className="form-row">
          <label>Year</label>
          <input type="number" value={form.release_year} onChange={f('release_year')} />
        </div>
        <div className="form-row">
          <label>Price (EUR)</label>
          <input type="number" step="0.01" placeholder="0.00" value={form.price_eur} onChange={f('price_eur')} />
        </div>
        <div className="form-row">
          <label>Language / Country</label>
          <select value={form.country} onChange={f('country')}>
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={f('notes')} />
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  )
}
