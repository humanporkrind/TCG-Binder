import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { Binder } from '@/types'
import { GRID_OPTIONS } from '@/types'
import styles from './BinderPickerModal.module.css'

interface Props {
  onClose: () => void
}

type Mode = 'list' | 'create' | 'edit'

export default function BinderPickerModal({ onClose }: Props): JSX.Element {
  const { binders, activeBinder, setActiveBinder, setBinders, updateBinderInList, removeBinderFromList } = useStore()
  const [mode, setMode] = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<Binder | null>(null)
  const [form, setForm] = useState({ name: '', description: '', pokemon: '', grid_cols: 3 })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const switchBinder = (b: Binder): void => {
    setActiveBinder(b)
    onClose()
  }

  const startCreate = (): void => {
    setForm({ name: '', description: '', pokemon: '', grid_cols: 3 })
    setMode('create')
  }

  const startEdit = (b: Binder): void => {
    setEditTarget(b)
    setForm({ name: b.name, description: b.description, pokemon: b.pokemon, grid_cols: b.grid_cols })
    setMode('edit')
  }

  const handleCreate = async (): Promise<void> => {
    if (!form.name.trim()) return
    setBusy(true)
    const id = await window.electronAPI.createBinder(form) as number
    const updated = await window.electronAPI.getAllBinders() as Binder[]
    setBinders(updated)
    const created = updated.find((b) => b.id === id)
    if (created) setActiveBinder(created)
    onClose()
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!editTarget || !form.name.trim()) return
    setBusy(true)
    await window.electronAPI.updateBinder(editTarget.id, form)
    const updated: Binder = { ...editTarget, ...form }
    updateBinderInList(updated)
    setMode('list')
    setBusy(false)
  }

  const handleDelete = async (b: Binder): Promise<void> => {
    if (!confirm(`Delete "${b.name}" and all its cards? This cannot be undone.`)) return
    await window.electronAPI.deleteBinder(b.id)
    removeBinderFromList(b.id)
    if (activeBinder?.id === b.id) onClose()
  }

  const handleImport = async (): Promise<void> => {
    setBusy(true)
    setStatus('')
    const result = await window.electronAPI.importBinder() as { binderId: number; name: string; count: number } | null
    if (result) {
      const updated = await window.electronAPI.getAllBinders() as Binder[]
      setBinders(updated)
      const imported = updated.find((b) => b.id === result.binderId)
      if (imported) setActiveBinder(imported)
      setStatus(`Imported "${result.name}" with ${result.count} cards.`)
    }
    setBusy(false)
  }

  const f = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: field === 'grid_cols' ? parseInt(e.target.value) : e.target.value })

  if (mode === 'create' || mode === 'edit') {
    const isEdit = mode === 'edit'
    return (
      <div className="modal-overlay" onClick={() => setMode('list')}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">{isEdit ? 'Edit Binder' : 'New Binder'}</div>

          <div className="form-row">
            <label>Name *</label>
            <input value={form.name} onChange={f('name')} placeholder="e.g. Charizard Binder" autoFocus />
          </div>
          <div className="form-row">
            <label>Pokémon / Theme</label>
            <input value={form.pokemon} onChange={f('pokemon')} placeholder="e.g. Charizard" />
          </div>
          <div className="form-row">
            <label>Description</label>
            <input value={form.description} onChange={f('description')} placeholder="Optional notes about this binder" />
          </div>
          <div className="form-row">
            <label>Grid Layout</label>
            <select value={form.grid_cols} onChange={f('grid_cols')}>
              {GRID_OPTIONS.map((o) => (
                <option key={o.cols} value={o.cols}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setMode('list')}>Cancel</button>
            <button className="btn-primary" onClick={isEdit ? handleSaveEdit : handleCreate} disabled={busy || !form.name.trim()}>
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">My Binders</div>

        <div className={styles.list}>
          {binders.map((b) => (
            <div
              key={b.id}
              className={`${styles.row} ${activeBinder?.id === b.id ? styles.active : ''}`}
            >
              <button className={styles.rowMain} onClick={() => switchBinder(b)}>
                <span className={styles.rowIcon}>📖</span>
                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>{b.name}</span>
                  <span className={styles.rowMeta}>
                    {b.pokemon && `${b.pokemon} · `}{b.grid_cols}×{b.grid_cols} grid
                  </span>
                </span>
                {activeBinder?.id === b.id && <span className={styles.activeTag}>active</span>}
              </button>
              <div className={styles.rowActions}>
                <button className={styles.iconBtn} title="Edit" onClick={(e) => { e.stopPropagation(); startEdit(b) }}>✏️</button>
                <button className={styles.iconBtn} title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(b) }}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {status && <p className={styles.status}>{status}</p>}

        <div className={styles.footer}>
          <button className="btn-secondary" onClick={handleImport} disabled={busy}>
            📥 Import Binder
          </button>
          <button className="btn-primary" onClick={startCreate}>+ New Binder</button>
        </div>
      </div>
    </div>
  )
}
