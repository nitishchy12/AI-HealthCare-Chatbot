import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
} from '../lib/tokenStore';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const raw = atob(base64);

  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return;
    }

    const { data: keyData } = await api.get('/push/vapid-public-key');

    if (!keyData?.publicKey) {
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

    await api.post('/push/subscribe', {
      subscription: sub.toJSON(),
    });
  } catch (err) {
    console.error('Push setup failed:', err);
  }
}

export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');

    const sub = reg
      ? await reg.pushManager.getSubscription()
      : null;

    if (sub) {
      await api.delete('/push/unsubscribe', {
        data: { endpoint: sub.endpoint },
      }).catch(() => {});

      await sub.unsubscribe();
    }

    if (reg) {
      await reg.unregister();
    }
  } catch (err) {
    console.error('Failed to unregister push:', err);
  }
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => !!getAccessToken());

  const [user, setUser] = useState(() => getStoredUser());

  const [booting, setBoot] = useState(() => !!getRefreshToken());

  useEffect(() => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      setBoot(false);
      return;
    }

    api
      .post('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        const {
          token: newAccess,
          refreshToken: newRefresh,
        } = data.data;

        setAccessToken(newAccess);
        setRefreshToken(newRefresh);

        setToken(true);

        return api.get('/profile');
      })
      .then(({ data }) => {
        const u = data.data;

        setStoredUser(u);
        setUser(u);
      })
      .catch(() => {
        clearAccessToken();
        clearRefreshToken();
        clearStoredUser();

        setToken(false);
        setUser(null);
      })
      .finally(() => {
        setBoot(false);
      });

  }, []);

  const login = useCallback(
    ({ token: accessToken, refreshToken, user: u }) => {
      setAccessToken(accessToken);
      setRefreshToken(refreshToken);

      setStoredUser(u);

      setToken(true);
      setUser(u);

      registerPushSubscription();
    },
    []
  );

  const logout = useCallback(() => {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }

    clearAccessToken();
    clearRefreshToken();
    clearStoredUser();

    setToken(false);
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser) => {
    setStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      booting,
      login,
      logout,
      updateUser,
    }),
    [token, user, booting, login, logout, updateUser]
  );

  if (booting) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}



