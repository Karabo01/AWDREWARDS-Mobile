import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '@/types/user';
import { storage } from '@/utils/storage';
import { API_BASE_URL } from '@/utils/api';
import { DeviceEventEmitter } from 'react-native';

interface AuthContextType extends AuthState {
  login: (phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  selectedTenantId: string | null;
  setSelectedTenantId: (tenantId: string | null) => void;
  tenants: { _id: string; name: string }[];
  fetchTenants: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Place your app signature here (must match backend)
const APP_SIGNATURE = '2d1e7f8b-4c9a-4e2b-9f3d-8b7e6c5a1d2f$!@';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [selectedTenantId, setSelectedTenantIdState] = useState<string | null>(null);
  const [tenants, setTenants] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    checkAuthState();
  }, []);

  // Persist selectedTenantId in storage
  useEffect(() => {
    storage.getItem('selectedTenantId').then(id => {
      if (id) setSelectedTenantIdState(id);
    });
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('AuthContext: Checking auth state...');
      const tokenPromise = storage.getItem('authToken');
      const timeout = new Promise<string | null>((_, reject) =>
        setTimeout(() => reject(new Error('storage.getItem timeout')), 5000)
      );
      const token = await Promise.race([tokenPromise, timeout]);
      console.log('AuthContext: Got token', token);
      if (token) {
        const user = await fetchUserProfile(token);
        console.log('AuthContext: Got user', user);
        if (user) {
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const login = async (phoneNumber: string, password: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-awd-app-signature': APP_SIGNATURE,
        },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await storage.setItem('authToken', data.token);
        const points = typeof data.user.points === 'object' ? 
          data.user.points.$numberInt || 0 : 
          data.user.points || 0;

        // Ensure passwordChanged is present and boolean
        const passwordChanged = typeof data.user.passwordChanged === 'boolean'
          ? data.user.passwordChanged
          : false;

        setAuthState({
          user: {
            ...data.user,
            points: Number(points),
            passwordChanged,
          },
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return false;
      }
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await storage.removeItem('authToken');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error; // Propagate error to handle in UI
    }
  };

  const refreshUser = async () => {
    try {
      const token = await storage.getItem('authToken');
      if (token) {
        const user = await fetchUserProfile(token);
        if (user) {
          setAuthState(prev => ({
            ...prev,
            user,
          }));
        }
      }
      // Emit global refresh event for all tabs
      DeviceEventEmitter.emit('refreshAllTabs');
    } catch (error) {
      console.error('User refresh failed:', error);
    }
  };

  const fetchUserProfile = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-awd-app-signature': APP_SIGNATURE,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Profile fetch failed:', error);
      return null;
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants`, {
        headers: {
          'x-awd-app-signature': APP_SIGNATURE,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(Array.isArray(data.tenants) ? data.tenants : []);
      } else {
        setTenants([]);
      }
    } catch (error) {
      setTenants([]);
    }
  };

  // Fetch tenants after login
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchTenants();
    }
  }, [authState.isAuthenticated]);

  const setSelectedTenantId = (tenantId: string | null) => {
    setSelectedTenantIdState(tenantId);
    if (tenantId) {
      storage.setItem('selectedTenantId', tenantId);
    } else {
      storage.removeItem('selectedTenantId');
    }
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout,
      refreshUser,
      selectedTenantId,
      setSelectedTenantId,
      tenants,
      fetchTenants,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}