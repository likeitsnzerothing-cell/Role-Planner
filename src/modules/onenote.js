/**
 * onenote.js
 * Microsoft Graph API — OneNote
 * Notebooks, sections, pages — read, create, update, sync.
 */

const axios = require('axios');

const BASE = 'https://graph.microsoft.com/v1.0/me/onenote';

function headers(token, contentType = 'application/json') {
  return { Authorization: `Bearer ${token}`, 'Content-Type': contentType };
}

// ── Notebooks ──────────────────────────────────────────────────────────────────
async function getNotebooks(token) {
  if (!token) return { error: 'not_authenticated' };
  try {
    const res = await axios.get(`${BASE}/notebooks`, {
      headers: headers(token),
      params: { $select: 'id,displayName,lastModifiedDateTime,links', $orderby: 'lastModifiedDateTime desc' },
    });
    return { success: true, notebooks: res.data.value || [] };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'fetch_failed', message: err.message };
  }
}

// ── Sections ───────────────────────────────────────────────────────────────────
async function getSections(token, notebookId) {
  if (!token) return { error: 'not_authenticated' };
  try {
    const res = await axios.get(`${BASE}/notebooks/${notebookId}/sections`, {
      headers: headers(token),
      params: { $select: 'id,displayName,lastModifiedDateTime' },
    });
    return { success: true, sections: res.data.value || [] };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'fetch_failed', message: err.message };
  }
}

// ── Pages ──────────────────────────────────────────────────────────────────────
async function getPages(token, sectionId) {
  if (!token) return { error: 'not_authenticated' };
  try {
    const res = await axios.get(`${BASE}/sections/${sectionId}/pages`, {
      headers: headers(token),
      params: {
        $select: 'id,title,lastModifiedDateTime,createdDateTime,links,contentUrl',
        $orderby: 'lastModifiedDateTime desc',
        $top: 50,
      },
    });
    return { success: true, pages: res.data.value || [] };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'fetch_failed', message: err.message };
  }
}

// ── Recent Pages ───────────────────────────────────────────────────────────────
async function getRecentPages(token) {
  if (!token) return { error: 'not_authenticated' };
  try {
    const res = await axios.get(`${BASE}/pages`, {
      headers: headers(token),
      params: {
        $select: 'id,title,lastModifiedDateTime,createdDateTime,links,parentSection,parentNotebook',
        $orderby: 'lastModifiedDateTime desc',
        $top: 20,
        $expand: 'parentSection,parentNotebook',
      },
    });
    return { success: true, pages: res.data.value || [] };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'fetch_failed', message: err.message };
  }
}

// ── Create Page ────────────────────────────────────────────────────────────────
// Sends MIME multipart with HTML content
async function createPage(token, sectionId, title, content) {
  if (!token) return { error: 'not_authenticated' };

  const now    = new Date().toLocaleString();
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <title>${escHtml(title)}</title>
  <meta name="created" content="${new Date().toISOString()}" />
</head>
<body>
  <h1>${escHtml(title)}</h1>
  <p><em>Created from Role Planner — ${now}</em></p>
  <br/>
  ${content || ''}
</body>
</html>`;

  try {
    const res = await axios.post(
      `${BASE}/sections/${sectionId}/pages`,
      htmlBody,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/html' } }
    );
    return { success: true, page: res.data };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'create_failed', message: err.message };
  }
}

// ── Update Page (PATCH — append content) ──────────────────────────────────────
async function updatePage(token, pageId, markdownContent) {
  if (!token) return { error: 'not_authenticated' };

  const now     = new Date().toLocaleString();
  const commands = [{
    action:  'append',
    target:  'body',
    content: `<hr/><p><strong>Updated via Role Planner — ${now}</strong></p><p>${escHtml(markdownContent).replace(/\n/g, '<br/>')}</p>`,
    position: 'after',
  }];

  try {
    await axios.patch(
      `${BASE}/pages/${pageId}/content`,
      commands,
      { headers: headers(token) }
    );
    return { success: true };
  } catch (err) {
    return { error: err.response?.data?.error?.code || 'update_failed', message: err.message };
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { getNotebooks, getSections, getPages, getRecentPages, createPage, updatePage };
