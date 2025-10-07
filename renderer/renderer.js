let generationInProgress = false;

/* ===== Fenstersteuerung ===== */
document.getElementById('min-btn')?.addEventListener('click', () => window.api?.minimize?.());
document.getElementById('close-btn')?.addEventListener('click', () => window.api?.close?.());

/* ===== Externe Links (PayPal etc.) ===== */
document.addEventListener('click', (e) => {
  const a = e.target?.closest?.('a[data-external]');
  if (a && a.href) {
    e.preventDefault();
    window.api?.openExternal?.(a.href);
  }
});

/* ===== URL, Favicon & Icon-Override ===== */
const urlInput = document.getElementById('url');
const appNameInput = document.getElementById('appName');

const faviconPreview = document.getElementById('faviconPreview');
const faviconPreviewContainer = document.getElementById('faviconPreviewContainer');
const chooseCustomIconLink = document.getElementById('chooseCustomIcon');
const clearCustomIconLink = document.getElementById('clearCustomIcon');
const customIconNote = document.getElementById('customIconNote');

let customIconBuffer = null;
let customIconObjectUrl = null;
const DEFAULT_ICON_PATH = "../assets/no-icon.png";

/* Fallback, falls no-icon.png fehlt (eingebettetes neutrales SVG) */
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="6" y="6" width="52" height="52" rx="10" fill="#fff" stroke="#c8d1dc" />
  <path d="M20 42 L44 42 L44 22 L20 22 Z" fill="none" stroke="#a3b1c6" stroke-width="2" stroke-dasharray="4 3"/>
  <circle cx="26" cy="28" r="3" fill="#a3b1c6"/>
  <path d="M20 42 L30 34 L36 38 L44 30" fill="none" stroke="#a3b1c6" stroke-width="2"/>
