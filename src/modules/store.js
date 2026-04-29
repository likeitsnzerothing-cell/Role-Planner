/**
 * store.js
 * Local data store wrapper.
 * Microsoft (OneNote) is the source of truth for roles data — 
 * this module handles the sync boundary so a future phone app
 * reading from OneNote will always see the same data.
 *
 * Sync strategy:
 *   - Roles/tasks are stored locally AND pushed to a dedicated
 *     OneNote page ("Role Planner Data") as structured JSON.
 *   - On app start, if a remote copy exists and is newer, it wins.
 *   - Calendar events are cached locally (TTL: 5 minutes).
 */

const ROLES_KEY          = 'roles';
const SYNC_PAGE_KEY      = 'sync.oneNotePageId';
const SYNC_SECTION_KEY   = 'sync.oneNoteSectionId';
const LAST_SYNC_KEY      = 'sync.lastAt';
const CALENDAR_CACHE_KEY = 'calendar.cache';
const CALENDAR_TTL_MS    = 5 * 60 * 1000;

// ── Roles ──────────────────────────────────────────────────────────────────────
function getRoles(store) {
  return store.get(ROLES_KEY) || [];
}

function saveRoles(store, roles) {
  store.set(ROLES_KEY, roles);
}

// ── Calendar cache ─────────────────────────────────────────────────────────────
function getCachedEvents(store) {
  const cache = store.get(CALENDAR_CACHE_KEY);
  if (!cache) return null;
  if (Date.now() - (cache.fetchedAt || 0) > CALENDAR_TTL_MS) return null;
  return cache.events;
}

function setCachedEvents(store, events) {
  store.set(CALENDAR_CACHE_KEY, { events, fetchedAt: Date.now() });
}

// ── Microsoft sync helpers ─────────────────────────────────────────────────────
// Called by the renderer after user sets up a sync section in OneNote settings.
function getSyncConfig(store) {
  return {
    pageId:    store.get(SYNC_PAGE_KEY)    || null,
    sectionId: store.get(SYNC_SECTION_KEY) || null,
    lastSync:  store.get(LAST_SYNC_KEY)    || null,
  };
}

function setSyncConfig(store, { pageId, sectionId }) {
  if (pageId)    store.set(SYNC_PAGE_KEY, pageId);
  if (sectionId) store.set(SYNC_SECTION_KEY, sectionId);
}

function markSynced(store) {
  store.set(LAST_SYNC_KEY, new Date().toISOString());
}

module.exports = { getRoles, saveRoles, getCachedEvents, setCachedEvents, getSyncConfig, setSyncConfig, markSynced };
