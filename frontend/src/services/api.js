import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.error || error?.response?.data?.message || 'Something went wrong';
    window.dispatchEvent(new CustomEvent('app:error', { detail: { message } }));
    return Promise.reject(error);
  }
);

export default api;
