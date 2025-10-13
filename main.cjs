const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron"); 
const path = require("path");
const fs = require("fs").promises; 
const isDev = require("electron-is-dev");

if (!isDev) {
  Menu.setApplicationMenu(null);
}

app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"), 
      experimentalFeatures: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  if (isDev) {
    win.loadURL('http://localhost:5173' );
    win.webContents.openDevTools();
  } else {
   win.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  }

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      win.focus();
    }
  });

  win.on('did-fail-load', () => {
    win.loadURL(`file://${path.join(__dirname, '../dist/index.html')}`);
  });

  win.webContents.on('crashed', () => {
    console.log('Renderer process crashed');
  });

  return win;
}

ipcMain.handle("show-save-dialog", async (event, options) => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (!focusedWindow) return null; 
  const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, options);
  return canceled ? null : filePath;
});

ipcMain.handle("write-file", async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, data);
    return true;
  } catch (error) {
    console.error('Failed to write file:', error);
    return false;
  }
});


app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const win = windows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