</svg>`;
const PLACEHOLDER_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(FALLBACK_SVG);

let previewSeq = 0;

/* ===== I18n ===== */
const translations = {
  de: {
    // Header + Labels
    title: "Léon - App Generator",
    appNameLabel: "📝 App-Name:",
    urlLabel: "🔗 Website-URL:",
    placeholderName: "z. B. MyDesktopApp",
    placeholderUrl: "https://example.com",
    faviconTitle: "🔍 Favicon",
    faviconHint: "Hinweis: Wenn verfügbar, wird automatisch ein 256×256-Icon verwendet",
    altIcon: "Alternativ: eigenes Icon (.ico/.png) wählen",
    removeIcon: "Entfernen",
    customIconChosen: (name) => `Eigenes Icon gewählt: ${name} (überschreibt Favicon)`,

    // Window size select
    windowSizeLabel: "🪟 Fenstergröße:",
    windowSizeOpts: {
      resizable: "Normal (resizable)",
      mobile: "Mobile App (375x670, fix)",
      custom: "Benutzerdefinierte Einstellungen"
    },

    // Frame select
    frameLabel: "🖼️ Titelleiste:",
    frameOpts: { true: "System", false: "Benutzerdefinierte Einstellungen" },

    // Buttons
    generateBtn: "🚀 App erstellen",

    // Modal
    modalRunning: "⏳ Erstellung läuft...",
    modalOpenFile: "Datei öffnen",
    modalOpenFolder: "Pfad öffnen",
    cancelBtn: "Abbrechen",
    closeBtn: "Schließen",

    // Summary helpers
    yes: "ja", no: "nein",
    noScrollbar: "ohne Scrollbar",
    svgSummary: (theme, color) => `SVG (färbbar), Theme: ${theme === 'dark' ? 'Dark' : 'Light'}, Farbe: ${color || '#6b7280'}`,
    customSummary: (chosen, total) => `Custom (.png/.ico), ${chosen}/${total} Dateien gewählt`,

    // Progress
    progressMapIn: [
      "Speicherort wählen...",
      "Favicon wird verwendet!",
      "Benutzerdefiniertes Icon wird verwendet!",
      "Kein Icon gefunden, Favicon wird genutzt!",
      "Installiere Abhängigkeiten...",
      "Erstelle Anwendung \"",
      "Erfolgreich erstellt!"
    ],
    doneSuccess: (path) => `App erfolgreich erstellt!<br><small>${path || ""}</small>`,
    doneError: (msg) => `Fehler bei der Erstellung${msg ? `<br><small>${msg}</small>` : ""}`,

    // Validation
    missingName: "Bitte einen App-Namen eingeben.",
    missingUrl: "Bitte eine Website-URL eingeben.",
    invalidUrl: "Keine gültige URL (mit http:// oder https://).",
    needCustomFirst: "Bitte zuerst die benutzerdefinierten Einstellungen festlegen."
  },
  en: {
    // Header + Labels
    title: "Léon - App Generator",
    appNameLabel: "📝 App name:",
    urlLabel: "🔗 Website URL:",
    placeholderName: "e.g. MyDesktopApp",
    placeholderUrl: "https://example.com",
    faviconTitle: "🔍 Favicon",
    faviconHint: "Note: If available, a 256×256 icon is used automatically",
    altIcon: "Alternatively: choose your own icon (.ico/.png)",
    removeIcon: "Remove",
    customIconChosen: (name) => `Custom icon selected: ${name} (overrides favicon)`,

    // Window size select
    windowSizeLabel: "🪟 Window size:",
    windowSizeOpts: {
      resizable: "Normal (resizable)",
      mobile: "Mobile app (375x670, fixed)",
      custom: "Custom settings"
    },

    // Frame select
    frameLabel: "🖼️ Titlebar:",
    frameOpts: { true: "System", false: "Custom settings" },

    // Buttons
    generateBtn: "🚀 Generate app",

    // Modal
    modalRunning: "⏳ Building...",
    modalOpenFile: "Open file",
    modalOpenFolder: "Open folder",
    cancelBtn: "Cancel",
    closeBtn: "Close",

    // Summary helpers
    yes: "yes", no: "no",
    noScrollbar: "no scrollbar",
    svgSummary: (theme, color) => `SVG (tintable), theme: ${theme === 'dark' ? 'Dark' : 'Light'}, color: ${color || '#6b7280'}`,
    customSummary: (chosen, total) => `Custom (.png/.ico), ${chosen}/${total} files selected`,

    // Progress (DE → EN map)
    progressMapIn: [
      "Speicherort wählen...",
      "Favicon wird verwendet!",
      "Benutzerdefiniertes Icon wird verwendet!",
      "Kein Icon gefunden, Favicon wird genutzt!",
      "Installiere Abhängigkeiten...",
      "Erstelle Anwendung \"",
      "Erfolgreich erstellt!"
    ],
    progressMapOut: {
      "Speicherort wählen...": "Choose destination...",
      "Favicon wird verwendet!": "Using favicon!",
      "Benutzerdefiniertes Icon wird verwendet!": "Using custom icon!",
      "Kein Icon gefunden, Favicon wird genutzt!": "No icon found, using favicon!",
      "Installiere Abhängigkeiten...": "Installing dependencies...",
      "Erstelle Anwendung \"": "Building application \"",
      "Erfolgreich erstellt!": "Build complete!"
    },
    doneSuccess: (path) => `App built successfully!<br><small>${path || ""}</small>`,
    doneError: (msg) => `Build failed${msg ? `<br><small>${msg}</small>` : ""}`,

    // Validation
    missingName: "Please enter an app name.",
    missingUrl: "Please enter a website URL.",
    invalidUrl: "Invalid URL (must start with http:// or https://).",
    needCustomFirst: "Please set the custom settings first."
  }
};

let currentLang = "de";

/* ===== Sprache anwenden ===== */
function applyTranslations() {
  const d = translations[currentLang];
  const setText = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };

  // Überschrift
  setText('h1 .text', d.title);

  // Labels & Platzhalter
  setText("label[for='appName']", d.appNameLabel);
  setText("label[for='url']", d.urlLabel);
  document.getElementById('appName')?.setAttribute('placeholder', d.placeholderName || '');
  document.getElementById('url')?.setAttribute('placeholder', d.placeholderUrl || '');

  // Favicon-Box
  setText(".favicon-title", d.faviconTitle);
  setText(".favicon-hint", d.faviconHint);
  const chooseLink = document.querySelector(".choose-icon-link");
  if (chooseLink) chooseLink.textContent = d.altIcon;
  const removeLink = document.getElementById('clearCustomIcon');
  if (removeLink) removeLink.textContent = d.removeIcon;

  // Window size
  setText("label[for='windowMode']", d.windowSizeLabel);
  const optRes = document.querySelector("#windowMode option[value='resizable']");
  const optMob = document.querySelector("#windowMode option[value='mobile']");
  const optCus = document.querySelector("#windowMode option[value='custom']");
  if (optRes) optRes.textContent = d.windowSizeOpts.resizable;
  if (optMob) optMob.textContent = d.windowSizeOpts.mobile;
  if (optCus) optCus.textContent = d.windowSizeOpts.custom;

  // Frame
  setText("label[for='frameOption']", d.frameLabel);
  const optSys = document.querySelector("#frameOption option[value='true']");
  const optFrm = document.querySelector("#frameOption option[value='false']");
  if (optSys) optSys.textContent = d.frameOpts.true;
  if (optFrm) optFrm.textContent = d.frameOpts.false;

  // Hauptbutton
  const genBtn = document.getElementById("generateBtn");
  if (genBtn) genBtn.textContent = d.generateBtn;

  // Modal-UI
  const modalText = document.querySelector(".modal-text");
  if (modalText) modalText.innerHTML = d.modalRunning;
  const of = document.getElementById('openFileBtn');
  if (of) of.textContent = d.modalOpenFile;
  const od = document.getElementById('openFolderBtn');
  if (od) od.textContent = d.modalOpenFolder;
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.textContent = d.cancelBtn;
  const closeBtn = document.querySelector(".close-btn");
  if (closeBtn) closeBtn.textContent = d.closeBtn;

  // HTML lang
  document.documentElement.setAttribute("lang", currentLang);

  // Summaries neu rendern (brauchen yes/no etc.)
  renderCustomSummary(currentCustomSettings);
  renderFrameSummary();
}

/* ===== Dark Mode (persistiert) ===== */
window.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('darkModeToggle');
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (toggle) toggle.checked = isDark;
  document.body.classList.toggle('dark', isDark);
  updateDonateImage();
  toggle?.addEventListener('change', (e) => {
    const enabled = !!e.target.checked;
    localStorage.setItem('darkMode', String(enabled));
    document.body.classList.toggle('dark', enabled);
    updateDonateImage();
    // Cache-bust Preview, damit Dark-Mode-Schatten etc. neu zeichnen
    if (faviconPreview?.src) {
      const u = new URL(faviconPreview.src, location.href);
      u.searchParams.set('t', String(Date.now()));
      faviconPreview.src = u.toString();
    }
  });

  // Start: Platzhalter & Remove-Link
  setPlaceholderPreview();
  hideRemoveLink();

  // Language Switcher
  const savedLang = localStorage.getItem('uiLang');
  if (savedLang && translations[savedLang]) currentLang = savedLang;
  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      if (lang && translations[lang]) {
        currentLang = lang;
        localStorage.setItem('uiLang', lang);
        document.querySelectorAll(".lang-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        applyTranslations();
      }
    });
  });

  // Initial anwenden
  applyTranslations();
});

/* ===== Helpers ===== */
function updateDonateImage() {
  const img = document.getElementById('donateImg');
  if (!img) return;
  const dark = document.body.classList.contains('dark');
  img.src = dark ? '../assets/paypal-donate_dark.png' : '../assets/paypal-donate_light.png';
}
function looksLikeDomain(s) {
  return /(^www\.)|([a-z0-9-]+\.[a-z]{2,})(\/|$)/i.test(s);
}
function ensureSchemeInInput(el) {
  const val = (el.value || '').trim();
  if (!val) return false;
  if (/^https?:\/\//i.test(val)) return false;
  if (!looksLikeDomain(val)) return false;
  const newVal = 'https://' + val.replace(/^\/+/, '');
  const start = el.selectionStart ?? newVal.length;
  const end = el.selectionEnd ?? newVal.length;
  el.value = newVal;
  const offset = 8;
  try { el.setSelectionRange(start + offset, end + offset); } catch {}
  return true;
}
function normalizeUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (looksLikeDomain(s)) return 'https://' + s.replace(/^\/+/, '');
  return s;
}
function debounce(fn, delay = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ===== App-Name: akzeptierte Zeichen + sofortige Validitäts-Aufhebung bei Eingabe ===== */
// Ungültige Windows-Dateiname-Zeichen: <>:"/\\|?* + Steuerzeichen (0-31)
const INVALID_FILENAME_RE = /[<>:"\/\\|?*\x00-\x1F]/g;
function sanitizeAppNameInput(value) {
  if (!value) return '';
  // Entferne unzulässige Zeichen
  let cleaned = value.replace(INVALID_FILENAME_RE, '');
  // Windows: Dateiname darf nicht mit Leerzeichen oder Punkt enden
  cleaned = cleaned.replace(/[. ]+$/g, '');
  // Vermeide führende/trailing Whitespaces (innerhalb erlaubt)
  return cleaned;
}

// Sobald der Nutzer tippt: bereinigen und Fehlermeldung entfernen, sobald mindestens 1 Zeichen vorhanden ist
appNameInput?.addEventListener('input', (e) => {
  const el = e.target;
  if (!el) return;
  const prev = el.value;
  const start = el.selectionStart ?? prev.length;
  const end = el.selectionEnd ?? prev.length;

  const cleaned = sanitizeAppNameInput(prev);
  if (cleaned !== prev) {
    const diff = prev.length - cleaned.length;
    const newStart = Math.max(0, start - diff);
    const newEnd = Math.max(0, end - diff);
    el.value = cleaned;
    try { el.setSelectionRange(newStart, newEnd); } catch {}
  }
  // Validierung sofort entfernen, sobald mindestens 1 Zeichen vorhanden ist
  if (cleaned.length > 0) {
    el.setCustomValidity('');
  }
});

/* ===== Remove-Link Helper ===== */
function showRemoveLink() {
  clearCustomIconLink?.classList.remove('hidden');
  if (clearCustomIconLink) clearCustomIconLink.style.display = '';
}
function hideRemoveLink() {
  clearCustomIconLink?.classList.add('hidden');
  if (clearCustomIconLink) clearCustomIconLink.style.display = 'none';
  if (customIconNote) customIconNote.textContent = '';
}

/* ===== Preview-Handler ===== */
function setPlaceholderPreview() {
  if (customIconObjectUrl) {
    URL.revokeObjectURL(customIconObjectUrl);
    customIconObjectUrl = null;
  }
  hideRemoveLink();

  if (faviconPreview) {
    faviconPreview.onerror = () => {
      faviconPreview.onerror = null;
      faviconPreview.src = PLACEHOLDER_DATA_URL;
    };
    faviconPreview.onload = null;
    faviconPreview.removeAttribute('srcset');
    faviconPreview.src = DEFAULT_ICON_PATH;
  }
  faviconPreviewContainer?.classList.remove('hidden');
}

async function setFaviconPreviewFromURL(urlString) {
  const seq = ++previewSeq;
  if (!urlString || urlString.trim() === '' || !/^https?:\/\//i.test(urlString)) {
    setPlaceholderPreview();
    return;
  }
  if (customIconBuffer) {
    setCustomIconPreview(customIconBuffer);
    return;
  }
  setPlaceholderPreview();

  try {
    const u = new URL(urlString);
    const hostname = (u.hostname || '').trim();
    const isIPv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (!hostname || hostname === 'localhost' || (!hostname.includes('.') && !isIPv4)) return;

    const res = await window.api?.domainExists?.(hostname);
    if (seq !== previewSeq) return;
    if (!res?.ok || !res.exists) return;

    const s2 = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(hostname)}`;
    const testImg = new Image();
    testImg.onload = () => {
      if (seq !== previewSeq) return;
      if (faviconPreview) {
        faviconPreview.onerror = null;
        faviconPreview.onload = null;
        faviconPreview.removeAttribute('srcset');
        faviconPreview.src = s2;
      }
      hideRemoveLink();
      faviconPreviewContainer?.classList.remove('hidden');
    };
    testImg.onerror = () => {};
    testImg.src = s2;
  } catch {}
}

