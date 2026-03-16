import api from './api';

export const registerUser = async (payload) => (await api.post('/auth/register', payload)).data;
export const loginUser = async (payload) => (await api.post('/auth/login', payload)).data;
export const sendChat = async (payload) => (await api.post('/chat', payload)).data;
export const getChatHistory = async (page = 1, limit = 10) => (await api.get(`/chat/history?page=${page}&limit=${limit}`)).data;
export const clearChatHistory = async () => (await api.delete('/chat/history')).data;
export const getHospitalsByCity = async (city, specialization = '') =>
  (await api.get(`/hospitals?city=${encodeURIComponent(city)}&specialization=${encodeURIComponent(specialization)}`)).data;
export const addHospital = async (payload) => (await api.post('/hospitals', payload)).data;
export const updateHospital = async (id, payload) => (await api.put(`/hospitals/${id}`, payload)).data;
export const deleteHospital = async (id) => (await api.delete(`/hospitals/${id}`)).data;
export const getDiseases = async () => (await api.get('/diseases')).data;
export const addDisease = async (payload) => (await api.post('/diseases', payload)).data;
export const updateDisease = async (id, payload) => (await api.put(`/diseases/${id}`, payload)).data;
export const deleteDisease = async (id) => (await api.delete(`/diseases/${id}`)).data;
export const runSymptomCheck = async (payload) => (await api.post('/symptoms', payload)).data;
export const getSymptomChecks = async () => (await api.get('/symptoms')).data;
export const getHealthHistory = async () => (await api.get('/history')).data;
export const getHealthReport = async () => (await api.get('/reports')).data;
export const getHealthTips = async () => (await api.get('/tips')).data;
export const addHealthTip = async (payload) => (await api.post('/tips', payload)).data;
export const updateHealthTip = async (id, payload) => (await api.put(`/tips/${id}`, payload)).data;
export const deleteHealthTip = async (id) => (await api.delete(`/tips/${id}`)).data;
export const getProfile = async () => (await api.get('/profile')).data;
export const updateProfile = async (payload) => (await api.put('/profile', payload)).data;
export const getNotifications = async () => (await api.get('/notifications')).data;
