const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); 
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
    : `file://${path.join(__dirname, 'index.html' )}`;
  
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
          click: async () => {
            const response = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['Да', 'Нет'],
              title: 'Подтверждение',
              message: 'Вы уверены, что хотите создать новый проект? Все несохраненные данные будут потеряны.'
            });
            if (response.response === 0) { 
              mainWindow.webContents.send('menu-new-project');
            }
          }
        },
        {
          label: 'Открыть проект',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'SPU Project Files', extensions: ['spu'] },
                { name: 'JSON Files', extensions: ['json'] },
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
        {
          label: 'Экспорт в Word',
          click: () => {
            mainWindow.webContents.send('menu-export-word');
          }
        },
       
        { type: 'separator' },
        {
          label: process.platform === 'darwin' ? 'Выход из программы' : 'Выход',
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
        { label: 'Отменить', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.undo() },
        { label: 'Повторить', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.redo() },
        { type: 'separator' },
        { label: 'Вырезать', accelerator: 'CmdOrCtrl+X', click: () => mainWindow.webContents.cut() },
        { label: 'Копировать', accelerator: 'CmdOrCtrl+C', click: () => mainWindow.webContents.copy() },
        { label: 'Вставить', accelerator: 'CmdOrCtrl+V', click: () => mainWindow.webContents.paste() },
        { label: 'Выделить все', accelerator: 'CmdOrCtrl+A', click: () => mainWindow.webContents.selectAll() }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.reload() },
        { label: 'Принудительная перезагрузка', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow.webContents.reloadIgnoringCache() },
        { label: 'Инструменты разработчика', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Сбросить масштаб', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomFactor(1) },
        { label: 'Увеличить', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1) },
        { label: 'Уменьшить', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() - 0.1) },
        { type: 'separator' },
        { label: 'Полноэкранный режим', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) }
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
          click: async () => {
            const response = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['Да', 'Нет'],
              title: 'Подтверждение',
              message: 'Вы уверены, что хотите очистить все данные? Это действие необратимо.'
            });
            if (response.response === 0) {
              mainWindow.webContents.send('menu-clear-all');
            }
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
          label: 'Руководство пользователя',
          accelerator: 'F1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-show-help');
            }
          }
        },
        {
        label: 'ГОСТ ЕСПД',
        accelerator: 'F2',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('menu-show-gost'); 
          }
        }
      },
        { type: 'separator' }, 
   
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'Программа для сетевого планирования и управления',
              detail: 'Версия 1.0.0\n\nСистема для расчета параметров сетевого графика и построения диаграмм.\n\nРазработано для студентов ИДБ.',
              buttons: ['OK']
            });
          }
        },
        
      ]
    }
  ];

  
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'О программе' },
        { type: 'separator' },
        { role: 'services', label: 'Службы', submenu: [] },
        { type: 'separator' },
        { role: 'hide', label: 'Скрыть программу' },
        { role: 'hideothers', label: 'Скрыть остальные' },
        { role: 'unhide', label: 'Показать все' },
        { type: 'separator' },
        { role: 'quit', label: 'Выйти из программы' }
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
 
    const dbPath = app.isPackaged
   
       ? path.join(process.resourcesPath, 'db', 'db2_final.db') 
      : path.join(__dirname, '..', 'db', 'db2_final.db'); 

    if (!fs.existsSync(dbPath)) {
      throw new Error(`Файл базы данных не найден по пути: ${dbPath}`);
    }

    openDB(dbPath);
    console.log('DB opened:', dbPath);
  } catch (e) {
    console.warn('Не удалось открыть БД:', e.message);
  }
  createWindow();
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


ipcMain.handle('save-file', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    console.error('Failed to read file:', error);
    return { success: false, error: error.message };
  }
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
