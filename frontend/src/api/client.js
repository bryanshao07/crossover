import axios from "axios";
import { enc } from "../lib/format";

const base = import.meta.env.VITE_API_BASE_URL || "/api";
const http = axios.create({ baseURL: base, withCredentials: true });

export const api = {
  getPlayers: () => http.get("/players").then((r) => r.data),
  getPlayer: (name) => http.get(`/player/${enc(name)}`).then((r) => r.data),
  compare: (a, b) => http.get(`/compare/${enc(a)}/${enc(b)}`).then((r) => r.data),
  getUniverse: () => http.get("/universe").then((r) => r.data),
  explain: (a, b) => http.get(`/explain/${enc(a)}/${enc(b)}`).then((r) => r.data),
  search: ({ q, sport, position }) =>
    http
      .get("/search", { params: { q: q || undefined, sport: sport || undefined, position: position || undefined } })
      .then((r) => r.data),

  signup: (email, password) => http.post("/auth/signup", { email, password }).then((r) => r.data),
  login: (email, password) => http.post("/auth/login", { email, password }).then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  getMe: () => http.get("/auth/me").then((r) => r.data),

  getComparisons: () => http.get("/comparisons").then((r) => r.data),
  createComparison: (player_a, player_b, similarity_score) =>
    http.post("/comparisons", { player_a, player_b, similarity_score }).then((r) => r.data),
  deleteComparison: (id) => http.delete(`/comparisons/${id}`),

  getFavorites: () => http.get("/favorites").then((r) => r.data),
  createFavorite: (playerName) => http.post("/favorites", { player_name: playerName }).then((r) => r.data),
  deleteFavorite: (id) => http.delete(`/favorites/${id}`),
};
