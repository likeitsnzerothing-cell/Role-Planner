/**
 * app.js — renderer entry point
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

async function refreshAuthUI() {
  const status = await window.api.auth.status();
  const nameEl  = document.getElementById('nav-name');
  const emailEl = document.getElementById('nav-email');
  const avatar  = document.getElementById('nav-avatar');

  if (status.loggedIn && status.user) {
    const name  = status.user.name || status.user.preferred_username || 'Signed in';
    const email = status.user.preferred_username || '';
    nameEl.textContent  = name;
    emailEl.textContent = email;
    avatar.textContent  = (name[0] || '?').toUpperCase();
    // Enable MS365 items
    document.querySelectorAll('.ms-item').forEach(el => { el.style.opacity = '1'; el.title = ''; });
  } else {
    nameEl.textContent  = 'Warren Dev';
    emailEl.textContent = 'Role Planner v1.1.0';
    avatar.textContent  = 'W';
    document.querySelectorAll('.ms-item').forEach(el => { el.style.opacity = '0.4'; });
  }
}

async function handleAuthClick() {
  const status = await window.api.auth.status();
  if (status.loggedIn) {
    await window.api.auth.logout();
    await refreshAuthUI();
    toast('Signed out', 'info');
  } else {
    toast('Opening Microsoft sign-in…', 'info');
    const result = await window.api.auth.login();
    if (result?.error === 'no_config') {
      toast('Set up Azure credentials in Settings first', 'error');
      navigate('settings');
    } else if (result?.error) {
      toast(`Sign-in failed: ${result.message || result.error}`, 'error');
    } else {
      await refreshAuthUI();
      toast('Signed in ✓', 'success');
      navigate('dashboard');
    }
  }
}

async function updateOverdueBadge() {
  const roles = await window.api.store.get('roles') || [];
  const now   = Date.now();
  let count   = 0;
  for (const role of roles) {
    for (const t of (role.responsibilities || [])) {
      if (!t.done && t.deadline && new Date(t.deadline).getTime() < now) count++;
    }
  }
  const badge = document.getElementById('notif-badge');
  badge.textContent  = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

window.addEventListener('DOMContentLoaded', async () => {
  // Apply saved theme immediately
  if (window.themeEngine) await window.themeEngine.loadAndApplyTheme();
  await refreshAuthUI();
  await navigate('dashboard');
  await updateOverdueBadge();

  window.api.on('auth:changed', async () => {
    await refreshAuthUI();
  });

  window.api.on('notification:clicked', () => {
    navigate('notifications');
  });
});