function setCustomIconPreview(arrayBuffer) {
  if (customIconObjectUrl) URL.revokeObjectURL(customIconObjectUrl);
  const blob = new Blob([arrayBuffer]);
  customIconObjectUrl = URL.createObjectURL(blob);
  if (faviconPreview) {
    faviconPreview.onerror = null;
    faviconPreview.onload = null;
    faviconPreview.removeAttribute('srcset');
    faviconPreview.src = customIconObjectUrl;
  }
  faviconPreviewContainer?.classList.remove('hidden');
  showRemoveLink();
}

/* ===== URL-Events ===== */
// Wichtig: wir entfernen die Live-"invalid URL"-Fehleranzeige beim Tippen,
// weil ensureSchemeInInput automatisch https:// hinzufügt, wenn ein Domain-Muster erkannt wird.
// Neu: Wenn der Nutzer das Feld erneut editiert (erstes Zeichen eingegeben), entfernen wir
// sofort jegliche zuvor gesetzte Validierungsfehlermeldung (z.B. "Bitte eine Website-URL eingeben.").
const debouncedPreview = debounce((value) => setFaviconPreviewFromURL(value), 250);

urlInput?.addEventListener('input', () => {
  const v = urlInput.value.trim();

  if (!v) {
    // Keine Meldung während Tippen — final wird beim Klick geprüft
    urlInput.setCustomValidity('');
    setPlaceholderPreview();
    return;
  }

  // Sobald Nutzer einen ersten Charakter eingibt, löschen wir eventuelle Validity-Fehler
  if (v.length > 0) {
    urlInput.setCustomValidity('');
  }

  // Versuche automatisch Schema hinzuzufügen, falls nötig
  const changed = ensureSchemeInInput(urlInput);
  debouncedPreview(changed ? urlInput.value : v);
});

