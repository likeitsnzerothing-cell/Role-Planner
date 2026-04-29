/**
 * auth.js
 * Microsoft OAuth via MSAL Node (PKCE / Authorization Code flow).
 * Handles login, token refresh, logout, and status.
 *
 * Scopes requested cover both Teams Calendar and OneNote.
 */

const { shell, BrowserWindow } = require('electron');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Read Azure config from store (set by the user in Settings)
function getConfig(store) {
  const cfg = store.get('msalConfig') || {};
  return {
    clientId:    cfg.clientId    || '',
    tenantId:    cfg.tenantId    || 'common',
    redirectUri: cfg.redirectUri || 'http://localhost:3737/auth/callback',
  };
}

const SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
  'Notes.ReadWrite.All',
  'Notes.Create',
];

// ── PKCE Helpers ──────────────────────────────────────────────────────────────
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

async function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(mainWindow) {
  const store = require('electron-store');
  const s = new store();
  const cfg = getConfig(s);

  if (!cfg.clientId) {
    return { error: 'no_config', message: 'No Azure App credentials configured. Go to Settings → Microsoft 365.' };
  }

  const verifier   = generateCodeVerifier();
  const challenge  = await generateCodeChallenge(verifier);
  const state      = crypto.randomBytes(16).toString('hex');
  const port       = 3737;

  const authUrl = new URL(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id',             cfg.clientId);
  authUrl.searchParams.set('response_type',         'code');
  authUrl.searchParams.set('redirect_uri',          cfg.redirectUri);
  authUrl.searchParams.set('scope',                 SCOPES.join(' '));
  authUrl.searchParams.set('state',                 state);
  authUrl.searchParams.set('code_challenge',        challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt',                'select_account');

  return new Promise((resolve, reject) => {
    // Start local redirect server
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname !== '/auth/callback') {
        res.end('Not found'); return;
      }

      const { code, state: retState, error } = parsed.query;
      res.end('<html><body style="font-family:sans-serif;background:#0e0e0e;color:#e8c547;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>✓ Authenticated — you can close this tab.</h2></body></html>');
      server.close();

      if (error)          { resolve({ error, message: parsed.query.error_description }); return; }
      if (retState !== state) { resolve({ error: 'state_mismatch' }); return; }

      try {
        const tokens = await exchangeCode(cfg, code, verifier);
        saveTokens(s, tokens);
        mainWindow.webContents.send('auth:changed', { loggedIn: true });
        resolve({ success: true, user: parseJwt(tokens.id_token) });
      } catch (err) {
        resolve({ error: 'token_exchange', message: err.message });
      }
    });

    server.listen(port, '127.0.0.1', () => {
      shell.openExternal(authUrl.toString());
    });

    server.on('error', (err) => resolve({ error: 'server', message: err.message }));

    // Timeout after 5 minutes
    setTimeout(() => { server.close(); resolve({ error: 'timeout' }); }, 5 * 60 * 1000);
  });
}

// ── Token Exchange ────────────────────────────────────────────────────────────
async function exchangeCode(cfg, code, verifier) {
  const axios = require('axios');
  const params = new URLSearchParams({
    client_id:     cfg.clientId,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  cfg.redirectUri,
    code_verifier: verifier,
    scope:         SCOPES.join(' '),
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

// ── Token Refresh ─────────────────────────────────────────────────────────────
async function refreshToken(store, refreshTok) {
  const axios = require('axios');
  const cfg = getConfig(store);
  const params = new URLSearchParams({
    client_id:     cfg.clientId,
    grant_type:    'refresh_token',
    refresh_token: refreshTok,
    scope:         SCOPES.join(' '),
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  saveTokens(store, res.data);
  return res.data.access_token;
}

// ── Get Valid Token ───────────────────────────────────────────────────────────
async function getToken(store) {
  const tokens = store.get('auth.tokens');
  if (!tokens) return null;

  const expiresAt = store.get('auth.expiresAt') || 0;
  const now = Date.now();

  // Refresh 5 minutes before expiry
  if (now >= expiresAt - 5 * 60 * 1000) {
    if (!tokens.refresh_token) return null;
    try {
      return await refreshToken(store, tokens.refresh_token);
    } catch {
      store.delete('auth.tokens');
      store.delete('auth.expiresAt');
      return null;
    }
  }

  return tokens.access_token;
}

// ── Status ────────────────────────────────────────────────────────────────────
function getStatus(store) {
  const tokens = store.get('auth.tokens');
  const user   = store.get('auth.user');
  return { loggedIn: !!tokens, user: user || null };
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout(store) {
  store.delete('auth.tokens');
  store.delete('auth.expiresAt');
  store.delete('auth.user');
  const cfg = getConfig(store);
  shell.openExternal(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/logout`);
  return { success: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function saveTokens(store, tokens) {
  store.set('auth.tokens', {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token:      tokens.id_token,
  });
  store.set('auth.expiresAt', Date.now() + (tokens.expires_in || 3600) * 1000);
  if (tokens.id_token) {
    store.set('auth.user', parseJwt(tokens.id_token));
  }
}

function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch { return {}; }
}

module.exports = { login, logout, getToken, getStatus };
