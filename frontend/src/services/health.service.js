import api from './api';

export const registerUser = async (payload) => (await api.post('/auth/register', payload)).data;
export const loginUser = async (payload) => (await api.post('/auth/login', payload)).data;
export const sendChat = async (payload) => (await api.post('/chat', payload)).data;
export const getChatHistory = async (page = 1, limit = 10) => (await api.get(`/chat/history?page=${page}&limit=${limit}`)).data;
export const getHospitalsByCity = async (city, specialization = '') =>
  (await api.get(`/hospitals?city=${encodeURIComponent(city)}&specialization=${encodeURIComponent(specialization)}`)).data;
export const addHospital = async (payload) => (await api.post('/hospitals', payload)).data;
export const getDiseases = async () => (await api.get('/diseases')).data;
export const addDisease = async (payload) => (await api.post('/diseases', payload)).data;
export const runSymptomCheck = async (payload) => (await api.post('/symptoms', payload)).data;
export const getSymptomChecks = async () => (await api.get('/symptoms')).data;
export const getHealthHistory = async () => (await api.get('/history')).data;
export const getHealthReport = async () => (await api.get('/reports')).data;
export const getHealthTips = async () => (await api.get('/tips')).data;
export const addHealthTip = async (payload) => (await api.post('/tips', payload)).data;
