/**
 * app.js — renderer entry point · v1.8.0
 */

let currentPage = null;

async function navigate(name) {
  if (currentPage === name) return;
  currentPage = name;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === name);
  });

  const container = document.getElementById('page-container');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';

  const renderer = window[`render_${name}`];
  if (renderer) {
    try {
      await renderer(container);
    } catch (err) {
      container.innerHTML = `<div class="page"><div class="empty"><div class="empty-icon">⚠</div><h3>Error loading page</h3><p>${err.message}</p></div></div>`;
    }
  }
}

async function updateOverdueBadge() {
  const roles = await window.api.store.get('roles') || [];
  const now = Date.now();
  let count = 0;
  for (const role of roles) {
    for (const t of (role.responsibilities || [])) {
      if (!t.done && t.deadline && new Date(t.deadline).getTime() < now) count++;
    }
  }
  const badge = document.getElementById('notif-badge');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

function setupUpdaterListeners() {
  const banner = document.getElementById('update-banner');
  const bannerText = document.getElementById('update-banner-text');
  const downloadBtn = document.getElementById('update-download-btn');
  const installBtn = document.getElementById('update-install-btn');

  window.api.on('updater:available', (info) => {
    bannerText.textContent = `Version ${info.version} is available.`;
    downloadBtn.style.display = 'inline';
    installBtn.style.display = 'none';
    banner.style.display = 'flex';
  });

  window.api.on('updater:progress', (progress) => {
    bannerText.textContent = `Downloading… ${Math.round(progress.percent)}%`;
  });

  window.api.on('updater:downloaded', () => {
    bannerText.textContent = 'Update ready to install.';
    downloadBtn.style.display = 'none';
    installBtn.style.display = 'inline';
  });

  window.api.on('updater:error', (msg) => {
    console.warn('Updater error:', msg);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  if (window.themeEngine) await window.themeEngine.loadAndApplyTheme();
  setupUpdaterListeners();
  await navigate('dashboard');
  await updateOverdueBadge();

  window.api.on('notification:clicked', () => navigate('notifications'));
});
