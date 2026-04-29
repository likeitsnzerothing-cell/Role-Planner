/**
 * store.js — Local data store helpers · v1.8.0
 */

const ROLES_KEY = 'roles';

function getRoles(store) {
  return store.get(ROLES_KEY) || [];
}

function saveRoles(store, roles) {
  store.set(ROLES_KEY, roles);
}

module.exports = { getRoles, saveRoles };