urlInput?.addEventListener('blur', () => {
  const fixed = normalizeUrl(urlInput.value);
  if (fixed !== urlInput.value) urlInput.value = fixed;
  setFaviconPreviewFromURL(fixed);
});

/* === Eigene Icon-Datei wählen/entfernen === */
chooseCustomIconLink?.addEventListener('click', async (e) => {
  e.preventDefault();
  const res = await window.api?.pickIcon?.();
  if (res?.canceled) return;
  if (res?.buffer) {
    customIconBuffer = res.buffer;
    if (customIconNote) {
      const d = translations[currentLang];
      customIconNote.textContent = (d.customIconChosen?.(res.name)) || `Icon: ${res.name}`;
    }
    showRemoveLink();
    setCustomIconPreview(customIconBuffer);
  }
});

clearCustomIconLink?.addEventListener('click', (e) => {
  e.preventDefault();
  customIconBuffer = null;
  if (customIconObjectUrl) { URL.revokeObjectURL(customIconObjectUrl); customIconObjectUrl = null; }
  hideRemoveLink();
  const current = normalizeUrl(urlInput?.value);
  if (current) setFaviconPreviewFromURL(current);
  else setPlaceholderPreview();
});

/* ===== Custom Settings ===== */
const windowModeSel = document.getElementById('windowMode');
let currentCustomSettings = null;

