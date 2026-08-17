import { useEffect, useState } from "react";

const SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "google-gsi-client";

// Marker written onto the <script> element itself once it resolves, so a
// second mount (e.g. remounting the auth page) can tell whether a
// previously-inserted tag already loaded or failed instead of waiting on a
// 'load'/'error' event that already fired and will never fire again.
function resolvedStatus() {
  if (window.google?.accounts?.id) return "loaded";
  const existing = document.getElementById(SCRIPT_ID);
  const marker = existing?.dataset.gsiStatus;
  return marker === "loaded" || marker === "failed" ? marker : "idle";
}

/**
 * Loads Google Identity Services on demand and reports load status.
 *
 * Loaded here rather than in index.html so only the auth page pays for it, and
 * so a blocked or failed script degrades to `{ ready: false }` — leaving the
 * email/password form fully functional — instead of throwing. `failed` is
 * reported distinctly from "still loading" so the caller can stop waiting
 * indefinitely and show something instead of a permanent empty gap — an ad
 * blocker, CSP, a network failure, or a Google outage can all prevent the
 * script from ever loading.
 */
export function useGoogleIdentity(enabled) {
  // Computed during render (not in an effect) so an already-resolved script
  // tag — loaded or failed, inserted by an earlier mount — is picked up
  // immediately instead of only via a future 'load'/'error' event that has
  // already fired and won't fire again.
  const [status, setStatus] = useState(resolvedStatus);

  useEffect(() => {
    if (!enabled || status === "loaded" || status === "failed") return;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // Not yet resolved (checked above) — subscribe for it to resolve later.
      const handleLoad = () => setStatus("loaded");
      const handleError = () => setStatus("failed");
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      return () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.gsiStatus = "loaded";
      setStatus("loaded");
    };
    script.onerror = () => {
      script.dataset.gsiStatus = "failed";
      setStatus("failed");
    };
    document.head.appendChild(script);
  }, [enabled, status]);

  return { ready: status === "loaded", failed: status === "failed" };
}
