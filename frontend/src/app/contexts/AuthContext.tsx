import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getMe, getToken, login as apiLogin, register as apiRegister, setToken } from '../lib/api';
import { mapRole, toUser } from '../lib/mappers';
import { User, UserRole } from '../lib/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  signup: (email: string, password: string, name: string, role?: UserRole) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = async () => {
    const me = await getMe();
    setUser(toUser(me));
  };

  const login = async (email: string, password: string) => {
    const auth = await apiLogin(email, password);
    setToken(auth.token);
    const me = await getMe();
    const loggedInUser = toUser(me);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const signup = async (email: string, password: string, name: string, role: UserRole = 'member') => {
    const auth = await apiRegister(name, email, password, role);
    setToken(auth.token);
    const me = await getMe();
    const newUser = toUser(me);
    if (!newUser.role && auth.roles?.length) {
      newUser.role = mapRole(auth.roles);
    }
    setUser(newUser);
    return newUser;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;
    refreshUser()
      .then(() => {
        if (!active) return;
      })
      .catch(() => {
        if (!active) return;
        setToken(null);
        setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, refreshUser }}>
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
