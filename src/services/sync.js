import { apiCall } from './api.js';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../utils/migrations.js';

const PENDING_SYNC_KEY_PREFIX = 'powergraph_pending_sync_';
const PENDING_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getPendingSyncKey(email) {
  return `${PENDING_SYNC_KEY_PREFIX}${email || ''}`;
}

export async function pushSyncSnapshot(email, data) {
  return apiCall(email, '/api/sync', 'POST', data);
}

export async function pullSyncSnapshot(email) {
  return apiCall(email, '/api/sync');
}

export function queueSyncSnapshot(email, data, reason = 'offline') {
  if (!email || !data) return null;
  const now = Date.now();
  const payload = {
    reason,
    createdAt: now,
    expiresAt: now + PENDING_SYNC_TTL_MS,
    updatedAt: now,
    data,
  };
  try {
    safeLocalStorageSet(getPendingSyncKey(email), JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function loadPendingSync(email) {
  if (!email) return null;
  try {
    const parsed = JSON.parse(safeLocalStorageGet(getPendingSyncKey(email), '') || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    if (Number(parsed.expiresAt) <= Date.now()) {
      safeLocalStorageRemove(getPendingSyncKey(email));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSync(email) {
  if (!email) return;
  safeLocalStorageRemove(getPendingSyncKey(email));
}

export async function flushPendingSync(email) {
  const pending = loadPendingSync(email);
  if (!pending?.data) return { ok: true, skipped: true };
  const result = await pushSyncSnapshot(email, pending.data);
  if (result) {
    clearPendingSync(email);
    return { ok: true };
  }
  return { ok: false };
}
