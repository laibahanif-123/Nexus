import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('nexus_token');
  if (token && req.headers) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'business_nexus_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      API.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.user));
        })
        .catch(() => {
          localStorage.removeItem('nexus_token');
          localStorage.removeItem(USER_STORAGE_KEY);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      
      if (res.data.user.role !== role) {
        throw new Error(`Yeh account ${res.data.user.role} ka hai, ${role} ka nahi`);
      }

      localStorage.setItem('nexus_token', res.data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.user));
      setUser(res.data.user);
      toast.success('Successfully logged in!');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Login failed';
      toast.error(msg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await API.post('/auth/register', { name, email, password, role });
      
      localStorage.setItem('nexus_token', res.data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.user));
      setUser(res.data.user);
      toast.success('Account created successfully!');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Registration failed';
      toast.error(msg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Password reset instructions sent to your email');
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  };

  const logout = (): void => {
    setUser(null);
    localStorage.removeItem('nexus_token');
    localStorage.removeItem(USER_STORAGE_KEY);
    toast.success('Logged out successfully');
  };

  const updateProfile = async (userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const res = await API.put('/auth/profile', updates);
      setUser(res.data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data.user));
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Update failed';
      toast.error(msg);
      throw error;
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};