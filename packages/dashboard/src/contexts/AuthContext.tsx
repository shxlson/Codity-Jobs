import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { auth, User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("codity_token")
  );
  const [isLoading, setIsLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    auth
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem("codity_token");
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await auth.login({ email, password });
    localStorage.setItem("codity_token", result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await auth.register({ name, email, password });
      localStorage.setItem("codity_token", result.token);
      setToken(result.token);
      setUser(result.user);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("codity_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
