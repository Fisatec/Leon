// titlebar-settings.js — feste Fenstergröße, Buttons unten rechts, Standardfarbe Grau
// Funktionalität wie deine vorherige, aber mit vollständiger I18N-Unterstützung
// (DE/EN). Safe gegenüber unterschiedlichen asset-Formen und ohne Leaks.

document.addEventListener('DOMContentLoaded', () => {

  // -------------------------
  // I18N
  // -------------------------
  const TBI18N = {
    de: {
      windowTitle: "Titelleiste – Buttons & Theme",
      closeTitle: "Schließen",
      // Segments
      modeSvg: "SVG-Buttons (färbbar)",
      modeCustom: "Eigene Buttons (.png/.ico)",
      colorLabel: "Farbe der Buttons",
      colorHint: "Wirkt auf alle SVG-Buttons",
      themeLight: "Light",
      themeDark: "Dark",
      customLabel: "Eigene Buttons (.png/.ico)",
      // Card actions
      chooseFile: "Datei wählen",
      removeFile: "Entfernen",
      optional: "optional",
      // Card titles
      card: {
        back: "Zurück",
        forward: "Vorwärts",
        reload: "Neu laden",
        minimize: "Minimieren",
        maximize: "Maximieren",
        restore: "Wiederherstellen",
        close: "Schließen"
      },
      // Footer
      btnCancel: "Abbrechen",
      btnSave: "Speichern",
      // Preview hints
      capsMinDisabled: "„Minimieren“ wurde in den benutzerdefinierten Einstellungen deaktiviert.",
      capsMaxDisabled: "„Maximieren/Wiederherstellen“ wurde deaktiviert."
    },
    en: {
      windowTitle: "Titlebar – Buttons & Theme",
      closeTitle: "Close",
      // Segments
      modeSvg: "SVG Buttons (tintable)",
      modeCustom: "Custom Buttons (.png/.ico)",
      colorLabel: "Button color",
      colorHint: "Affects all SVG buttons",
      themeLight: "Light",
      themeDark: "Dark",
      customLabel: "Custom Buttons (.png/.ico)",
      // Card actions
      chooseFile: "Choose file",
      removeFile: "Remove",
      optional: "optional",
      // Card titles
      card: {
        back: "Back",
        forward: "Forward",
        reload: "Reload",
        minimize: "Minimize",
        maximize: "Maximize",
        restore: "Restore",
        close: "Close"
      },
      // Footer
      btnCancel: "Cancel",
      btnSave: "Save",
      // Preview hints
      capsMinDisabled: "“Minimize” was disabled in custom settings.",
      capsMaxDisabled: "“Maximize/Restore” was disabled."
    }
  };

  let uiLang = 'de';

  // -------------------------
  // Constants / state
  // -------------------------
  const KEYS = ['back','forward','reload','minimize','maximize','restore','close'];

  const SVG_ICONS = {
    back:     `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    forward:  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    reload:   `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10" /><path d="M20.49 15A9 9 0 0 1 5.87 18.36L1 14" /></svg>`,
    minimize: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="19"/></svg>`,
    maximize: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
    restore:  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="9" width="10" height="10" rx="1"/><path d="M9 7h8a1 1 0 0 1 1 1v8"/></svg>`,
    close:    `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  const NEUTRAL_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="4 3"/></svg>`;

  let mode = 'svg';
  let theme = 'light';
  let caps = { minimizable: true, maximizable: true };
  let svgColor = '#6b7280';
  let assets = {};
  let objectUrls = {};

  /* ========== Small helpers ========== */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function setText(selector, text) {
    const el = $(selector);
    if (el) el.textContent = text;
  }

  function setAttr(selector, attr, value) {
    const el = $(selector);
    if (el) el.setAttribute(attr, value);
  }

  function applyI18n(lang) {
    uiLang = TBI18N[lang] ? lang : 'de';
    const d = TBI18N[uiLang];

    // Title & close tooltip
    setText('.tb-title', d.windowTitle);
    $('#tbClose')?.setAttribute('title', d.closeTitle);

    // Mode segmented buttons
    const modeBtns = document.querySelectorAll('#modeSeg button');
    if (modeBtns && modeBtns.length >= 2) {
      modeBtns[0].textContent = d.modeSvg;
      modeBtns[1].textContent = d.modeCustom;
    }

    // Row color and hint
    const rowColorLabel = document.querySelector('#rowColor .label');
    if (rowColorLabel) rowColorLabel.textContent = d.colorLabel;
    const rowColorHint = document.querySelector('#rowColor .hint');
    if (rowColorHint) rowColorHint.textContent = d.colorHint;

    // Theme segmented
    const themeBtns = document.querySelectorAll('#themeSeg button');
    if (themeBtns && themeBtns.length >= 2) {
      themeBtns[0].textContent = d.themeLight;
      themeBtns[1].textContent = d.themeDark;
    }

    // Custom row label
    const customLabel = document.querySelector('#rowCustom .label');
    if (customLabel) customLabel.textContent = d.customLabel;

    // Footer buttons
    const btnCancel = $('#btnCancel');
    if (btnCancel) btnCancel.textContent = d.btnCancel;
    const btnSave = $('#btnSave');
    if (btnSave) btnSave.textContent = d.btnSave;

    // Update cards (titles/tooltips)
    // cards will be re-rendered soon by onTitlebarSettingsInit or renderCards
  }

  function setDarkUI(dark) {
    document.body.classList.toggle('dark', !!dark);
  }

  function setThemeVars(t) {
    const box = document.getElementById('previewBox');
    if (!box) return;
    if (t === 'dark') {
      box.style.setProperty('--tb-bg', '#1f1f1f');
      box.style.setProperty('--tb-fg', '#eee');
      box.style.setProperty('--tb-border', 'rgba(255,255,255,0.12)');
    } else {
      box.style.setProperty('--tb-bg', '#ffffff');
      box.style.setProperty('--tb-fg', '#222');
      box.style.setProperty('--tb-border', 'rgba(0,0,0,0.08)');
    }
  }

  function setIconColor(col) {
    const box = document.getElementById('previewBox');
    if (!box) return;
    box.style.setProperty('--icon-color', col);
  }

  function activateSegment(containerId, dataAttr, value) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset[dataAttr] === value));
  }

  function assetObjectUrl(k) {
    const item = assets[k];
    if (!item) return null;
    if (item.objectUrl) return item.objectUrl;
    if (objectUrls[k]) return objectUrls[k];
    try {
      if (typeof item === 'string') return item;
      if (item.url && typeof item.url === 'string') return item.url;

      const bufCandidate = item.buffer || item;
      let ab;
      if (bufCandidate instanceof ArrayBuffer) ab = bufCandidate;
      else if (ArrayBuffer.isView(bufCandidate)) ab = bufCandidate.buffer;
      else if (bufCandidate && bufCandidate.data instanceof ArrayBuffer) ab = bufCandidate.data;
      else ab = null;

      if (!ab) return null;
      const type = item.type || 'image/png';
      const blob = new Blob([ab], { type });
      const url = URL.createObjectURL(blob);
      objectUrls[k] = url;
      return url;
    } catch (err) {
      console.warn('assetObjectUrl error for', k, err);
      return null;
    }
  }

  function revokeAllObjectUrls() {
    for (const k in objectUrls) {
      try { URL.revokeObjectURL(objectUrls[k]); } catch {}
    }
    objectUrls = {};
  }

  /* ========== Preview Rendering =========== */

  function clearPreviewGroups() {
    const left = document.getElementById('prevLeft');
    const right = document.getElementById('prevRight');
    if (left) left.innerHTML = '';
    if (right) right.innerHTML = '';
  }

  function buttonHTML(type, svgSize = 20) {
    if (mode === 'custom') {
      const src = assetObjectUrl(type);
      const content = src ? `<img src="${src}" alt="${type}">` : NEUTRAL_SVG;
      return `<button class="btn" title="${type}">${content}</button>`;
    }
    const svg = (SVG_ICONS[type] || NEUTRAL_SVG)
      .replace(/width="(\d+)"/, `width="${svgSize}"`)
      .replace(/height="(\d+)"/, `height="${svgSize}"`);
    return `<button class="btn" title="${type}">${svg}</button>`;
  }

  function renderPreview() {
    clearPreviewGroups();
    const left = document.getElementById('prevLeft');
    const right = document.getElementById('prevRight');
    if (!left || !right) return;

    left.insertAdjacentHTML('beforeend', buttonHTML('back'));
    left.insertAdjacentHTML('beforeend', buttonHTML('forward'));
    left.insertAdjacentHTML('beforeend', buttonHTML('reload'));
    if (caps.minimizable) right.insertAdjacentHTML('beforeend', buttonHTML('minimize'));
    if (caps.maximizable) {
      right.insertAdjacentHTML('beforeend', buttonHTML('maximize'));
      right.insertAdjacentHTML('beforeend', buttonHTML('restore'));
    }
    right.insertAdjacentHTML('beforeend', buttonHTML('close'));

    // Info unter der Preview (lokalisiert) — jetzt nur im SVG-Modus und je Nachricht eigene Zeile
    const infoId = 'tbCapsInfo';
    let info = document.getElementById(infoId);

    const msgs = [];
    const d = TBI18N[uiLang];
    if (!caps.minimizable) msgs.push(d.capsMinDisabled);
    if (!caps.maximizable) msgs.push(d.capsMaxDisabled);

    // Wenn nicht im SVG-Modus: entferne/verdecke die Info komplett
    if (mode !== 'svg' || msgs.length === 0) {
      if (info && info.parentNode) info.parentNode.removeChild(info);
      return;
    }

    if (!info) {
      info = document.createElement('div');
      info.id = infoId;
      info.className = 'hint';
      // platzieren unterhalb der Preview (nicht innerhalb .topbar)
      document.querySelector('.content')?.appendChild(info);
    }

    // Jede Nachricht in einer eigenen Zeile
    info.innerHTML = msgs.map(m => `<div>${m}</div>`).join('');
  }

  /* ========== Cards Rendering (Custom) ========== */

  function actionButton(icon, danger = false, title = '', chooseDisabled = false) {
    // icon: { action:'choose'|'clear', key: 'minimize' ... , svg: '<svg...>' }
    const baseCls = 'iconbtn' + (danger ? ' iconbtn--danger' : '');
    if (icon.action === 'choose') {
      const chooseCls = chooseDisabled ? ' choose-disabled' : '';
      // data-disabled hilft im Klick-Handler
      return `<button class="${baseCls}${chooseCls}" title="${title}" data-action="${icon.action}" data-key="${icon.key}" ${chooseDisabled ? 'data-disabled="1"' : ''}>
        ${icon.svg}
      </button>`;
    } else {
      return `<button class="${baseCls}" title="${title}" data-action="${icon.action}" data-key="${icon.key}">
        ${icon.svg}
      </button>`;
    }
  }

  const FOLDER_SVG = `<svg viewBox="0 0 24 24"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
  const X_SVG      = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  function renderCards() {
    const cards = document.getElementById('cards');
    if (!cards) return;
    cards.innerHTML = '';
    const d = TBI18N[uiLang];

    for (const k of KEYS) {
      const title = (d.card && d.card[k]) ? d.card[k] : (k[0].toUpperCase() + k.slice(1));
      const src = assetObjectUrl(k);
      const displayName = (assets[k] && (assets[k].name || assets[k].filename)) || '—';
      const thumbContent = src ? `<img src="${src}" alt="${k}" />` : NEUTRAL_SVG;

      // bestimmen, ob dieses Feld aufgrund caps deaktiviert werden soll
      const isMinDisabled = (k === 'minimize' && !caps.minimizable);
      const isMaxRestDisabled = ((k === 'maximize' || k === 'restore') && !caps.maximizable);
      const chooseDisabled = isMinDisabled || isMaxRestDisabled;

      // optional-Hinweis wird NICHT mehr gerendert (der Nutzer wollte das entfernen)
      const card = document.createElement('div');
      card.className = 'card' + (chooseDisabled ? ' disabled' : '');
      card.innerHTML = `
        <div class="thumb" data-key="${k}">${thumbContent}</div>
        <div class="meta">
          <div class="title">${title}</div>
          <div class="filename" id="fn_${k}" title="${displayName}">${displayName}</div>
        </div>
        <div class="actions">
          ${actionButton({ action:'choose', key:k, svg:FOLDER_SVG }, false, d.chooseFile, chooseDisabled)}
          ${actionButton({ action:'clear', key:k, svg:X_SVG }, true, d.removeFile)}
        </div>
      `;
      cards.appendChild(card);
    }
  }

  function updateOneCard(k) {
    const thumb = document.querySelector(`.thumb[data-key="${k}"]`);
    const fn = document.getElementById(`fn_${k}`);
    if (!thumb || !fn) return;

    if (objectUrls[k]) { try { URL.revokeObjectURL(objectUrls[k]); } catch {} delete objectUrls[k]; }
    const src = assetObjectUrl(k);
    thumb.innerHTML = src ? `<img src="${src}" alt="${k}" />` : NEUTRAL_SVG;

    const displayName = (assets[k] && (assets[k].name || assets[k].filename)) || '—';
    fn.textContent = displayName;
    fn.title = displayName;
  }

  /* ========== Events ========== */

  // Close in titlebar
  document.getElementById('tbClose')?.addEventListener('click', () => {
    window.api?.cancelTitlebarSettings?.();
  });

  document.getElementById('modeSeg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const m = btn.dataset.mode;
    if (m !== 'svg' && m !== 'custom') return;
    mode = m;

    activateSegment('modeSeg', 'mode', mode);
    document.getElementById('rowColor')?.classList.toggle('hidden', mode !== 'svg');
    document.getElementById('rowCustom')?.classList.toggle('hidden', mode !== 'custom');

    renderPreview();
  });

  document.getElementById('themeSeg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (!btn) return;
    theme = btn.dataset.theme === 'dark' ? 'dark' : 'light';
    activateSegment('themeSeg', 'theme', theme);
    setThemeVars(theme);
    renderPreview();
  });

  document.getElementById('svgColor')?.addEventListener('input', (e) => {
    svgColor = e.target.value || '#6b7280';
    setIconColor(svgColor);
    renderPreview();
  });

  document.getElementById('cards')?.addEventListener('click', async (e) => {
    const actBtn = e.target.closest('button[data-action]');
    if (!actBtn) return;
    const k = actBtn.dataset.key;
    const action = actBtn.dataset.action;

    // Wenn choose-Button mit data-disabled gesetzt ist, ignoriere (no-op)
    if (action === 'choose' && actBtn.dataset.disabled === '1') {
      // Absichtlich keine Aktion — visuell & funktional deaktiviert
      return;
    }

    if (action === 'choose') {
      try {
        const res = await window.api?.pickAsset?.();
        if (!res || res.canceled) return;
        // support: { buffer, name, ext, type } expected
        const type = res?.type || (res?.ext === 'ico' ? 'image/x-icon' : 'image/png');
        const name = res?.name || res?.filename || (res?.ext ? `${k}.${res.ext}` : `${k}.png`);
        assets[k] = { buffer: res.buffer, name, type };
        updateOneCard(k);
        if (mode === 'custom') renderPreview();
      } catch (err) {
        console.error('pickAsset error', err);
      }
    } else if (action === 'clear') {
      delete assets[k];
      updateOneCard(k);
      if (mode === 'custom') renderPreview();
    }
  });

  /* ========== Init vom Main ========== */

  window.api?.onTitlebarSettingsInit?.((initial) => {
    try {
      // language first
      applyI18n(initial?.lang || uiLang);

      setDarkUI(initial?.isDark);
      mode = initial?.mode === 'custom' ? 'custom' : 'svg';
      theme = initial?.theme === 'dark' ? 'dark' : 'light';
      svgColor = initial?.color || '#6b7280';

      // assets may be provided in various shapes
      assets = initial?.assets || {};
      caps.minimizable = initial?.minimizable !== false;
      caps.maximizable = initial?.maximizable !== false;

      activateSegment('modeSeg', 'mode', mode);
      activateSegment('themeSeg', 'theme', theme);

      document.getElementById('rowColor')?.classList.toggle('hidden', mode !== 'svg');
      document.getElementById('rowCustom')?.classList.toggle('hidden', mode !== 'custom');

      setThemeVars(theme);
      setIconColor(svgColor);

      renderCards();
      setTimeout(() => {
        for (const k of KEYS) updateOneCard(k);
        renderPreview();
      }, 40);
    } catch (err) {
      console.error('onTitlebarSettingsInit error', err);
    }
  });

  /* ========== Save/Cancel ========== */

  document.getElementById('btnSave')?.addEventListener('click', () => {
    revokeAllObjectUrls();
    const data = (mode === 'custom')
      ? { mode: 'custom', theme, assets }
      : { mode: 'svg', theme, color: svgColor };
    window.api?.saveTitlebarSettings?.(data);
  });

  document.getElementById('btnCancel')?.addEventListener('click', () => {
    revokeAllObjectUrls();
    window.api?.cancelTitlebarSettings?.();
  });

}); // DOMContentLoaded
