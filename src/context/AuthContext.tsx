import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiGet, apiPost } from '../services/apiClient';

export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      // Validate token by making a test request
      apiGet<User>('/auth/me', { authToken: storedToken })
        .then(() => {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        })
        .catch(error => {
          console.error('Erro ao validar token:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiPost('/auth/login', { email, password });
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const register = async (email: string, username: string, password: string, role: string) => {
    const data = await apiPost('/auth/register', { email, username, password, role });
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  // Global error handler for 401 responses
  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.status === 401) {
        console.log('Erro 401 detectado, fazendo logout...');
        logout();
      }
    };

    window.addEventListener('unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
