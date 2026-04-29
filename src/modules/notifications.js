/**
 * notifications.js
 * Smart notifications fired from actual user data:
 *   - Task deadlines: 1 month, 2 weeks, 1 week, 3 days, 1 day, on the day
 *   - Task start dates: on the day
 *   - Calendar blocks: on the day / pre-meeting
 * Plus manual reminder types (scheduled, overdue, manual snooze)
 */

const { Notification } = require('electron');
const cron = require('node-cron');

const STORE_KEY = 'notifications';
const FIRED_KEY = 'firedNotifs';

const activeCrons  = new Map();
const activeTimers = new Map();

// Deadline warning intervals in days
const DEADLINE_WARNINGS = [
  { days: 30, label: '1 month'  },
  { days: 14, label: '2 weeks'  },
  { days: 7,  label: '1 week'   },
  { days: 3,  label: '3 days'   },
  { days: 1,  label: 'tomorrow' },
  { days: 0,  label: 'today'    },
];

function init(store, mainWindow) {
  scheduleAll(store, mainWindow);
}

// ── Fire ───────────────────────────────────────────────────────────────────────
function fire(title, body, mainWindow, notifId = null) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    if (mainWindow && notifId) mainWindow.webContents.send('notification:clicked', notifId);
  });
  n.show();
}

// ── Main scheduler ─────────────────────────────────────────────────────────────
function startScheduler(store, mainWindow) {
  cron.schedule('* * * * *', () => tick(store, mainWindow));
  tick(store, mainWindow);
}

function tick(store, mainWindow) {
  checkSmartDeadlines(store, mainWindow);
  checkSmartStartDates(store, mainWindow);
  checkPreMeeting(store, mainWindow);
  checkOverdue(store, mainWindow);
}

// ── Smart: Deadline warnings ──────────────────────────────────────────────────
function checkSmartDeadlines(store, mainWindow) {
  const roles  = store.get('roles') || [];
  const fired  = store.get(FIRED_KEY) || {};
  const now    = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const role of roles) {
    for (const task of (role.responsibilities || [])) {
      if (task.done || !task.deadline) continue;
      const deadlineDate = new Date(task.deadline);
      const deadlineMidnight = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
      const daysLeft = Math.round((deadlineMidnight - todayMidnight) / 86400000);

      for (const warning of DEADLINE_WARNINGS) {
        if (daysLeft !== warning.days) continue;
        // Fire once per task per warning level per day
        const key = `deadline:${task.id}:${warning.days}:${todayMidnight.toDateString()}`;
        if (fired[key]) continue;
        fired[key] = true;
        store.set(FIRED_KEY, fired);

        const timeStr = deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const body = warning.days === 0
          ? `Due today${task.deadline.includes('T') ? ' at ' + timeStr : ''} · ${role.title}`
          : `Due ${warning.label} · ${role.title}`;

        fire(`📅 ${task.text}`, body, mainWindow, task.id);
      }
    }
  }
}

// ── Smart: Start date reminders ────────────────────────────────────────────────
function checkSmartStartDates(store, mainWindow) {
  const roles  = store.get('roles') || [];
  const fired  = store.get(FIRED_KEY) || {};
  const now    = new Date();
  const todayStr = now.toDateString();

  for (const role of roles) {
    for (const task of (role.responsibilities || [])) {
      if (task.done || !task.startDate) continue;
      const startDate = new Date(task.startDate);
      if (startDate.toDateString() !== todayStr) continue;

      const key = `start:${task.id}:${todayStr}`;
      if (fired[key]) continue;

      // Only fire after the start time (within the current minute)
      if (now < startDate) continue;
      if (now.getTime() - startDate.getTime() > 60000) continue; // only within 1 min window

      fired[key] = true;
      store.set(FIRED_KEY, fired);

      fire(
        `▶ Starting now: ${task.text}`,
        `${role.title}${task.duration ? ' · Est. ' + formatDuration(task.duration, task.durationUnit) : ''}`,
        mainWindow, task.id
      );
    }
  }
}

