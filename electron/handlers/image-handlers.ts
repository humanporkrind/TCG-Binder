import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, existsSync, unlinkSync } from 'fs'
import { join, extname } from 'path'
import { getDb } from '../db/database'

export function registerImageHandlers(): void {
  ipcMain.handle('images:pickAndSetCardImage', async (_e, cardId: number) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Card Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return copyImageForCard(cardId, result.filePaths[0])
  })

  ipcMain.handle('images:setCardImage', (_e, cardId: number, sourcePath: string) => {
    return copyImageForCard(cardId, sourcePath)
  })

  ipcMain.handle('images:deleteCardImage', (_e, cardId: number) => {
    const card = getDb().prepare('SELECT image_path FROM cards WHERE id = ?').get(cardId) as
      | { image_path: string | null }
      | undefined

    if (card?.image_path) {
      const fullPath = join(app.getPath('userData'), 'images', card.image_path)
      if (existsSync(fullPath)) unlinkSync(fullPath)
      getDb().prepare('UPDATE cards SET image_path = NULL WHERE id = ?').run(cardId)
    }
    return true
  })
}

function copyImageForCard(cardId: number, sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase() || '.jpg'
  const filename = `${cardId}${ext}`
  const destDir = join(app.getPath('userData'), 'images')
  const destPath = join(destDir, filename)

  copyFileSync(sourcePath, destPath)
  getDb().prepare('UPDATE cards SET image_path = ? WHERE id = ?').run(filename, cardId)

  return `app://images/${filename}`
}