function renderCustomSummary(data) {
  const el = document.getElementById('customSettingsSummary');
  if (!el) return;
  if (!data) { el.textContent = ''; return; }

  const d = translations[currentLang];
  const parts = [
    `${data.width}×${data.height}`,
    `resizable: ${data.resizable ? d.yes : d.no}`,
    `minimizable: ${data.minimizable ? d.yes : d.no}`,
    `maximizable: ${data.maximizable ? d.yes : d.no}`
  ];
  if (data.noScrollbar) parts.push(d.noScrollbar);

  el.innerHTML = `<em>${parts.join(', ')}</em>`;
}

windowModeSel?.addEventListener('change', async (e) => {
  const value = e.target.value;
  if (value === 'custom') {
    const isDark = document.body.classList.contains('dark');
    const res = await window.api.openCustomSettings({
      ...(currentCustomSettings || {
        width: 1024, height: 768,
        resizable: true, minimizable: true, maximizable: true,
        noScrollbar: false
      }),
      isDark,
      lang: currentLang
    });
    if (res?.saved && res.data) {
      currentCustomSettings = res.data;
      renderCustomSummary(currentCustomSettings);
    } else {
      e.target.value = 'resizable';
      renderCustomSummary(null);
    }
  } else {
    renderCustomSummary(null);
  }
});

