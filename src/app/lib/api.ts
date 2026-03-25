import axios from 'axios';
import { toast } from './toast';

const apiBaseUrl =
  (import.meta as { env?: { API_URL?: string } }).env?.API_URL ??
  'https://st-api.korte.ph';

export const api = axios.create({
  baseURL: apiBaseUrl,
});

let lastUnauthorizedAt = 0;
let lastServerErrorAt = 0;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      setAuthToken(null);
      try {
        localStorage.removeItem('courtbook_auth');
      } catch {
        // Ignore storage errors.
      }

      const now = Date.now();
      if (now - lastUnauthorizedAt > 1500) {
        lastUnauthorizedAt = now;
        toast.error('Logged out', {
          description: 'Your session expired. Please log in again.',
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('courtbook:unauthorized'));
      }
    }
    if (status >= 500 && typeof window !== 'undefined') {
      const now = Date.now();
      if (now - lastServerErrorAt > 1500) {
        lastServerErrorAt = now;
        if (window.location.pathname !== '/500') {
          window.location.assign('/500');
        }
      }
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};
