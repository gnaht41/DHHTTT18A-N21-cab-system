import { create } from 'zustand';
import api from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password, role) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      // Clear old data from localStorage and set new user
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ isLoading: false, token, user, isAuthenticated: true });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true });
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ isAuthenticated: true, token, user });
      } else if (token) {
        set({ isAuthenticated: true, token });
      }
    } catch (e) {
      console.error('Error checking auth:', e);
    } finally {
      set({ isCheckingAuth: false });
    }
  }
}));
