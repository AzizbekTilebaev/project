import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, logout as apiLogout } from '../api/auth';
import { getStoredAuthToken, setStoredAuthToken } from '../lib/apiHeaders';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await fetchMe();
      setUser(data.user || null);
      return data.user || null;
    } catch {
      setStoredAuthToken('');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginSuccess = useCallback((payload) => {
    if (payload?.token) setStoredAuthToken(payload.token);
    if (payload?.user) setUser(payload.user);
    else if (payload && 'user' in payload) setUser(null);
    setLoading(false);
    try {
      window.dispatchEvent(new CustomEvent('qp:auth-changed', { detail: { authed: Boolean(payload?.user || payload?.token) } }));
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    setStoredAuthToken('');
    setUser(null);
    try {
      window.dispatchEvent(new CustomEvent('qp:auth-changed', { detail: { authed: false } }));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refresh,
      loginSuccess,
      logout,
    }),
    [user, loading, refresh, loginSuccess, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ishinde qollanılıwı kerek');
  return ctx;
}