window.api?.onCustomSettingsApplied?.((data) => {
  if (!data) return;
  currentCustomSettings = data;
  renderCustomSummary(data);
});

/* ===== Titlebar Settings ===== */
const frameSelect = document.getElementById('frameOption');
let currentTitlebarSettings = null;

function ensureFrameSummaryEl() { return document.getElementById('frameSettingsSummary'); }

function summarizeTitlebarSettings(s) {
  if (!s) return '';
  const d = translations[currentLang];
  if (s.mode === 'svg') return d.svgSummary(s.theme, s.color);
  const total = 7;
  const chosen = s.assets ? Object.values(s.assets).filter(Boolean).length : 0;
  return d.customSummary(chosen, total);
}

function renderFrameSummary() {
  const el = ensureFrameSummaryEl();
  if (!el) return;
  if (!currentTitlebarSettings) { el.textContent = ''; return; }
  el.innerHTML = `<em>${summarizeTitlebarSettings(currentTitlebarSettings)}</em>`;
}

frameSelect?.addEventListener('change', async (e) => {
  const value = e.target.value;
  if (value !== 'false') {
    renderFrameSummary();
    return;
  }

  const isDark = document.body.classList.contains('dark');
  const fallback = { mode: 'svg', theme: isDark ? 'dark' : 'light', color: '#6b7280' };

  const res = await window.api.openTitlebarSettings({
    ...(currentTitlebarSettings || fallback),
    isDark,
    lang: currentLang,
    minimizable: currentCustomSettings?.minimizable ?? true,
    maximizable: currentCustomSettings?.maximizable ?? true
  });
  if (res?.saved && res.data) {
    currentTitlebarSettings = res.data;
    renderFrameSummary();
  } else {
    e.target.value = 'true';
    renderFrameSummary();
  }
});

window.api?.onTitlebarSettingsApplied?.((data) => {
  if (!data) return;
  currentTitlebarSettings = data;
  renderFrameSummary();
});

