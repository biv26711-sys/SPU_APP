const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

const { openDB, searchTemplates, getTemplate, getRequiredPredecessors, getAllRequiredTemplates } = require('./db/sqlite-readonly.cjs');


if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    console.warn('electron-reload не установлен, продолжаем без него');
  }
}

let mainWindow;

function createWindow() {
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs') 
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false, 
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });


  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

 
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новый проект',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Открыть проект',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'JSON файлы', extensions: ['json'] },
                { name: 'Все файлы', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled) {
              mainWindow.webContents.send('menu-open-project', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Сохранить проект',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Экспорт в CSV',
          click: () => {
            mainWindow.webContents.send('menu-export-csv');
          }
        },
        {
          label: 'Экспорт в Excel',
          click: () => {
            mainWindow.webContents.send('menu-export-excel');
          }
        },
        { type: 'separator' },
        {
          label: process.platform === 'darwin' ? 'Выход из СПУ' : 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectall', label: 'Выделить все' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Перезагрузить' },
        { role: 'forceReload', label: 'Принудительная перезагрузка' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
  label: 'Расчеты',
  submenu: [
    {
      label: 'Рассчитать параметры',
      accelerator: 'F5',
      click: () => {
        mainWindow.webContents.send('menu-calculate');
      }
    },
    
    {
      label: 'Загрузить пример',
      submenu: [
        {
          label: 'Базовый пример (старый)',
          click: () => {
            mainWindow.webContents.send('menu-load-example-basic');
          }
        },
        {
          label: 'Все обязательные из БД',
          click: () => {
            mainWindow.webContents.send('menu-load-example-required');
          }
        },
      ]
    },
   
    {
      label: 'Очистить все',
      click: () => {
        mainWindow.webContents.send('menu-clear-all');
      }
    }
  ]
},
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { role: 'close', label: 'Закрыть' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе СПУ',
              message: 'СПУ - Сетевое планирование и управление',
              detail: 'Версия 1.0.0\n\nСистема для расчета параметров сетевого графика и построения диаграмм.\n\nРазработано для студентов ИДБ.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Руководство пользователя',
          click: () => {
            mainWindow.webContents.send('menu-show-help');
          }
        }
      ]
    }
  ];

  
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'О программе СПУ' },
        { type: 'separator' },
        { role: 'services', label: 'Службы', submenu: [] },
        { type: 'separator' },
        { role: 'hide', label: 'Скрыть СПУ' },
        { role: 'hideothers', label: 'Скрыть остальные' },
        { role: 'unhide', label: 'Показать все' },
        { type: 'separator' },
        { role: 'quit', label: 'Выйти из СПУ' }
      ]
    });

    template[5].submenu = [
      { role: 'close', label: 'Закрыть' },
      { role: 'minimize', label: 'Свернуть' },
      { role: 'zoom', label: 'Масштаб' },
      { type: 'separator' },
      { role: 'front', label: 'Переместить все вперед' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}


app.whenReady().then(() => {
  try {
    const dbPath = isDev
      ? path.join(process.cwd(), 'db', 'db2_final.db')
      : path.join(process.resourcesPath, 'db', 'db2_final.db');
    openDB(dbPath);
    console.log('DB opened:', dbPath);
  } catch (e) {
    console.warn('Не удалось открыть БД:', e.message);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', (event, name) => {
  return app.getPath(name);
});


ipcMain.handle('templates:search', (_e, q) => searchTemplates(q));
ipcMain.handle('templates:get', (_e, id) => getTemplate(id));
ipcMain.handle('templates:requiredFor', (_e, id) => getRequiredPredecessors(id));
ipcMain.handle('templates:getAllRequired', () => getAllRequiredTemplates());

app.setAsDefaultProtocolClient('spu');


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