// ── Smart: Pre-meeting (calendar blocks) ──────────────────────────────────────
function checkPreMeeting(store, mainWindow) {
  const notifications = store.get(STORE_KEY) || [];
  const preMeeting = notifications.filter(n => n.type === 'pre-meeting' && n.enabled);
  if (!preMeeting.length) return;

  const events = (store.get('calendar.cache') || {}).events || [];
  const now    = Date.now();
  const fired  = store.get(FIRED_KEY) || {};

  // Also check local calendar blocks
  const blocks     = store.get('localcal.blocks') || [];
  const todayBlocks = getTodayBlocks(blocks);

  for (const n of preMeeting) {
    const minsBefore = n.minutesBefore || 15;

    for (const evt of events) {
      if (!evt.start) continue;
      const startMs = new Date(evt.start).getTime();
      const fireAt  = startMs - minsBefore * 60000;
      const key     = `pre:${n.id}:${evt.id}`;
      if (now >= fireAt && now < fireAt + 60000 && !fired[key]) {
        fired[key] = true;
        store.set(FIRED_KEY, fired);
        fire(`📅 Meeting in ${minsBefore} min`, `${evt.subject}${evt.location ? ' · ' + evt.location : ''}`, mainWindow, n.id);
      }
    }

    for (const b of todayBlocks) {
      if (!b.startTime) continue;
      const [hh, mm] = b.startTime.split(':').map(Number);
      const today    = new Date();
      const blockMs  = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm).getTime();
      const fireAt   = blockMs - minsBefore * 60000;
      const key      = `pre:${n.id}:block:${b.id}:${today.toDateString()}`;
      if (now >= fireAt && now < fireAt + 60000 && !fired[key]) {
        fired[key] = true;
        store.set(FIRED_KEY, fired);
        fire(`📅 Block in ${minsBefore} min`, b.title, mainWindow, n.id);
      }
    }
  }
}

// ── Smart: Overdue check ───────────────────────────────────────────────────────
function checkOverdue(store, mainWindow) {
  const notifications = store.get(STORE_KEY) || [];
  const overdueNotif  = notifications.find(n => n.type === 'overdue' && n.enabled);
  if (!overdueNotif) return;

  const roles  = store.get('roles') || [];
  const now    = Date.now();
  const fired  = store.get(FIRED_KEY) || {};
  const today  = new Date().toDateString();

  for (const role of roles) {
    for (const task of (role.responsibilities || [])) {
      if (task.done || !task.deadline) continue;
      if (new Date(task.deadline).getTime() >= now) continue;
      const key = `overdue:${task.id}:${today}`;
      if (fired[key]) continue;
      fired[key] = true;
      store.set(FIRED_KEY, fired);
      fire(`⚠️ Overdue`, `"${task.text}" · ${role.title}`, mainWindow, task.id);
    }
  }
}

// ── Scheduled (daily at time) ─────────────────────────────────────────────────
function scheduleAll(store, mainWindow) {
  for (const [id, job] of activeCrons) { job.stop(); activeCrons.delete(id); }
  const notifications = store.get(STORE_KEY) || [];
  for (const n of notifications) {
    if (n.type === 'scheduled' && n.enabled && n.time) scheduleOne(n, store, mainWindow);
  }
}

function scheduleOne(n, store, mainWindow) {
  const [hh, mm] = (n.time || '09:00').split(':').map(Number);
  const expr = `${mm} ${hh} * * *`;
  if (!cron.validate(expr)) return;
  const job = cron.schedule(expr, () => {
    const latest = (store.get(STORE_KEY) || []).find(x => x.id === n.id);
    if (!latest || !latest.enabled) return;
    fire(latest.title || 'Role Planner Reminder', latest.body || '', mainWindow, n.id);
  });
  activeCrons.set(n.id, job);
}

// ── Manual snooze ─────────────────────────────────────────────────────────────
function snooze(store, notifId, minutes, mainWindow) {
  if (activeTimers.has(notifId)) { clearTimeout(activeTimers.get(notifId)); activeTimers.delete(notifId); }
  const notifications = store.get(STORE_KEY) || [];
  const n = notifications.find(x => x.id === notifId);
  const handle = setTimeout(() => {
    fire(`🔁 ${n?.title || 'Reminder'}`, n?.body || '', mainWindow, notifId);
    activeTimers.delete(notifId);
  }, minutes * 60000);
  activeTimers.set(notifId, handle);
  return { success: true, firesAt: new Date(Date.now() + minutes * 60000).toISOString() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTodayBlocks(blocks) {
  const now = new Date();
  const dow = now.getDay();
  const todayStr = now.toDateString();
  const result = [];
  for (const b of blocks) {
    if (!b.recurring && b.date && new Date(b.date).toDateString() === todayStr) { result.push(b); continue; }
    if (b.recurring && b.recurDays && b.recurDays.includes(dow)) {
      const from = b.recurFrom ? new Date(b.recurFrom) : null;
      const to   = b.recurTo   ? new Date(b.recurTo)   : null;
      if (from && now < from) continue;
      if (to   && now > to)   continue;
      result.push(b);
    }
  }
  return result;
}

function formatDuration(value, unit) {
  if (!value) return '';
  const u = unit || 'minutes';
  return `${value} ${u}`;
}

function getAll(store)          { return store.get(STORE_KEY) || []; }
function saveAll(store, notifs) {
  store.set(STORE_KEY, notifs);
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows()[0] || null;
  scheduleAll(store, win);
  return { success: true };
}

module.exports = { init, fire, startScheduler, getAll, saveAll, snooze };
