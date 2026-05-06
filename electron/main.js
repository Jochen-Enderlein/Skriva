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
