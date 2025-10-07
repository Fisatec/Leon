const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, exec } = require('child_process');
const dns = require('dns').promises;

let currentTempDir = null;
let buildProcess = null;
let isGenerating = false;
let abortedByUser = false;

/* ========== Helpers ========== */

function httpDownloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const seen = new Set();
    const doGet = (u) => {
      if (seen.has(u)) return reject(new Error('Redirect loop'));
      seen.add(u);
      https.get(u, (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          return doGet(headers.location);
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${statusCode} for ${u}`));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    };
    doGet(url);
  });
}

/** bevorzugt 256px PNG (Google S2) -> ICO; Fallback: /favicon.ico */
async function getFaviconIco(siteUrl, tempDir) {
  try {
    const u = new URL(siteUrl);

    // 1) Google S2 256px -> ICO
    try {
      const pngBuf = await httpDownloadBuffer(
        `https://www.google.com/s2/favicons?sz=256&domain=${u.hostname}`
      );
      if (pngBuf?.length) {
        const { default: toIco } = await import('png-to-ico');
        const icoBuf = await toIco(pngBuf);
        const icoPath = path.join(tempDir, 'icon.ico');
        fs.writeFileSync(icoPath, icoBuf);
        return icoPath;
      }
    } catch (e) {
      console.warn('S2-Favicon fehlgeschlagen, versuche /favicon.ico …', e?.message || e);
    }

    // 2) Fallback: /favicon.ico
    try {
      const icoRaw = await httpDownloadBuffer(`${u.origin}/favicon.ico`);
      if (icoRaw?.length) {
        const icoPath = path.join(tempDir, 'icon.ico');
        fs.writeFileSync(icoPath, icoRaw);
        return icoPath;
      }
    } catch {}
  } catch (e) {
    console.error('Favicon-Fehler (URL unbrauchbar o.ä.):', e);
  }
  return undefined;
}

async function cleanupTemp(tempPath) {
  if (!tempPath || !fs.existsSync(tempPath)) return;
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `rmdir /s /q "${tempPath.replace(/"/g, '""')}"`
      : `rm -rf "${tempPath}"`;
    exec(cmd, () => resolve());
  });
}

async function killProcessTree(pid) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? `taskkill /pid ${pid} /T /F` : `pkill -P ${pid} && kill -9 ${pid}`;
    exec(command, () => resolve());
  });
}

function runCommandLive({ cmd, args = [], cwd, onData, onError, onClose }) {
  const child = spawn(cmd, args, {
    cwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, CI: 'true' }
  });
  child.stdout.on('data', (d) => onData?.(d.toString()));
  child.stderr.on('data', (d) => onError?.(d.toString()));
  child.on('close', (code) => onClose?.(code));
  return child;
}

/* ========== DNS Utils (für Renderer) ========== */
ipcMain.handle('net:domain-exists', async (_event, hostname) => {
  if (!hostname) return { ok: true, exists: false };
  try {
    await dns.lookup(hostname, { all: true });
    return { ok: true, exists: true };
  } catch {
    return { ok: true, exists: false };
  }
});

/* ========== Main Window ========== */

function createWindow() {
  const win = new BrowserWindow({
    width: 690,
    height: 860,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile('renderer/index.html');

  ipcMain.on('show-context-menu', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Minimieren', click: () => win.minimize() },
      { label: 'Schließen', click: () => win.close() }
    ]);
    menu.popup({ window: win });
  });

  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:close', () => win.close());
}

/* ========== Custom Settings Window ========== */

function openCustomSettingsWindow(parent, initial) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      width: 480,
      height: 440,
      resizable: false,
      frame: false,
      backgroundColor: initial?.isDark ? '#2a2a2a' : '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    win.loadFile('renderer/custom-settings.html');
    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('custom-settings:init', initial || {});
    });

    const onSave = (_e, data) => { cleanup(); resolve({ saved: true, data }); };
    const onCancel = () => { cleanup(); resolve({ saved: false }); };

    function cleanup() {
      ipcMain.removeListener('custom-settings:save', onSave);
      ipcMain.removeListener('custom-settings:cancel', onCancel);
      if (!win.isDestroyed()) win.close();
    }

    ipcMain.on('custom-settings:save', onSave);
    ipcMain.on('custom-settings:cancel', onCancel);

    win.on('closed', () => resolve({ saved: false }));
  });
}

