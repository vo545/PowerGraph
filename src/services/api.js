import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../utils/migrations.js';

const API_URL = import.meta.env.VITE_API_URL || '';
const JWT_KEY_PREFIX = 'powergraph_jwt_';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function getJwt(email) {
  const key = `${JWT_KEY_PREFIX}${email}`;
  const token = safeLocalStorageGet(key, '');
  if (!token) return '';
  const payload = decodeJwtPayload(token);
  if (!payload) {
    safeLocalStorageRemove(key);
    return '';
  }
  if (payload?.exp && payload.exp * 1000 <= Date.now()) {
    safeLocalStorageRemove(key);
    return '';
  }
  return token;
}

export function setJwt(email, token) {
  if (token) safeLocalStorageSet(`${JWT_KEY_PREFIX}${email}`, token);
  else safeLocalStorageRemove(`${JWT_KEY_PREFIX}${email}`);
}

export function getJwtStorageKey(email) {
  return `${JWT_KEY_PREFIX}${email}`;
}

export async function apiCall(email, path, method = 'GET', body) {
  if (!API_URL) return null;
  const token = getJwt(email);
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return res.json();
    if (res.status === 401) setJwt(email, '');
  } catch {}
  return null;
}

export async function backendLogin(email, password, mode = 'login') {
  if (!API_URL) return null;
  try {
    let res = await fetch(`${API_URL}/api/auth/${mode === 'signup' ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) {
      const { token } = await res.json();
      setJwt(email, token);
      return token;
    }
    if (mode === 'signup' && res.status === 409) {
      res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (res.ok) {
        const { token } = await res.json();
        setJwt(email, token);
        return token;
      }
    }
  } catch {}
  return null;
}

export async function pullFromBackend(email) {
  return apiCall(email, '/api/sync');
}

export { API_URL };
