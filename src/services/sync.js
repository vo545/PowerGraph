import { apiCall } from './api.js';

export async function pushSyncSnapshot(email, data) {
  return apiCall(email, '/api/sync', 'POST', data);
}

export async function pullSyncSnapshot(email) {
  return apiCall(email, '/api/sync');
}
