import { app, BrowserWindow, protocol, net } from 'electron'
import { join, extname } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './db/database'
import { registerDbHandlers } from './handlers/db-handlers'
import { registerImageHandlers } from './handlers/image-handlers'
import { registerExportHandlers } from './handlers/export-handlers'
import { registerDialogHandlers } from './handlers/dialog-handlers'
import { registerPriceHandlers } from './handlers/price-handlers'

let mainWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d1b2a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Custom protocol for serving user images stored in userData
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    if (url.host === 'images') {
      const imagePath = join(app.getPath('userData'), 'images', url.pathname.slice(1))
      return net.fetch(pathToFileURL(imagePath).toString())
    }
    return new Response('Not found', { status: 404 })
  })

  initDatabase()
  registerDbHandlers()
  registerImageHandlers()
  registerExportHandlers()
  registerDialogHandlers()
  registerPriceHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
