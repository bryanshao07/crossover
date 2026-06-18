import axios from "axios";
import { enc } from "../lib/format";

const base = import.meta.env.VITE_API_BASE_URL || "/api";
const http = axios.create({ baseURL: base });

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
};
