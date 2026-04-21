/**
 * theme.js — Theme engine
 * Handles: dark/light/system/custom modes, font selection, custom colour overrides
 * Applies CSS variables to :root in real time. Persists to store.
 */

const THEMES = {
  dark: {
    '--bg':      '#0e0e0e',
    '--surface': '#161616',
    '--card':    '#1c1c1c',
    '--border':  '#2a2a2a',
    '--text':    '#f0ece0',
    '--muted':   '#7a7570',
    '--accent':  '#e8c547',
    '--accent2': '#c47a3a',
    '--danger':  '#c45a3a',
    '--success': '#4a9a6a',
    '--info':    '#4a8aca',
    '--sidebar-bg': '#0a0a0a',
    '--titlebar-bg':'#0a0a0a',
  },
  light: {
    '--bg':      '#f5f3ef',
    '--surface': '#ffffff',
    '--card':    '#f0ede8',
    '--border':  '#ddd9d0',
    '--text':    '#1a1814',
    '--muted':   '#8a857a',
    '--accent':  '#c4960f',
    '--accent2': '#a05c20',
    '--danger':  '#b03a20',
    '--success': '#2a7a4a',
    '--info':    '#2a6aaa',
    '--sidebar-bg': '#eae7e0',
    '--titlebar-bg':'#e0ddd6',
  },
};

const FONTS = {
  'DM Mono':            { body: "'DM Mono', monospace",       heading: "'Playfair Display', serif",  google: 'DM+Mono:wght@300;400;500' },
  'Inter':              { body: "'Inter', sans-serif",         heading: "'Playfair Display', serif",  google: 'Inter:wght@300;400;500;600' },
  'System':             { body: "system-ui, sans-serif",       heading: "'Playfair Display', serif",  google: null },
  'Playfair Display':   { body: "'Playfair Display', serif",   heading: "'Playfair Display', serif",  google: null },
  'JetBrains Mono':     { body: "'JetBrains Mono', monospace", heading: "'Playfair Display', serif",  google: 'JetBrains+Mono:wght@300;400;500' },
};

const PRESETS = [
  { name: 'Gold (default)', accent: '#e8c547' },
  { name: 'Electric Blue',  accent: '#4a8aca' },
  { name: 'Emerald',        accent: '#4a9a6a' },
  { name: 'Rose',           accent: '#ca4a7a' },
  { name: 'Coral',          accent: '#c45a3a' },
  { name: 'Violet',         accent: '#9a4aca' },
  { name: 'Cyan',           accent: '#4acaca' },
  { name: 'Lime',           accent: '#7aca4a' },
];

// ── Apply theme to DOM ────────────────────────────────────────────────────────
function applyTheme(settings) {
  const mode   = settings.mode   || 'dark';
  const font   = settings.font   || 'DM Mono';
  const custom = settings.custom || {};

  // Resolve system preference
  let resolvedMode = mode;
  if (mode === 'system') {
    resolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const base = THEMES[resolvedMode] || THEMES.dark;
  const vars = { ...base, ...custom };

  // Apply CSS variables
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }

  // Sidebar & titlebar colours
  const sidebar = document.getElementById('sidebar');
  const titlebar = document.getElementById('titlebar');
  if (sidebar)  sidebar.style.background = vars['--sidebar-bg']  || vars['--surface'];
  if (titlebar) titlebar.style.background= vars['--titlebar-bg'] || vars['--bg'];

  // Apply body background
  document.body.style.background = vars['--bg'];
  document.body.style.color      = vars['--text'];

  // Apply font
  const fontDef = FONTS[font] || FONTS['DM Mono'];
  document.body.style.fontFamily = fontDef.body;

  // Load Google font if needed
  if (fontDef.google) {
    const id = 'gfont-' + font.replace(/\s/g,'');
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontDef.google}&display=swap`;
      document.head.appendChild(link);
    }
  }
}

// ── Load & save ───────────────────────────────────────────────────────────────
async function loadAndApplyTheme() {
  const settings = await window.api.store.get('theme') || {};
  applyTheme(settings);

  // Watch system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = window.api.store.get('theme') || {};
    if ((current.mode || 'dark') === 'system') applyTheme(current);
  });
}

async function saveTheme(settings) {
  await window.api.store.set('theme', settings);
  applyTheme(settings);
}

// Expose globally
window.themeEngine = { applyTheme, loadAndApplyTheme, saveTheme, THEMES, FONTS, PRESETS };
