import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.getMe(),
    retry: false,
    staleTime: Infinity,
  });

  async function login(email, password) {
    const me = await api.login(email, password);
    queryClient.setQueryData(["auth", "me"], me);
    return me;
  }

  async function signup(email, password) {
    await api.signup(email, password);
    return login(email, password);
  }

  async function logout() {
    await api.logout();
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.removeQueries({ queryKey: ["comparisons"] });
    queryClient.removeQueries({ queryKey: ["favorites"] });
  }

  async function uploadAvatar(file) {
    const updated = await api.uploadAvatar(file);
    queryClient.setQueryData(["auth", "me"], updated);
    return updated;
  }

  async function setAvatarFromPlayer(playerName) {
    const updated = await api.setAvatarFromPlayer(playerName);
    queryClient.setQueryData(["auth", "me"], updated);
    return updated;
  }

  async function removeAvatar() {
    const updated = await api.removeAvatar();
    queryClient.setQueryData(["auth", "me"], updated);
    return updated;
  }

  const value = {
    user: user ?? null,
    loading: isLoading,
    login,
    signup,
    logout,
    uploadAvatar,
    setAvatarFromPlayer,
    removeAvatar,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
