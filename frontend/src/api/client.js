import axios from "axios";
import { enc } from "../lib/format";

const base = import.meta.env.VITE_API_BASE_URL || "/api";
// X-Requested-With satisfies the backend CSRF header check on cookie-authed,
// state-changing endpoints (logout, avatar upload/delete). Sending it on every
// request is harmless and keeps the header present for those routes.
const http = axios.create({
  baseURL: base,
  withCredentials: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

export const api = {
  getPlayers: () => http.get("/players").then((r) => r.data),
  getPlayer: (name) => http.get(`/player/${enc(name)}`).then((r) => r.data),
  compare: (a, b) => http.get(`/compare/${enc(a)}/${enc(b)}`).then((r) => r.data),
  getUniverse: () => http.get("/universe").then((r) => r.data),
  explain: (a, b) => http.get(`/explain/${enc(a)}/${enc(b)}`).then((r) => r.data),
  search: ({ q, sport, position, mode }) =>
    http
      .get("/search", {
        params: {
          q: q || undefined,
          sport: sport || undefined,
          position: position || undefined,
          mode: mode || undefined,
        },
      })
      .then((r) => r.data),

  signup: (email, password) => http.post("/auth/signup", { email, password }).then((r) => r.data),
  login: (email, password) => http.post("/auth/login", { email, password }).then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  getMe: () => http.get("/auth/me").then((r) => r.data),

  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("file", file);
    return http.post("/auth/avatar/upload", form).then((r) => r.data);
  },
  setAvatarFromPlayer: (playerName) =>
    http.post("/auth/avatar/player", { player_name: playerName }).then((r) => r.data),
  removeAvatar: () => http.delete("/auth/avatar").then((r) => r.data),

  getComparisons: () => http.get("/comparisons").then((r) => r.data),
  createComparison: (player_a, player_b, similarity_score) =>
    http.post("/comparisons", { player_a, player_b, similarity_score }).then((r) => r.data),
  deleteComparison: (id) => http.delete(`/comparisons/${id}`),

  getFavorites: () => http.get("/favorites").then((r) => r.data),
  createFavorite: (playerName) => http.post("/favorites", { player_name: playerName }).then((r) => r.data),
  deleteFavorite: (id) => http.delete(`/favorites/${id}`),
};