/* ===== App-Generierung ===== */
document.getElementById('generateBtn')?.addEventListener('click', () => {
  if (generationInProgress) return;

  const d = translations[currentLang];

  const nameRaw = appNameInput?.value ?? '';
  const name = sanitizeAppNameInput(nameRaw).trim();
  if (!name) {
    // Setze Validity (wird beim nächsten Tippen sofort entfernt durch input-handler)
    appNameInput?.setCustomValidity(d.missingName);
    appNameInput?.reportValidity();
    return;
  } else {
    appNameInput?.setCustomValidity('');
  }

  const fixed = normalizeUrl(urlInput?.value);
  if (!fixed) {
    urlInput?.setCustomValidity(d.missingUrl);
    urlInput?.reportValidity();
    return;
  }
  // normalizeUrl adds https:// when possible; final guard: must start with http(s)
  if (!/^https?:\/\//i.test(fixed)) {
    urlInput?.setCustomValidity(d.invalidUrl);
    urlInput?.reportValidity();
    return;
  }
  urlInput.setCustomValidity('');
  if (urlInput) urlInput.value = fixed;

  const config = {
    name,
    url: fixed,
    windowMode: windowModeSel?.value,
    frame: document.getElementById('frameOption')?.value === 'true'
  };

  if (config.windowMode === 'mobile') {
    config.custom = { width: 375, height: 670, resizable: false, minimizable: true, maximizable: false };
  } else if (config.windowMode === 'custom') {
    if (!currentCustomSettings) {
      alert(d.needCustomFirst);
      return;
    }
    config.custom = currentCustomSettings;
  } else {
    config.custom = { width: 1024, height: 768, resizable: true, minimizable: true, maximizable: true };
  }

  if (!config.frame) {
    const isDark = document.body.classList.contains('dark');
    const fallbackTB = { mode: 'svg', theme: isDark ? 'dark' : 'light', color: '#6b7280' };
    config.titlebar = currentTitlebarSettings || fallbackTB;
  }

  if (customIconBuffer) config.icoBuffer = customIconBuffer;

  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = true;
  generationInProgress = true;

  showProgressModal();
  window.api?.generateApp?.(config);
});

/* ===== Modal / Progress ===== */
function showProgressModal() {
  const modal = document.getElementById('progressModal');
  resetProgressModal();
  const log = document.getElementById('progressLog');
  if (log) log.textContent = (currentLang === 'en') ? 'Choose destination...' : 'Speicherort wählen...';
  modal?.classList.remove('hidden');
}

const ALLOWED_PREFIXES = [
  // DE
  'Speicherort wählen...',
  'Favicon wird verwendet!',
  'Benutzerdefiniertes Icon wird verwendet!',
  'Kein Icon gefunden, Favicon wird genutzt!',
  'Installiere Abhängigkeiten...',
  'Erstelle Anwendung "',
  'Erfolgreich erstellt!',
  // EN
  'Choose destination...',
  'Using favicon!',
  'Using custom icon!',
  'No icon found, using favicon!',
  'Installing dependencies...',
  'Building application "',
  'Build complete!'
];

window.api?.onBuildProgress?.((data) => {
  const log = document.getElementById('progressLog');
  if (!log || !data?.message) return;
  const msg = String(data.message).trim();
  const d = translations[currentLang];

  let line = msg;
  if (currentLang === 'en') {
    const key = (d.progressMapIn || []).find(p => msg.startsWith(p));
    if (key) {
      if (key.startsWith('Erstelle Anwendung \"') && msg.includes('\"')) {
        const name = msg.split('\"')[1] || '';
        line = `Building application "${name}"`;
      } else {
        line = (d.progressMapOut?.[key]) || msg;
      }
    }
  }

  if (!ALLOWED_PREFIXES.some(p => line.startsWith(p))) return;
  if (log.textContent) log.textContent += '\n';
  log.textContent += line;
});