ipcMain.handle('custom-settings:open', async (event, initial) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    parent?.webContents.send('ui:dim');
    const res = await openCustomSettingsWindow(parent, initial);
    return res;
  } finally {
    parent?.webContents.send('ui:undim');
  }
});

/* ========== Titlebar Settings Window (feste Größe) ========== */

function openTitlebarSettingsWindow(parent, initial) {
  return new Promise((resolve) => {
    const WIDTH = 640;
    const HEIGHT = 760;

    const win = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      width: WIDTH,
      height: HEIGHT,
      resizable: false,
      frame: false,
      backgroundColor: initial?.isDark ? '#2a2a2a' : '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    win.loadFile('renderer/titlebar-settings.html');
    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('titlebar-settings:init', initial || {});
    });

    const onSave = (_e, data) => { cleanup(); resolve({ saved: true, data }); };
    const onCancel = () => { cleanup(); resolve({ saved: false }); };

    function cleanup() {
      ipcMain.removeListener('titlebar-settings:save', onSave);
      ipcMain.removeListener('titlebar-settings:cancel', onCancel);
      if (!win.isDestroyed()) win.close();
    }

    ipcMain.on('titlebar-settings:save', onSave);
    ipcMain.on('titlebar-settings:cancel', onCancel);

    win.on('closed', () => resolve({ saved: false }));
  });
}

ipcMain.handle('titlebar-settings:open', async (event, initial) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    parent?.webContents.send('ui:dim');
    const res = await openTitlebarSettingsWindow(parent, initial);
    return res;
  } finally {
    parent?.webContents.send('ui:undim');
  }
});

/* ========== Datei-Picker ========== */

ipcMain.handle('pick-icon', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Eigenes Icon wählen',
    filters: [{ name: 'Icon', extensions: ['ico', 'png'] }],
    properties: ['openFile']
  });
  if (res.canceled || res.filePaths.length === 0) return { canceled: true };
  const filePath = res.filePaths[0];
  const buf = fs.readFileSync(filePath);
  return {
    canceled: false,
    name: path.basename(filePath),
    buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  };
});

ipcMain.handle('pick-asset', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Button-Datei wählen (.png oder .ico)',
    filters: [{ name: 'Grafik', extensions: ['png', 'ico'] }],
    properties: ['openFile']
  });
  if (res.canceled || res.filePaths.length === 0) return { canceled: true };
  const filePath = res.filePaths[0];
  const buf = fs.readFileSync(filePath);
  return {
    canceled: false,
    name: path.basename(filePath),
    ext: path.extname(filePath).slice(1).toLowerCase(),
    buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  };
});

/* ========== Pfad öffnen ========== */
ipcMain.handle('open-path', async (_e, folderPath) => {
  if (!folderPath) return { ok: false };
  await shell.openPath(folderPath);
  return { ok: true };
});

// Externe Links (PayPal etc.) im Standardbrowser öffnen
ipcMain.handle('open-external', async (_e, url) => {
  try {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
      return { ok: true };
    }
  } catch {}
  return { ok: false };
});


/* ========== Generate App ========== */

