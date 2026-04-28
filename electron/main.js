const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;
const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return { vaultPath: null };
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 16 }, // macOS: Position der Buttons anpassen
    backgroundColor: '#050505',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Hide the menu bar
  mainWindow.setMenuBarVisibility(false);
  // Also remove it completely to prevent Alt-key reveal
  Menu.setApplicationMenu(null);

  const url = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../out/index.html')}`;
  
  mainWindow.loadURL(url);

  // Prevent default navigation when dropping files on the window
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });

  /* 
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  */
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-vault-path', () => {
  const config = loadConfig();
  return config.vaultPath;
});

ipcMain.handle('set-vault-path', (event, vaultPath) => {
  saveConfig({ vaultPath });
  mainWindow.reload();
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
  console.log('Minimizing window...');
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  console.log('Maximizing/Unmaximizing window...');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  console.log('Closing window...');
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('save-note-as-pdf', async (event, title) => {
  try {
    const pdfPath = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to PDF',
      defaultPath: `${title || 'note'}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (pdfPath.canceled) return false;

    // Save original background color
    const originalBg = mainWindow.getBackgroundColor();
    // Set to white for export to prevent black margins/borders
    mainWindow.setBackgroundColor('#ffffff');
    
    // Force white background via CSS injection to be absolutely sure
    await mainWindow.webContents.insertCSS(`
      html, body, #__next, [data-slot="sidebar-wrapper"], .flex { 
        background-color: white !important; 
        background: white !important; 
      }
    `);

    // Wait for components to mount and start rendering
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Wait for Mermaid and other diagrams to finish rendering
    await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const waitForRendering = () => {
          return new Promise((resolve) => {
            let checks = 0;
            const check = () => {
              const rendering = document.querySelectorAll('[data-rendering="true"]');
              // If we still see rendering elements, wait. 
              // We wait up to 20 seconds now because Excalidraw can be slow.
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
      headerTemplate: `
        <div style="font-size: 9px; width: 100%; margin: 0 1cm; display: flex; justify-content: space-between; font-family: sans-serif; color: #888; background: white; -webkit-print-color-adjust: exact;">
          <span>Feli.md</span>
          <span>${title || 'Note'}</span>
        </div>`,
      footerTemplate: `
        <div style="font-size: 9px; width: 100%; margin: 0 1cm; display: flex; justify-content: flex-end; font-family: sans-serif; color: #888; background: white; -webkit-print-color-adjust: exact;">
          <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
        </div>`,
      pageSize: 'A4',
      margins: {
        marginType: 'none'
      }
    };

    const data = await mainWindow.webContents.printToPDF(options);
    fs.writeFileSync(pdfPath.filePath, data);
    
    // Restore original background color
    mainWindow.setBackgroundColor(originalBg);
    
    return true;
  } catch (error) {
    console.error('Failed to export PDF:', error);
    return false;
  }
});
