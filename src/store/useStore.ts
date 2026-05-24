import { create } from 'zustand'
import type { Binder, Card, CardPrice, OwnedCard, CardSet, FilterMode, ViewMode } from '@/types'

interface AppState {
  // Binders
  binders: Binder[]
  activeBinder: Binder | null

  // Data for active binder
  cards: Card[]
  owned: Record<number, OwnedCard>  // keyed by card_id
  sets: CardSet[]

  // Prices
  prices: Record<number, CardPrice>
  priceStatus: 'idle' | 'fetching' | 'done'
  priceProgress: { processed: number; total: number } | null

  setPrices: (list: CardPrice[]) => void
  setPriceStatus: (s: 'idle' | 'fetching' | 'done') => void
  setPriceProgress: (p: { processed: number; total: number } | null) => void

  // UI
  view: ViewMode
  filterMode: FilterMode
  searchQuery: string
  selectedCardId: number | null
  isLoading: boolean
  theme: 'dark' | 'light'
  marketplace: 'cardmarket' | 'tcgplayer' | 'both'

  // Actions
  setBinders: (binders: Binder[]) => void
  setActiveBinder: (binder: Binder) => void
  updateBinderInList: (binder: Binder) => void
  removeBinderFromList: (id: number) => void

  setCards: (cards: Card[]) => void
  setOwned: (owned: OwnedCard[]) => void
  setSets: (sets: CardSet[]) => void
  setView: (view: ViewMode) => void
  setFilterMode: (mode: FilterMode) => void
  setSearchQuery: (q: string) => void
  setSelectedCard: (id: number | null) => void
  setLoading: (loading: boolean) => void
  toggleTheme: () => void
  setMarketplace: (m: 'cardmarket' | 'tcgplayer' | 'both') => void

  toggleOwned: (cardId: number) => void
  updateOwned: (cardId: number, data: Partial<OwnedCard> | null) => void
  updateCard: (card: Card) => void
  addCard: (card: Card) => void
  removeCard: (id: number) => void
}

export const useStore = create<AppState>((set, get) => ({
  binders: [],
  activeBinder: null,
  cards: [],
  owned: {},
  sets: [],
  prices: {},
  priceStatus: 'idle',
  priceProgress: null,
  view: 'binder',
  filterMode: 'all',
  searchQuery: '',
  selectedCardId: null,
  isLoading: true,
  theme: (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark',
  marketplace: (localStorage.getItem('marketplace') as 'cardmarket' | 'tcgplayer' | 'both') ?? 'both',

  setBinders: (binders) => set({ binders }),

  setActiveBinder: (binder) => set({ activeBinder: binder }),

  updateBinderInList: (binder) =>
    set({ binders: get().binders.map((b) => (b.id === binder.id ? binder : b)),
          activeBinder: get().activeBinder?.id === binder.id ? binder : get().activeBinder }),

  removeBinderFromList: (id) => {
    const remaining = get().binders.filter((b) => b.id !== id)
    set({ binders: remaining, activeBinder: remaining[0] ?? null })
  },

  setCards: (cards) => set({ cards }),

  setOwned: (ownedList) => {
    const owned: Record<number, OwnedCard> = {}
    for (const o of ownedList) owned[o.card_id] = o
    set({ owned })
  },

  setPrices: (list) => {
    const prices: Record<number, CardPrice> = {}
    for (const p of list) prices[p.card_id] = p
    set({ prices })
  },
  setPriceStatus: (priceStatus) => set({ priceStatus }),
  setPriceProgress: (priceProgress) => set({ priceProgress }),

  setSets: (sets) => set({ sets }),
  setView: (view) => set({ view }),
  setFilterMode: (filterMode) => set({ filterMode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCard: (selectedCardId) => set({ selectedCardId }),
  setLoading: (isLoading) => set({ isLoading }),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
    set({ theme: next })
  },
  setMarketplace: (marketplace) => {
    localStorage.setItem('marketplace', marketplace)
    set({ marketplace })
  },

  toggleOwned: (cardId) => {
    const { owned, activeBinder } = get()
    if (!activeBinder) return
    if (owned[cardId]) {
      window.electronAPI.setOwned(cardId, activeBinder.id, null)
      const next = { ...owned }
      delete next[cardId]
      set({ owned: next })
    } else {
      const data = { condition: 'NM' }
      window.electronAPI.setOwned(cardId, activeBinder.id, data)
      set({
        owned: {
          ...owned,
          [cardId]: {
            id: 0,
            card_id: cardId,
            binder_id: activeBinder.id,
            condition: 'NM',
            purchase_date: null,
            purchase_price: null,
            notes: '',
            updated_at: new Date().toISOString()
          }
        }
      })
    }
  },

  updateOwned: (cardId, data) => {
    const { activeBinder } = get()
    if (!activeBinder) return
    window.electronAPI.setOwned(cardId, activeBinder.id, data)
    if (data === null) {
      const next = { ...get().owned }
      delete next[cardId]
      set({ owned: next })
    } else {
      set({ owned: { ...get().owned, [cardId]: { ...get().owned[cardId], ...data } } })
    }
  },

  updateCard: (card) => set({ cards: get().cards.map((c) => (c.id === card.id ? card : c)) }),
  addCard: (card) => set({ cards: [...get().cards, card] }),
  removeCard: (id) => set({ cards: get().cards.filter((c) => c.id !== id) })
}))
