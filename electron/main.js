const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { vaultPath: null };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#050505',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  const url = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  mainWindow.loadURL(url);

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
}

// IPC Handlers
ipcMain.handle('get-vault-path', () => {
  const config = loadConfig();
  return config.vaultPath;
});

ipcMain.handle('set-vault-path', (event, vaultPath) => {
  saveConfig({ vaultPath });
  if (mainWindow) mainWindow.reload();
  return true;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle('maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.handle('get-note-content', async (event, slug) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    
    let filePath = path.join(vaultPath, slug);
    if (!filePath.endsWith('.md') && !filePath.endsWith('.excalidraw')) {
      filePath += '.md';
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read note content:', error);
    throw error;
  }
});

ipcMain.handle('get-notes', async (event, dir = '', includeTemplates = false) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    const fullPath = path.join(vaultPath, dir);
    
    if (!fs.existsSync(fullPath)) return [];
    
    const getNotesRecursively = (currentDir) => {
      const dirPath = path.join(vaultPath, currentDir);
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      let results = [];
      
      for (const entry of entries) {
        if (!includeTemplates && entry.name === '.templates' && currentDir === '') continue;
        
        const relativePath = path.join(currentDir, entry.name);
        const fullEntryPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          results = [...results, ...getNotesRecursively(relativePath)];
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.excalidraw')) {
          const isExcalidraw = entry.name.endsWith('.excalidraw');
          const title = isExcalidraw ? entry.name : entry.name.replace(/\.md$/, '');
          const slug = path.join(currentDir, isExcalidraw ? entry.name : title);
          
          const stats = fs.statSync(fullEntryPath);
          results.push({
            title,
            slug,
            path: entry.name,
            relativeDir: currentDir,
            lastUpdated: stats.mtime.toISOString(),
          });
        }
      }
      return results;
    };
    
    return getNotesRecursively(dir);
  } catch (error) {
    console.error('Failed to get notes:', error);
    return [];
  }
});

ipcMain.handle('get-folders', async (event, dir = '') => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    const fullPath = path.join(vaultPath, dir);
    
    if (!fs.existsSync(fullPath)) return [];
    
    const getFoldersRecursively = (currentDir) => {
      const dirPath = path.join(vaultPath, currentDir);
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      let results = currentDir ? [currentDir] : [];
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.templates') {
          results = [...results, ...getFoldersRecursively(path.join(currentDir, entry.name))];
        }
      }
      return results;
    };
    
    return getFoldersRecursively(dir);
  } catch (error) {
    console.error('Failed to get folders:', error);
    return [];
  }
});

ipcMain.handle('search-notes', async (event, query) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    
    // Simple search implementation
    const results = [];
    const searchInDir = (currentDir) => {
      const dirPath = path.join(vaultPath, currentDir);
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const relativePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          searchInDir(relativePath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8');
          if (entry.name.toLowerCase().includes(query.toLowerCase()) || content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              slug: relativePath.replace(/\.md$/, ''),
              title: entry.name.replace(/\.md$/, ''),
              snippet: content.substring(0, 100) + '...'
            });
          }
        }
      }
    };
    
    searchInDir('');
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
});

ipcMain.handle('get-backlinks', async (event, targetTitle) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    const backlinks = [];
    
    const findLinks = (currentDir) => {
      const dirPath = path.join(vaultPath, currentDir);
      if (!fs.existsSync(dirPath)) return;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const relativePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          findLinks(relativePath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8');
          if (content.includes(`[[${targetTitle}]]`)) {
            backlinks.push({
              title: entry.name.replace(/\.md$/, ''),
              slug: relativePath.replace(/\.md$/, ''),
              snippet: content.substring(content.indexOf(`[[${targetTitle}]]`) - 50, content.indexOf(`[[${targetTitle}]]`) + 50)
            });
          }
        }
      }
    };
    
    findLinks('');
    return backlinks;
  } catch (error) {
    console.error('Failed to get backlinks:', error);
    return [];
  }
});

ipcMain.handle('save-note', async (event, slug, content) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    let filePath = path.join(vaultPath, slug);
    if (!filePath.endsWith('.md') && !filePath.endsWith('.excalidraw')) {
      filePath += '.md';
    }
    
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save note:', error);
    return false;
  }
});

ipcMain.handle('delete-file', async (event, slug) => {
  try {
    const config = loadConfig();
    const vaultPath = config.vaultPath || path.join(app.getAppPath(), 'assets/notes');
    let filePath = path.join(vaultPath, slug);
    if (!filePath.endsWith('.md') && !filePath.endsWith('.excalidraw')) {
      filePath += '.md';
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
});

ipcMain.handle('open-preview-window', (event, slug) => {
  const previewWindow = new BrowserWindow({
    width: 800,
    height: 900,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  previewWindow.setMenuBarVisibility(false);

  const baseUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;

  const url = `${baseUrl}/preview/${slug}`;
  previewWindow.loadURL(url);
  });
ipcMain.handle('save-note-as-pdf', async (event, title) => {
  try {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const pdfPath = await dialog.showSaveDialog(win, {
      title: 'Export to PDF',
      defaultPath: `${title || 'note'}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (pdfPath.canceled) return false;

    const originalBg = win.getBackgroundColor();
    win.setBackgroundColor('#ffffff');
    
    await win.webContents.insertCSS(`
      html, body, #__next, [data-slot="sidebar-wrapper"], .flex { 
        background-color: white !important; 
        background: white !important; 
      }
    `);

    await new Promise(resolve => setTimeout(resolve, 1500));

    await win.webContents.executeJavaScript(`
      (async () => {
        const waitForRendering = () => {
          return new Promise((resolve) => {
            let checks = 0;
            const check = () => {
              const rendering = document.querySelectorAll('[data-rendering="true"]');
              if (rendering.length > 0 && checks < 200) { 
                checks++;
                setTimeout(check, 100);
              } else {
                resolve();
              }
            };
            check();
          });
        };
        await waitForRendering();
        await new Promise(r => setTimeout(r, 1000));
      })()
    `);

    const options = {
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 9px; width: 100%; margin: 0 1cm; display: flex; justify-content: space-between; font-family: sans-serif; color: #888; background: white; -webkit-print-color-adjust: exact;"><span>Feli.md</span><span>' + (title || 'Note') + '</span></div>',
      footerTemplate: '<div style="font-size: 9px; width: 100%; margin: 0 1cm; display: flex; justify-content: flex-end; font-family: sans-serif; color: #888; background: white; -webkit-print-color-adjust: exact;"><span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span></div>',
      pageSize: 'A4',
      margins: { marginType: 'none' }
    };

    const data = await win.webContents.printToPDF(options);
    fs.writeFileSync(pdfPath.filePath, data);
    win.setBackgroundColor(originalBg);
    return true;
  } catch (error) {
    console.error('Failed to export PDF:', error);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
