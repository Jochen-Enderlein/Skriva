const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  setVaultPath: (path) => ipcRenderer.invoke('set-vault-path', path),
  saveNoteAsPdf: (title) => ipcRenderer.invoke('save-note-as-pdf', title),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openPreviewWindow: (slug) => ipcRenderer.invoke('open-preview-window', slug),
  getNoteContent: (slug) => ipcRenderer.invoke('get-note-content', slug),
  getNotes: (dir, includeTemplates) => ipcRenderer.invoke('get-notes', dir, includeTemplates),
  getFolders: (dir) => ipcRenderer.invoke('get-folders', dir),
  getBacklinks: (title) => ipcRenderer.invoke('get-backlinks', title),
  searchNotes: (query) => ipcRenderer.invoke('search-notes', query),
  saveNote: (slug, content) => ipcRenderer.invoke('save-note', slug, content),
  deleteFile: (slug) => ipcRenderer.invoke('delete-file', slug),
  platform: process.platform,
});
