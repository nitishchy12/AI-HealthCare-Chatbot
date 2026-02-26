import api from './api';

export const registerUser = async (payload) => (await api.post('/auth/register', payload)).data;
export const loginUser = async (payload) => (await api.post('/auth/login', payload)).data;
export const sendChat = async (payload) => (await api.post('/chat', payload)).data;
export const getChatHistory = async (page = 1, limit = 10) => (await api.get(`/chat/history?page=${page}&limit=${limit}`)).data;
export const getHospitalsByCity = async (city) => (await api.get(`/hospitals?city=${encodeURIComponent(city)}`)).data;
export const addHospital = async (payload) => (await api.post('/hospitals', payload)).data;
export const getDiseases = async () => (await api.get('/diseases')).data;
export const addDisease = async (payload) => (await api.post('/diseases', payload)).data;
