const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  setVaultPath: (path) => ipcRenderer.invoke('set-vault-path', path),
  saveNoteAsPdf: (title) => ipcRenderer.invoke('save-note-as-pdf', title),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  platform: process.platform,
});
