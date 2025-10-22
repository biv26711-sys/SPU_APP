const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),

  onMenuNewProject:   (cb) => ipcRenderer.on('menu-new-project', cb),
  onMenuOpenProject:  (cb) => ipcRenderer.on('menu-open-project', cb),
  onMenuSaveProject:  (cb) => ipcRenderer.on('menu-save-project', cb),
  onMenuExportCSV:    (cb) => ipcRenderer.on('menu-export-csv', cb),
  onMenuExportExcel:  (cb) => ipcRenderer.on('menu-export-excel', cb),
  onMenuCalculate:    (cb) => ipcRenderer.on('menu-calculate', cb),
  onMenuClearAll:     (cb) => ipcRenderer.on('menu-clear-all', cb),
  onMenuShowHelp:     (cb) => ipcRenderer.on('menu-show-help', cb),
  onMenuShowGost:     (cb) => ipcRenderer.on('menu-show-gost', cb),

  
  onMenuLoadExampleBasic:    (cb) => ipcRenderer.on('menu-load-example-basic', cb),
  onMenuExportWord:   (cb) => ipcRenderer.on('menu-export-word', cb),
  onMenuLoadExampleRequired: (cb) => ipcRenderer.on('menu-load-example-required', cb),


  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  isElectron: true,
  platform: process.platform,
});


contextBridge.exposeInMainWorld('api', {
  templates: {
    search:        (q)  => ipcRenderer.invoke('templates:search', q),
    get:           (id) => ipcRenderer.invoke('templates:get', id),
    requiredFor:   (id) => ipcRenderer.invoke('templates:requiredFor', id),
    getAllRequired:      ()  => ipcRenderer.invoke('templates:getAllRequired'),
  },
  showSaveDialog: async (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: async (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
});


console.log('Preload script loaded successfully');
