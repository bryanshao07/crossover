export const pct = (x) => `${Math.round(x * 100)}%`;
export const enc = (name) => encodeURIComponent(name);

export function resolveAvatarUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base}${url}`;
}
