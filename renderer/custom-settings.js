// ============================================================================
// custom-settings.js  —  Dialog für benutzerdefinierte Fenster-Einstellungen
// - Übernimmt Dark-Mode vom Hauptfenster
// - Unterstützt DE/EN anhand von initial.lang
// - Validiert Breite/Höhe und sendet Ergebnis zurück an Main
// ============================================================================

/* ===================== I18N ===================== */
const I18N = {
  de: {
    title: "Benutzerdefinierte Fenster-Einstellungen",
    closeTitle: "Schließen",
    size: "Fenstergröße",
    widthPh: "Breite",
    heightPh: "Höhe",
    hint: "Erlaubte Werte: 100–5000 px",
    opts: {
      resizable: "Größenänderung erlauben",
      minimizable: "Minimieren erlauben",
      maximizable: "Maximieren erlauben",
      noScrollbar: "Keine Scrollbar (Scrollen per Mausrad)"
    },
    cancel: "Abbrechen",
    save: "Speichern",
    invalid: "Bitte gültige Werte zwischen 100 und 5000 eingeben"
  },
  en: {
    title: "Custom window settings",
    closeTitle: "Close",
    size: "Window size",
    widthPh: "Width",
    heightPh: "Height",
    hint: "Allowed values: 100–5000 px",
    opts: {
      resizable: "Allow resizing",
      minimizable: "Allow minimize",
      maximizable: "Allow maximize",
      noScrollbar: "No scrollbar (mouse-wheel scroll)"
    },
    cancel: "Cancel",
    save: "Save",
    invalid: "Please enter valid values between 100 and 5000"
  }
};

let __lang = 'de';

function $(sel) {
  return document.querySelector(sel);
}

function applyCSLang(lang = 'de') {
  __lang = I18N[lang] ? lang : 'de';
  const d = I18N[__lang];

  // (optional) Dokumenttitel + sichtbarer Header
  document.title = d.title;
  $('.cs-title')?.replaceChildren(document.createTextNode(d.title));

  // Close-Button Tooltip
  $('#csClose')?.setAttribute('title', d.closeTitle);

  // Labels / Texte
  const rows = document.querySelectorAll('.content .row');
  // Annahme: Erste .row ist Größe
  rows?.[0]?.querySelector('label')?.replaceChildren(document.createTextNode(d.size));
  $('#width')?.setAttribute('placeholder', d.widthPh);
  $('#height')?.setAttribute('placeholder', d.heightPh);
  $('.hint')?.replaceChildren(document.createTextNode(d.hint));

  // Checkbox-Beschriftungen (Annahme: Reihenfolge wie im HTML)
  const labels = document.querySelectorAll('.opts label');
  if (labels[0]) labels[0].lastChild.textContent = ' ' + d.opts.resizable;
  if (labels[1]) labels[1].lastChild.textContent = ' ' + d.opts.minimizable;
  if (labels[2]) labels[2].lastChild.textContent = ' ' + d.opts.maximizable;
  if (labels[3]) labels[3].lastChild.textContent = ' ' + d.opts.noScrollbar;

  // Footer-Buttons
  $('#btnCancel')?.replaceChildren(document.createTextNode(d.cancel));
  $('#btnSave')?.replaceChildren(document.createTextNode(d.save));

  // Für Validierungs-Message (ohne erneutes I18N-Lookup beim Klick)
  $('#btnSave')?.setAttribute('data-i18n-invalid', d.invalid);
}

/* ===================== Close oben rechts ===================== */
document.getElementById('csClose')?.addEventListener('click', () => {
  window.api?.cancelCustomSettings?.();
});

/* ===================== Init-Daten vom Main ===================== */
window.api?.onCustomSettingsInit?.((initial) => {
  // Theme
  if (initial?.isDark) document.body.classList.add('dark');
  else document.body.classList.remove('dark');

  // Sprache anwenden (falls mitgegeben)
  applyCSLang(initial?.lang || 'de');

  // Werte/Checkboxen übernehmen
  document.getElementById('width').value = initial?.width ?? 1024;
  document.getElementById('height').value = initial?.height ?? 768;

  document.getElementById('resizable').checked   = initial?.resizable   ?? true;
  document.getElementById('minimizable').checked = initial?.minimizable ?? true;
  document.getElementById('maximizable').checked = initial?.maximizable ?? true;
  document.getElementById('no-scrollbar').checked = initial?.noScrollbar ?? false;
});

/* ===================== Speichern ===================== */
document.getElementById('btnSave')?.addEventListener('click', () => {
  const w = parseInt(document.getElementById('width').value, 10);
  const h = parseInt(document.getElementById('height').value, 10);

  if (isNaN(w) || isNaN(h) || w < 100 || h < 100 || w > 5000 || h > 5000) {
    const msg = document.getElementById('btnSave')?.getAttribute('data-i18n-invalid')
      || I18N[__lang]?.invalid
      || 'Invalid values';
    alert(msg);
    return;
  }

  window.api?.saveCustomSettings?.({
    width: w,
    height: h,
    resizable:   document.getElementById('resizable').checked,
    minimizable: document.getElementById('minimizable').checked,
    maximizable: document.getElementById('maximizable').checked,
    noScrollbar: document.getElementById('no-scrollbar').checked
  });
});

/* ===================== Abbrechen ===================== */
document.getElementById('btnCancel')?.addEventListener('click', () => {
  window.api?.cancelCustomSettings?.();
});
