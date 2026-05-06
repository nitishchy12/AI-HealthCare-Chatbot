import api from './api';

const cache = new Map();
const DEFAULT_TTL_MS = 15000;

const getCached = async (key, loader, ttlMs = DEFAULT_TTL_MS) => {
  const cachedEntry = cache.get(key);
  const now = Date.now();

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.value;
  }

  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
};

const invalidateCache = (...keys) => {
  keys.forEach((key) => cache.delete(key));
};

export const registerUser = async (payload) => (await api.post('/auth/register', payload)).data;
export const loginUser    = async (payload) => (await api.post('/auth/login',    payload)).data;

/* ── Conversations ───────────────────────────────────────────────── */
export const getConversations = async (page = 1, limit = 20) =>
  getCached(
    `conversations:${page}:${limit}`,
    async () => (await api.get(`/conversations?page=${page}&limit=${limit}`)).data,
    10000,
  );

export const createConversation = async (payload = {}) => {
  const res = (await api.post('/conversations', payload)).data;
  invalidateCache(...Array.from(cache.keys()).filter((k) => k.startsWith('conversations:')));
  return res;
};

export const addConversationSystemMessage = async (id, content) => {
  const res = (await api.post(`/conversations/${id}/system-message`, { content })).data;
  invalidateCache(`conversation:${id}`, `convMessages:${id}:1`, ...Array.from(cache.keys()).filter((k) => k.startsWith('conversations:')));
  return res;
};

export const getConversation = async (id) =>
  getCached(`conversation:${id}`, async () => (await api.get(`/conversations/${id}`)).data, 8000);

export const renameConversation = async (id, title) => {
  const res = (await api.patch(`/conversations/${id}`, { title })).data;
  invalidateCache(`conversation:${id}`, ...Array.from(cache.keys()).filter((k) => k.startsWith('conversations:')));
  return res;
};

export const deleteConversation = async (id) => {
  const res = (await api.delete(`/conversations/${id}`)).data;
  invalidateCache(`conversation:${id}`, ...Array.from(cache.keys()).filter((k) => k.startsWith('conversations:')));
  return res;
};

export const getConversationMessages = async (id, page = 1, limit = 50) =>
  getCached(
    `convMessages:${id}:${page}`,
    async () => (await api.get(`/conversations/${id}/messages?page=${page}&limit=${limit}`)).data,
    5000,
  );

export const searchConversations = async (q, page = 1, limit = 20) =>
  (await api.get(`/conversations/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`)).data;
export const sendChat = async (payload) => {
  // payload may include { question, language, conversation_id }
  const response = (await api.post('/chat', payload)).data;
  Array.from(cache.keys())
    .filter((key) =>
      key.startsWith('chatHistory:') ||
      key.startsWith('conversations:') ||
      key.startsWith('convMessages:') ||
      key === 'history' || key === 'reports' || key === 'notifications',
    )
    .forEach((key) => cache.delete(key));
  return response;
};
export const getChatHistory = async (page = 1, limit = 10) =>
  getCached(`chatHistory:${page}:${limit}`, async () => (await api.get(`/chat/history?page=${page}&limit=${limit}`)).data, 5000);
export const clearChatHistory = async () => {
  const response = (await api.delete('/chat/history')).data;
  Array.from(cache.keys())
    .filter((key) => key.startsWith('chatHistory:') || key === 'history' || key === 'reports' || key === 'notifications')
    .forEach((key) => cache.delete(key));
  return response;
};
export const getHospitalsByCity = async (city, specialization = '') =>
  getCached(
    `hospitals:${city}:${specialization}`,
    async () => (await api.get(`/hospitals?city=${encodeURIComponent(city)}&specialization=${encodeURIComponent(specialization)}`)).data,
    15000
  );
export const getNearbyHospitals = async ({ lat, lng, radius = 50, specialty = '' }) =>
  (await api.get(
    `/hospitals/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radius)}&specialty=${encodeURIComponent(specialty)}`,
  )).data;
export const addHospital = async (payload) => {
  const response = (await api.post('/hospitals', payload)).data;
  Array.from(cache.keys())
    .filter((key) => key.startsWith('hospitals:'))
    .forEach((key) => cache.delete(key));
  return response;
};
export const updateHospital = async (id, payload) => {
  const response = (await api.put(`/hospitals/${id}`, payload)).data;
  Array.from(cache.keys())
    .filter((key) => key.startsWith('hospitals:'))
    .forEach((key) => cache.delete(key));
  return response;
};
export const deleteHospital = async (id) => {
  const response = (await api.delete(`/hospitals/${id}`)).data;
  Array.from(cache.keys())
    .filter((key) => key.startsWith('hospitals:'))
    .forEach((key) => cache.delete(key));
  return response;
};
export const getDiseases = async () => getCached('diseases', async () => (await api.get('/diseases')).data);
export const addDisease = async (payload) => {
  const response = (await api.post('/diseases', payload)).data;
  invalidateCache('diseases');
  return response;
};
export const updateDisease = async (id, payload) => {
  const response = (await api.put(`/diseases/${id}`, payload)).data;
  invalidateCache('diseases');
  return response;
};
export const deleteDisease = async (id) => {
  const response = (await api.delete(`/diseases/${id}`)).data;
  invalidateCache('diseases');
  return response;
};
export const runSymptomCheck = async (payload) => (await api.post('/symptoms', payload)).data;
export const getSymptomChecks = async () => getCached('symptoms', async () => (await api.get('/symptoms')).data, 10000);
export const getHealthHistory = async () => getCached('history', async () => (await api.get('/history')).data, 10000);
export const getHealthReport = async () => getCached('reports', async () => (await api.get('/reports')).data, 10000);
export const getReportInsights = async (refresh = false) =>
  (await api.get(`/reports/insights${refresh ? '?refresh=true' : ''}`)).data;
export const downloadReportPdf = async () =>
  (await api.get('/reports/pdf', { responseType: 'blob' }));
export const getHealthTips = async () => getCached('tips', async () => (await api.get('/tips')).data, 30000);
export const addHealthTip = async (payload) => {
  const response = (await api.post('/tips', payload)).data;
  invalidateCache('tips');
  return response;
};
export const updateHealthTip = async (id, payload) => {
  const response = (await api.put(`/tips/${id}`, payload)).data;
  invalidateCache('tips');
  return response;
};
export const deleteHealthTip = async (id) => {
  const response = (await api.delete(`/tips/${id}`)).data;
  invalidateCache('tips');
  return response;
};
export const getProfile = async () => getCached('profile', async () => (await api.get('/profile')).data, 10000);
export const updateProfile = async (payload) => {
  const response = (await api.put('/profile', payload)).data;
  invalidateCache('profile');
  return response;
};
export const getNotifications = async () => getCached('notifications', async () => (await api.get('/notifications')).data, 10000);
