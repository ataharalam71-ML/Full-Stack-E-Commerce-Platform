import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// The click-tracking redirect lives on the API root (/go/:id), not under /api.
export const GO_BASE = API_URL.replace(/\/api\/?$/, '');

/** Outbound affiliate link for a deal — always routed through the backend so it gets counted. */
export const goUrl = (dealId) => `${GO_BASE}/go/${dealId}`;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401 so the admin never sits in a broken "logged in but invalid token" state.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Pulls the readable message out of an axios error. */
export const errMsg = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error || err?.message || fallback;

export default api;