ipcMain.on('generate-app', async (event, config) => {
  if (isGenerating) return;
  isGenerating = true;
  abortedByUser = false;

  const sendProgress = (msg) => event.sender.send('build-progress', { message: msg });

  try {

    const result = await dialog.showOpenDialog({
      title: 'Speicherort für App wählen',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      isGenerating = false;
      return event.sender.send('generation-done', { aborted: true, userAborted: true });
    }

    const targetDir = result.filePaths[0];
    const tempDir = path.join(app.getPath('temp'), `build_${Date.now()}`);
    fs.mkdirSync(tempDir);
    currentTempDir = tempDir;

    // Icon bestimmen
	let iconPath;
	let usedCustomIcon = false;

	if (config.icoBuffer && config.icoBuffer.byteLength > 0) {
	  iconPath = path.join(tempDir, 'icon.ico');
	  fs.writeFileSync(iconPath, Buffer.from(config.icoBuffer));
	  usedCustomIcon = true;
	} else {
	  iconPath = await getFaviconIco(config.url, tempDir);
	}

	// Log-Eintrag
	if (usedCustomIcon) {
	  sendProgress('Benutzerdefiniertes Icon wird verwendet!');
	} else if (iconPath) {
	  sendProgress('Favicon wird verwendet!');
	} else {
	  sendProgress('Kein Icon gefunden, Favicon wird genutzt!');
	}

    const useFrameless = !config.frame;

    // 1) App main.js (für die generierte App)
    const genMainJsContent = useFrameless
      ? `
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWin;

// === Window-State Persistenz ===
const storePath = path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch { return {}; }
}
function saveState(bounds) {
  try { fs.writeFileSync(storePath, JSON.stringify(bounds)); } catch {}
}

function createWindow() {
  const state = loadState();
  mainWin = new BrowserWindow({
    x: Number.isFinite(state.x) ? state.x : undefined,
    y: Number.isFinite(state.y) ? state.y : undefined,
    width: Number.isFinite(state.width) ? state.width : ${config.custom.width},
    height: Number.isFinite(state.height) ? state.height : ${config.custom.height},
    resizable: ${config.custom.resizable},
    minimizable: ${config.custom.minimizable},
    maximizable: ${config.custom.maximizable},
    frame: false,
    useContentSize: true,
    icon: ${iconPath ? `path.join(__dirname, 'icon.ico')` : 'undefined'},
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true
    }
  });

  // Falls keine Position gespeichert: zentrieren
  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
    mainWin.center();
  }

  mainWin.loadFile('index.html');

  // Fensterstatus in Renderer melden (für Max/Restore-Icon)
  mainWin.on('maximize', () => mainWin.webContents.send('window-state', 'maximized'));
  mainWin.on('unmaximize', () => mainWin.webContents.send('window-state', 'restored'));

  // Größe/Position beim Schließen sichern (nur wenn resizable und nicht min/max)
  mainWin.on('close', () => {
    if (${config.custom.resizable} && !mainWin.isMinimized() && !mainWin.isMaximized()) {
      saveState(mainWin.getBounds());
    }
  });
}

// Window Controls & OpenExternal
ipcMain.handle('window-control', (_e, action) => {
  if (!mainWin) return;
  if (action === 'minimize') mainWin.minimize();
  else if (action === 'toggle-max') {
    if (mainWin.isMaximized()) mainWin.unmaximize();
    else mainWin.maximize();
  } else if (action === 'close') mainWin.close();
  else if (action === 'request-state') {
    mainWin.webContents.send('window-state', mainWin.isMaximized() ? 'maximized' : 'restored');
  }
});
ipcMain.handle('open-external', async (_e, url) => {
  if (typeof url === 'string') { await shell.openExternal(url); return true; }
  return false;
});

app.whenReady().then(createWindow);
`.trim()
      : `
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

// === Window-State Persistenz ===
const storePath = path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch { return {}; }
}
function saveState(bounds) {
  try { fs.writeFileSync(storePath, JSON.stringify(bounds)); } catch {}
}

function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: Number.isFinite(state.x) ? state.x : undefined,
    y: Number.isFinite(state.y) ? state.y : undefined,
    width: Number.isFinite(state.width) ? state.width : ${config.custom.width},
    height: Number.isFinite(state.height) ? state.height : ${config.custom.height},
    resizable: ${config.custom.resizable},
    minimizable: ${config.custom.minimizable},
    maximizable: ${config.custom.maximizable},
    frame: ${config.frame},
    icon: ${iconPath ? `path.join(__dirname, 'icon.ico')` : 'undefined'},
    webPreferences: { 
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
    win.center();
  }

  win.loadURL("${config.url}");
  
  // Scrollbar-Option (Generator setzt true/false ein)
  const NO_SCROLLBAR = ${config.custom.noScrollbar ? 'true' : 'false'};

  if (NO_SCROLLBAR) {
    const CSS = \`
      /* Page-Scrollbar verstecken, Scrollen per Rad/Tasten bleibt möglich */
      html, body { overflow: hidden !important; scrollbar-width: none !important; }
      /* WebKit */
      ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
    \`;
    const apply = () => { try { win.webContents.insertCSS(CSS); } catch {} };
    win.webContents.on('did-finish-load', apply);
    win.webContents.on('dom-ready', apply);
  }  

  win.on('close', () => {
    if (${config.custom.resizable} && !win.isMinimized() && !win.isMaximized()) {
      saveState(win.getBounds());
    }
  });
}
app.whenReady().then(createWindow);
`.trim();

    const productName = config.name || 'WebApp';
    const pkgName = (config.name || 'webapp').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const pkgAppId = `com.generated.${(config.name || 'webapp').toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const packageJson = {
      name: pkgName || 'webapp',
      version: "1.0.0",
      description: `Packaged site: ${config.url}`,
      author: "Léon by Fisatec",
      main: "main.js",
      scripts: { start: "electron .", build: "electron-builder" },
      build: {
        appId: pkgAppId,
        productName,
        directories: { output: "dist" },
        files: ["**/*"],
        artifactName: "${productName}.${ext}",
        win: { target: "portable", ...(iconPath ? { icon: "icon.ico" } : {}) }
      },
      devDependencies: {
        electron: "^29.0.0",
        "electron-builder": "^24.0.0"
      }
    };

    fs.writeFileSync(path.join(tempDir, 'main.js'), genMainJsContent);
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    if (iconPath) fs.copyFileSync(iconPath, path.join(tempDir, 'icon.ico'));

    if (useFrameless) {
      // 2) preload.js für die generierte App
      const genPreload = `
        const { contextBridge, ipcRenderer } = require('electron');
        contextBridge.exposeInMainWorld('appWindow', {
          control: (action) => ipcRenderer.invoke('window-control', action),
          onState: (cb) => ipcRenderer.on('window-state', (_e, s) => cb?.(s)),
          openExternal: (url) => ipcRenderer.invoke('open-external', url)
        });
      `.trim();
      fs.writeFileSync(path.join(tempDir, 'preload.js'), genPreload);

      // 3) index.html für die generierte App (Topbar + Webview)
      const topbarMode = (config.titlebar?.mode === 'custom') ? 'custom' : 'svg';
      const topbarTheme = (config.titlebar?.theme === 'dark') ? 'dark' : 'light';
      const svgColor = config.titlebar?.color || '#6b7280';
      const targetURL = config.url.replace(/"/g, '&quot;');  

      // --- Custom Buttons speichern (falls gewählt) ---
      let customButtons = {};
      if (topbarMode === 'custom' && config.titlebar?.assets) {
        for (const [key, item] of Object.entries(config.titlebar.assets)) {
          if (!item?.buffer) continue;
          const safeName = `btn-${key}.${item.type === 'image/x-icon' ? 'ico' : 'png'}`;
          const filePath = path.join(tempDir, safeName);
          fs.writeFileSync(filePath, Buffer.from(item.buffer));
          customButtons[key] = safeName;
        }
      }

      // --- Hilfsfunktion zum Generieren des Button-HTML ---
      function buttonHtml(id, title, key, svg) {
        // Speziell für maximize/restore: EIN Button, Bild wird später je nach Zustand umgeschaltet
        if (topbarMode === 'custom') {
          if (key === 'maximize') {
            const maxImg = customButtons['maximize'] || '';
            const restImg = customButtons['restore'] || '';
            if (maxImg || restImg) {
              const startImg = maxImg || restImg; // im Normalzustand bevorzugt "maximize"
              return `<button class="btn" id="${id}" title="${title}" aria-label="${title}"
                        data-max-img="${maxImg}" data-restore-img="${restImg}">
                        <img src="${startImg}" alt="maximize-restore" />
                      </button>`;
            }
          }
          if (customButtons[key]) {
            return `<button class="btn" id="${id}" title="${title}" aria-label="${title}">
                      <img src="${customButtons[key]}" alt="${key}" />
                    </button>`;
          }
        }
        // Fallback: SVG
        return `<button class="btn" id="${id}" title="${title}" aria-label="${title}">${svg}</button>`;
      }

      const genIndexHtml = `
  <!doctype html>
  <html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${productName}</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' https: http: data: blob:; style-src 'self' 'unsafe-inline'; img-src * data: blob:; script-src 'self' 'unsafe-inline';">
    <style>
      :root{
        --tb-bg:${topbarTheme==='dark' ? '#1f1f1f':'#ffffff'};
        --tb-fg:${topbarTheme==='dark' ? '#eee':'#222'};
        --tb-border:${topbarTheme==='dark' ? 'rgba(255,255,255,0.12)':'rgba(0,0,0,0.08)'};
        --icon:${svgColor};
        --max-offset: -7px; /* default, wird vom Script ggf. überschrieben */
      }
      html,body{height:100%;margin:0}
      body{display:flex;flex-direction:column;background:var(--tb-bg);color:var(--tb-fg)}
      /* Topbar fixed, damit es immer am Fensteroberrand sitzt */
      .topbar{
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height:42px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:0 10px;
        border-bottom:1px solid var(--tb-border);
        -webkit-app-region:drag;
        z-index: 9999;
        background: var(--tb-bg);
      }
      .group{display:flex;gap:8px}
      .btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;border-radius:8px;background:transparent;color:var(--icon);cursor:pointer;-webkit-app-region:no-drag}
      .btn:hover{background:rgba(127,127,127,0.12)}
      .btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
      .btn img{width:20px;height:20px;display:block}
      /* Content sitzt unterhalb der Topbar (Basisabstand = Höhe der Topbar) */
      #content{flex:1 1 auto; min-height:0; display:flex; margin-top:42px}
      webview{flex:1 1 auto; width:100%; height:100%}
      /* Wenn maximiert: kompensiere platform-spezifisches Inset */
      body.maximized .topbar {
        transform: translateY(var(--max-offset));
        box-shadow: none;
      }
      /* Content entsprechend anpassen (margin-top minus Offset) */
      body.maximized #content {
        margin-top: calc(42px + var(--max-offset)); /* var(--max-offset) ist negativ */
      }

      /* macOS notch / safe-area support: füge padding oben hinzu falls erforderlich */
      .topbar { padding-top: env(safe-area-inset-top); }
      body.maximized .topbar { padding-top: env(safe-area-inset-top); }
    </style>
  </head>
  <body>
    <div class="topbar">
      <div class="group" id="left">
        ${buttonHtml('btn-back', 'Zurück', 'back', `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`)}
        ${buttonHtml('btn-forward', 'Vor', 'forward', `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`)}
        ${buttonHtml('btn-reload', 'Neu laden', 'reload', `<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" /><path d="M20.49 15A9 9 0 0 1 5.87 18.36L1 14" /></svg>`)}
      </div>
      <div class="group" id="right">
        ${config.custom.minimizable ? buttonHtml('btn-min', 'Minimieren', 'minimize', `<svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="19"/></svg>`): ''}
        ${config.custom.maximizable ? buttonHtml('btn-max', 'Maximieren/Wiederherstellen', 'maximize', `<svg id="ico-max" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`): ''}
        ${buttonHtml('btn-close', 'Schließen', 'close', `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`)}
      </div>
    </div> 
    <div id="content">
      <webview id="wv" src="${targetURL}" allowpopups partition="persist:léon"></webview>
    </div>
    <script>
      (function () {
        const PLATFORM = '${process.platform}'; // 'win32','linux','darwin'
        const MAP = { win32: '-8px', linux: '-6px', darwin: '0px' };
        try {
          const offset = MAP[PLATFORM] ?? MAP.linux ?? '-8px';
          document.documentElement.style.setProperty('--max-offset', offset);
        } catch (e) {}

        const wv = document.getElementById('wv');

        const NO_SCROLLBAR = ${config.custom.noScrollbar ? 'true' : 'false'};

        if (NO_SCROLLBAR && wv) {
          const css = \`
             ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
             html, body { scrollbar-width: none !important; }
          \`;
          const apply = () => wv.insertCSS(css).catch(() => {});
          wv.addEventListener('did-finish-load', apply);
          wv.addEventListener('dom-ready', apply);
        }

        document.getElementById('btn-back')?.addEventListener('click', () => { try { wv.canGoBack() && wv.goBack(); } catch {} });
        document.getElementById('btn-forward')?.addEventListener('click', () => { try { wv.canGoForward() && wv.goForward(); } catch {} });
        document.getElementById('btn-reload')?.addEventListener('click', () => { try { wv.reload(); } catch {} });

        document.getElementById('btn-min')?.addEventListener('click', () => window.appWindow?.control('minimize'));
        const maxBtn = document.getElementById('btn-max');
        maxBtn?.addEventListener('click', () => window.appWindow?.control('toggle-max'));
        document.getElementById('btn-close')?.addEventListener('click', () => window.appWindow?.control('close'));

        const MODE = '${topbarMode}'; // 'custom' | 'svg'

        // Initialen Zustand anfragen (damit direkt das richtige Icon gezeigt wird)
        window.appWindow?.control('request-state');

        // Zustand -> Icon umschalten + body maximized-class setzen
        window.appWindow?.onState?.((s) => {
          try {
            if (s === 'maximized') document.body.classList.add('maximized');
            else document.body.classList.remove('maximized');
          } catch (e) {}

          if (!maxBtn) return;

          if (MODE === 'custom') {
            const imgEl = maxBtn.querySelector('img');
            const maxImg = maxBtn.getAttribute('data-max-img') || '';
            const restImg = maxBtn.getAttribute('data-restore-img') || '';

            if (imgEl) {
              if (s === 'maximized') {
                // bevorzugt Restore-Bild, ansonsten Max-Bild
                imgEl.src = restImg || maxImg || imgEl.src;
              } else {
                // bevorzugt Max-Bild, ansonsten Restore-Bild
                imgEl.src = maxImg || restImg || imgEl.src;
              }
            }
          } else {
            // SVG-Modus
            if (s === 'maximized') {
              maxBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="10" rx="1"/><path d="M9 7h8a1 1 0 0 1 1 1v8"/></svg>';
            } else {
              maxBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
            }
          }
        });

        // Popups im Standardbrowser öffnen
        wv?.addEventListener('new-window', (e) => window.appWindow?.openExternal?.(e.url));
      })();
    </script>
  </body>
  </html>
      `.trim();

      fs.writeFileSync(path.join(tempDir, 'index.html'), genIndexHtml);
    }

    // ---- npm install ----
    sendProgress('Installiere Abhängigkeiten...');

    let lastErrors = [];
    const pushErr = (line) => {
      lastErrors.push(line);
      if (lastErrors.length > 200) lastErrors.shift();
    };

    buildProcess = runCommandLive({
      cmd: 'npm',
      args: ['install', '--no-fund', '--no-audit', '--loglevel=error'],
      cwd: tempDir,
      onData: (_line) => {},                 // UI-Log stumm
      onError: (line) => { pushErr(line); }, // Fehler sammeln
      onClose: (code) => {
        if (code !== 0) {
          isGenerating = false;
          cleanupTemp(tempDir).then(() => {
            event.sender.send('generation-done', {
              aborted: true, userAborted: abortedByUser,
              errorMessage: `npm install exit code ${code}\n\n${lastErrors.join('')}`
            });
          });
          return;
        }

        // ---- build ----
        // Log-Eintrag mit App-Name
        sendProgress(`Erstelle Anwendung "${productName}.exe"`);

        lastErrors = [];
        buildProcess = runCommandLive({
          cmd: 'npm',
          args: ['run', 'build'],
          cwd: tempDir,
          onData: (_line) => {},                 // UI-Log stumm
          onError: (line) => { pushErr(line); }, // Fehler sammeln
          onClose: (code2) => {
            isGenerating = false;
            if (code2 !== 0) {
              cleanupTemp(tempDir).then(() => {
                event.sender.send('generation-done', {
                  aborted: true, userAborted: abortedByUser,
                  errorMessage: `electron-builder exit code ${code2}\n\n${lastErrors.join('')}`
                });
              });
              return;
            }

            // EXE kopieren
            const distDir = path.join(tempDir, 'dist');
            let exePathOut = null;
            if (fs.existsSync(distDir)) {
              const files = fs.readdirSync(distDir);
              const exeFile = files.find(f => f.endsWith('.exe'));
              if (exeFile) {
                const sourcePath = path.join(distDir, exeFile);
                const targetPath = path.join(targetDir, exeFile);
                fs.copyFileSync(sourcePath, targetPath);
                exePathOut = targetPath;
              }
            }

            // Erfolgsmeldung
            sendProgress('Erfolgreich erstellt!');

            event.sender.send('generation-done', {
              exePath: exePathOut,
              folderPath: exePathOut ? path.dirname(exePathOut) : targetDir,
              aborted: false,
              userAborted: false
            });

            cleanupTemp(tempDir);
          }
        });
      }
    });

    buildProcess.on?.('close', () => { isGenerating = false; });

  } catch (err) {
    isGenerating = false;
    event.sender.send('build-progress', { message: `Fehler: ${err.message}` });
    cleanupTemp(currentTempDir).then(() => {
      event.sender.send('generation-done', { aborted: true, userAborted: abortedByUser, errorMessage: err.message });
    });
  }
});

/* ========== Cancel ========== */

ipcMain.on('generation-cancel', async (event) => {
  if (!isGenerating) {
    return event.sender.send('generation-done', { aborted: true, userAborted: true });
  }
  abortedByUser = true;

  try {
    if (buildProcess?.pid) await killProcessTree(buildProcess.pid);
    if (currentTempDir) await cleanupTemp(currentTempDir);
  } catch (e) {
  } finally {
    isGenerating = false;
    event.sender.send('generation-done', { aborted: true, userAborted: true });
  }
});

app.whenReady().then(createWindow);
