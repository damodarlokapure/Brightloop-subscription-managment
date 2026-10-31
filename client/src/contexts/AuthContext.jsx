import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'brightloop-demo-auth';
const USERS_KEY = 'brightloop-demo-users';

const seedUsers = [
  { id: 'admin-1', name: 'Lena Adams', email: 'admin@brightloop.local', password: 'SecurePass!23', role: 'ADMIN' },
  { id: 'staff-1', name: 'Marcus Lee', email: 'staff@brightloop.local', password: 'SecurePass!23', role: 'STAFF' },
  { id: 'customer-1', name: 'Ava Patel', email: 'customer@brightloop.local', password: 'SecurePass!23', role: 'CUSTOMER' },
];

function getStoredUsers() {
  if (typeof window === 'undefined') return seedUsers;

  const saved = window.localStorage.getItem(USERS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return seedUsers;
    }
  }

  window.localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers));
  return seedUsers;
}

function getStoredAuth() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredAuth()?.user ?? null);
  const [token, setToken] = useState(() => getStoredAuth()?.token ?? null);

  const persistAuth = (nextUser, nextToken) => {
    if (typeof window !== 'undefined') {
      const payload = nextUser && nextToken ? { user: nextUser, token: nextToken } : null;
      if (payload) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const login = async ({ email, password }) => {
    const users = getStoredUsers();
    const matched = users.find(
      (entry) => entry.email.toLowerCase() === email.trim().toLowerCase() && entry.password === password,
    );

    if (!matched) {
      throw new Error('Your email or password is incorrect.');
    }

    const nextUser = {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
    };

    const nextToken = `${matched.role.toLowerCase()}-demo-token`;
    setUser(nextUser);
    setToken(nextToken);
    persistAuth(nextUser, nextToken);

    return nextUser;
  };

  const signup = async ({ name, email, password }) => {
    if (!name || name.trim().length < 2) {
      throw new Error('Please enter your full name.');
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;
    if (!passwordPattern.test(password)) {
      throw new Error('Password must be at least 9 characters, include uppercase, lowercase, and a special character.');
    }

    const users = getStoredUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const emailTaken = users.some((entry) => entry.email.toLowerCase() === normalizedEmail);

    if (emailTaken) {
      throw new Error('An account with this email already exists.');
    }

    const nextUserRecord = {
      id: `customer-${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'CUSTOMER',
    };

    const updatedUsers = [...users, nextUserRecord];
    window.localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));

    const nextUser = {
      id: nextUserRecord.id,
      name: nextUserRecord.name,
      email: nextUserRecord.email,
      role: 'CUSTOMER',
    };

    const nextToken = 'customer-demo-token';
    setUser(nextUser);
    setToken(nextToken);
    persistAuth(nextUser, nextToken);

    return nextUser;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    persistAuth(null, null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export const roleLabels = {
  ADMIN: 'Admin',
  STAFF: 'Staff',
  CUSTOMER: 'Customer',
};

export const roleRedirects = {
  ADMIN: '/admin',
  STAFF: '/staff',
  CUSTOMER: '/portal',
};
