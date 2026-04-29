/**
 * calendar.js
 * Microsoft Graph API — Calendar (Teams / Outlook)
 * Reads and writes calendar events with role linking via extended properties.
 */

const axios = require('axios');

const BASE = 'https://graph.microsoft.com/v1.0';

// Extended property namespace for linking events to roles
const ROLE_EXT_NS   = 'String {66f5a359-4659-4830-9070-00040ec6ac6e} Name RolePlannerId';

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Get Events ────────────────────────────────────────────────────────────────
// Fetches events from now to `days` days ahead, including role metadata
async function getEvents(token, days = 14) {
  if (!token) return { error: 'not_authenticated' };

  const start = new Date().toISOString();
  const end   = new Date(Date.now() + days * 86400000).toISOString();

  try {
    const res = await axios.get(`${BASE}/me/calendarView`, {
      headers: headers(token),
      params: {
        startDateTime: start,
        endDateTime:   end,
        $select:       'id,subject,start,end,location,bodyPreview,isAllDay,organizer,attendees,webLink,singleValueExtendedProperties',
        $expand:       `singleValueExtendedProperties($filter=id eq '${ROLE_EXT_NS}')`,
        $orderby:      'start/dateTime',
        $top:          100,
      },
    });

    return {
      success: true,
      events: (res.data.value || []).map(normalizeEvent),
    };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'fetch_failed', message: err.message };
  }
}

// ── Create Event ───────────────────────────────────────────────────────────────
async function createEvent(token, data) {
  if (!token) return { error: 'not_authenticated' };

  const body = {
    subject:  data.subject,
    start:    { dateTime: data.start, timeZone: data.timeZone || 'UTC' },
    end:      { dateTime: data.end,   timeZone: data.timeZone || 'UTC' },
    body:     { contentType: 'HTML', content: data.body || '' },
    location: data.location ? { displayName: data.location } : undefined,
    attendees: (data.attendees || []).map(email => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    // Store linked roleId in an extended property
    singleValueExtendedProperties: data.roleId ? [{
      id:    ROLE_EXT_NS,
      value: data.roleId,
    }] : [],
    isOnlineMeeting: data.isOnlineMeeting ?? true,
    onlineMeetingProvider: data.isOnlineMeeting !== false ? 'teamsForBusiness' : undefined,
  };

  try {
    const res = await axios.post(`${BASE}/me/events`, body, { headers: headers(token) });
    return { success: true, event: normalizeEvent(res.data) };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'create_failed', message: err.message };
  }
}

// ── Update Event ───────────────────────────────────────────────────────────────
async function updateEvent(token, eventId, data) {
  if (!token) return { error: 'not_authenticated' };

  const body = {};
  if (data.subject)   body.subject = data.subject;
  if (data.start)     body.start   = { dateTime: data.start, timeZone: data.timeZone || 'UTC' };
  if (data.end)       body.end     = { dateTime: data.end,   timeZone: data.timeZone || 'UTC' };
  if (data.body)      body.body    = { contentType: 'HTML', content: data.body };
  if (data.location)  body.location = { displayName: data.location };

  try {
    const res = await axios.patch(`${BASE}/me/events/${eventId}`, body, { headers: headers(token) });
    return { success: true, event: normalizeEvent(res.data) };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'update_failed', message: err.message };
  }
}

// ── Delete Event ───────────────────────────────────────────────────────────────
async function deleteEvent(token, eventId) {
  if (!token) return { error: 'not_authenticated' };

  try {
    await axios.delete(`${BASE}/me/events/${eventId}`, { headers: headers(token) });
    return { success: true };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'delete_failed', message: err.message };
  }
}

// ── Normalize ─────────────────────────────────────────────────────────────────
function normalizeEvent(e) {
  const roleIdProp = (e.singleValueExtendedProperties || [])
    .find(p => p.id === ROLE_EXT_NS);

  return {
    id:          e.id,
    subject:     e.subject,
    start:       e.start?.dateTime,
    end:         e.end?.dateTime,
    isAllDay:    e.isAllDay,
    location:    e.location?.displayName || '',
    preview:     e.bodyPreview || '',
    organizer:   e.organizer?.emailAddress?.address || '',
    attendees:   (e.attendees || []).map(a => a.emailAddress?.address),
    webLink:     e.webLink,
    roleId:      roleIdProp?.value || null,
  };
}

module.exports = { getEvents, createEvent, updateEvent, deleteEvent };
