export interface Binder {
  id: number
  name: string
  description: string
  pokemon: string
  cover_image: string | null
  grid_cols: number
  created_at: string
}

export interface Card {
  id: number
  binder_id: number
  name: string
  set_name: string
  card_number: string
  rarity: string
  release_year: number
  price_eur: number | null
  image_path: string | null
  country: string
  notes: string
  created_at: string
}

export const COUNTRY_FLAGS: Record<string, string> = {
  JP: '🇯🇵', EN: '🇺🇸', DE: '🇩🇪', FR: '🇫🇷',
  IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', KR: '🇰🇷',
  ZH: '🇨🇳', NL: '🇳🇱', PL: '🇵🇱', RU: '🇷🇺'
}

export const COUNTRY_OPTIONS = [
  { code: '', label: '— None —' },
  { code: 'EN', label: '🇺🇸 English' },
  { code: 'JP', label: '🇯🇵 Japanese' },
  { code: 'DE', label: '🇩🇪 German' },
  { code: 'FR', label: '🇫🇷 French' },
  { code: 'IT', label: '🇮🇹 Italian' },
  { code: 'ES', label: '🇪🇸 Spanish' },
  { code: 'PT', label: '🇵🇹 Portuguese' },
  { code: 'KR', label: '🇰🇷 Korean' },
  { code: 'ZH', label: '🇨🇳 Chinese' },
  { code: 'NL', label: '🇳🇱 Dutch' },
  { code: 'PL', label: '🇵🇱 Polish' },
]

export interface OwnedCard {
  id: number
  card_id: number
  binder_id: number
  condition: CardCondition
  purchase_date: string | null
  purchase_price: number | null
  notes: string
  updated_at: string
}

export interface CardSet {
  id: number
  binder_id: number
  name: string
  year: number | null
  card_count: number
}

export type CardCondition = 'Mint' | 'NM' | 'LP' | 'MP' | 'HP' | 'Damaged'

export const CARD_CONDITIONS: CardCondition[] = ['Mint', 'NM', 'LP', 'MP', 'HP', 'Damaged']

export interface CardPrice {
  card_id: number
  tcg_price: number | null
  tcg_url: string | null
  cm_price: number | null
  cm_url: string | null
  fetched_at: string
}

export type FilterMode = 'all' | 'owned' | 'missing'
export type ViewMode = 'binder' | 'analytics' | 'import-export'

export const GRID_OPTIONS = [
  { cols: 2, label: '2×2 (large)' },
  { cols: 3, label: '3×3 (default)' },
  { cols: 4, label: '4×4' },
  { cols: 5, label: '5×5' },
  { cols: 6, label: '6×6 (compact)' }
]
