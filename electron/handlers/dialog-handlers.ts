import { ipcMain, dialog } from 'electron'

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:showOpen', async (_e, opts: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(opts)
  })

  ipcMain.handle('dialog:showSave', async (_e, opts: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(opts)
  })
}
