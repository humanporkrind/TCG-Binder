import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // ── Binders ──────────────────────────────────────────────────────────────
  getAllBinders: () => ipcRenderer.invoke('db:getAllBinders'),
  createBinder: (data: unknown) => ipcRenderer.invoke('db:createBinder', data),
  updateBinder: (id: number, data: unknown) => ipcRenderer.invoke('db:updateBinder', id, data),
  deleteBinder: (id: number) => ipcRenderer.invoke('db:deleteBinder', id),

  // ── Cards ─────────────────────────────────────────────────────────────────
  getAllCards: (binderId: number) => ipcRenderer.invoke('db:getAllCards', binderId),
  getCard: (id: number) => ipcRenderer.invoke('db:getCard', id),
  addCard: (card: unknown) => ipcRenderer.invoke('db:addCard', card),
  updateCard: (id: number, data: unknown) => ipcRenderer.invoke('db:updateCard', id, data),
  deleteCard: (id: number) => ipcRenderer.invoke('db:deleteCard', id),
  importCards: (binderId: number, cards: unknown[]) => ipcRenderer.invoke('db:importCards', binderId, cards),

  // ── Owned ─────────────────────────────────────────────────────────────────
  getAllOwned: (binderId: number) => ipcRenderer.invoke('db:getAllOwned', binderId),
  setOwned: (cardId: number, binderId: number, data: unknown | null) =>
    ipcRenderer.invoke('db:setOwned', cardId, binderId, data),

  // ── Sets ──────────────────────────────────────────────────────────────────
  getAllSets: (binderId: number) => ipcRenderer.invoke('db:getAllSets', binderId),

  // ── Images ────────────────────────────────────────────────────────────────
  setCardImage: (cardId: number, sourcePath: string) =>
    ipcRenderer.invoke('images:setCardImage', cardId, sourcePath),
  pickAndSetCardImage: (cardId: number) =>
    ipcRenderer.invoke('images:pickAndSetCardImage', cardId),
  deleteCardImage: (cardId: number) => ipcRenderer.invoke('images:deleteCardImage', cardId),

  // ── Marketplace ───────────────────────────────────────────────────────────
  openMarketplace: (cardId: number, marketplace: 'cardmarket' | 'tcgplayer') =>
    ipcRenderer.invoke('cards:openMarketplace', cardId, marketplace),

  // ── Export / Import ───────────────────────────────────────────────────────
  exportOwnedJSON: (binderId: number) => ipcRenderer.invoke('export:ownedJSON', binderId),
  importOwnedJSON: (binderId: number) => ipcRenderer.invoke('export:importOwnedJSON', binderId),
  importSetCSV: (binderId: number) => ipcRenderer.invoke('export:importSetCSV', binderId),
  importBinder: () => ipcRenderer.invoke('export:importBinder'),
  exportBinder: (binderId: number) => ipcRenderer.invoke('export:exportBinder', binderId),
  printCardList: (options: unknown) => ipcRenderer.invoke('export:printCardList', options),
  exportCSV: (binderId: number, options: unknown) => ipcRenderer.invoke('export:exportCSV', binderId, options),

  // ── Prices ────────────────────────────────────────────────────────────────
  fetchPrices: (binderId: number) => ipcRenderer.invoke('prices:fetchAll', binderId),
  getPricesForBinder: (binderId: number) => ipcRenderer.invoke('prices:getForBinder', binderId),
  onPricesProgress: (cb: (data: unknown) => void) =>
    ipcRenderer.on('prices:progress', (_e, data) => cb(data)),
  offPricesProgress: () => ipcRenderer.removeAllListeners('prices:progress'),
  onPricesDone: (cb: (data: unknown) => void) =>
    ipcRenderer.on('prices:done', (_e, data) => cb(data)),
  offPricesDone: () => ipcRenderer.removeAllListeners('prices:done'),

  // ── Dialogs ───────────────────────────────────────────────────────────────
  showOpenDialog: (opts: unknown) => ipcRenderer.invoke('dialog:showOpen', opts),
  showSaveDialog: (opts: unknown) => ipcRenderer.invoke('dialog:showSave', opts),

  platform: process.platform
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