window.api?.onGenerationDone?.((data) => {
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = false;
  generationInProgress = false;

  const modal = document.getElementById('progressModal');
  const spinner = document.getElementById('spinnerIcon');
  const text = modal?.querySelector('.modal-text');
  const openFileBtn = document.getElementById('openFileBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const d = translations[currentLang];

  if (spinner) {
    spinner.classList.remove('spinner');
    spinner.textContent = data?.userAborted ? '❌' : (data?.aborted ? '❌' : '✅');
    spinner.style.border = 'none';
    spinner.style.width = 'auto';
    spinner.style.height = 'auto';
  }

  if (data?.userAborted) {
    modal?.classList.add('hidden');
    setTimeout(resetProgressModal, 300);
    return;
  }

  if (data?.aborted) {
    if (text) {
      const msg = data?.errorMessage ? escapeHtml(data.errorMessage) : '';
      text.innerHTML = d.doneError(msg);
    }
    openFileBtn?.classList.add('hidden');
    openFolderBtn?.classList.add('hidden');

    if (cancelBtn) {
      cancelBtn.textContent = d.closeBtn;
      cancelBtn.disabled = false;
      cancelBtn.classList.remove('close-btn'); // im Fehlerfall kein roter Hover
      cancelBtn.onclick = () => {
        modal?.classList.add('hidden');
        setTimeout(resetProgressModal, 300);
      };
    }
    return;
  }

  // Erfolg
  if (text) text.innerHTML = d.doneSuccess(data?.exePath || '');

  if (openFileBtn) {
    if (data?.exePath) {
      openFileBtn.textContent = d.modalOpenFile;
      openFileBtn.classList.remove('hidden');
      openFileBtn.onclick = async () => { await window.api?.openPath?.(data.exePath); };
    } else {
      openFileBtn.classList.add('hidden');
      openFileBtn.onclick = null;
    }
  }
  if (openFolderBtn) {
    if (data?.exeDir) {
      openFolderBtn.textContent = d.modalOpenFolder;
      openFolderBtn.classList.remove('hidden');
      openFolderBtn.onclick = async () => { await window.api?.openPath?.(data.exeDir); };
    } else {
      openFolderBtn.classList.add('hidden');
      openFolderBtn.onclick = null;
    }
  }

  if (cancelBtn) {
    cancelBtn.textContent = d.closeBtn;
    cancelBtn.disabled = false;
    cancelBtn.classList.add('close-btn'); // roter Hover nur im Erfolgszustand
    cancelBtn.onclick = () => {
      modal?.classList.add('hidden');
      setTimeout(resetProgressModal, 300);
    };
  }
});

function resetProgressModal() {
  const modal = document.getElementById('progressModal');
  if (!modal) return;

  const d = translations[currentLang];
  const text = modal.querySelector('.modal-text');
  if (text) text.innerHTML = d.modalRunning;

  const spinnerContainer = document.getElementById('spinnerContainer');
  if (spinnerContainer) {
    spinnerContainer.innerHTML = '<div class="spinner" id="spinnerIcon"></div>';
  }

  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.textContent = d.cancelBtn;
    cancelBtn.onclick = () => window.api?.cancelGeneration?.();
    cancelBtn.disabled = false;
    cancelBtn.classList.remove('close-btn');
  }

  const openFileBtn = document.getElementById('openFileBtn');
  if (openFileBtn) {
    openFileBtn.classList.add('hidden');
    openFileBtn.onclick = null;
  }

  const openFolderBtn = document.getElementById('openFolderBtn');
  if (openFolderBtn) {
    openFolderBtn.classList.add('hidden');
    openFolderBtn.onclick = null;
  }

  const log = document.getElementById('progressLog');
  if (log) log.textContent = '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}

/* ===== App-Overlay (Dim) steuern ===== */
const appBackdrop = document.getElementById('appBackdrop');
window.api?.onUIDim?.(() => appBackdrop?.classList.remove('hidden'));
window.api?.onUIUndim?.(() => appBackdrop?.classList.add('hidden'));
