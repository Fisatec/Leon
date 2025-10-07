const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /* ===== Fenster ===== */
  minimize: () => ipcRenderer.send('window:minimize'),
  close:    () => ipcRenderer.send('window:close'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  /* ===== Build ===== */
  generateApp: (config) => ipcRenderer.send('generate-app', config),
  cancelGeneration: () => ipcRenderer.send('generation-cancel'),
  onBuildProgress: (cb) => ipcRenderer.on('build-progress', (_e, data) => cb?.(data)),
  onGenerationDone: (cb) => ipcRenderer.on('generation-done', (_e, data) => cb?.(data)),

  /* ===== Custom-Settings (Fenstergröße) ===== */
  openCustomSettings: (initial) => ipcRenderer.invoke('custom-settings:open', initial),
  onCustomSettingsInit: (cb) => ipcRenderer.on('custom-settings:init', (_e, initial) => cb?.(initial)),
  saveCustomSettings: (data) => ipcRenderer.send('custom-settings:save', data),
  cancelCustomSettings: () => ipcRenderer.send('custom-settings:cancel'),

  /* ===== Titlebar-Settings ===== */
  openTitlebarSettings: (initial) => ipcRenderer.invoke('titlebar-settings:open', initial),
  onTitlebarSettingsInit: (cb) => ipcRenderer.on('titlebar-settings:init', (_e, initial) => cb?.(initial)),
  saveTitlebarSettings: (data) => ipcRenderer.send('titlebar-settings:save', data),
  cancelTitlebarSettings: () => ipcRenderer.send('titlebar-settings:cancel'),

  /* ===== Datei-Picker / Pfade ===== */
  pickIcon: () => ipcRenderer.invoke('pick-icon'),
  pickAsset: () => ipcRenderer.invoke('pick-asset'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),

  /* ===== Extern ===== */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  /* ===== Utils ===== */
  isValidURL: (url) => /^https?:\/\//i.test(url),
  domainExists: (hostname) => ipcRenderer.invoke('net:domain-exists', hostname),

  /* ===== UI-Dim ===== */
  onUIDim: (cb) => ipcRenderer.on('ui:dim', () => cb?.()),
  onUIUndim: (cb) => ipcRenderer.on('ui:undim', () => cb?.())
});
