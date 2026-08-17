import { useEffect, useState } from "react";

const SRC = "https://accounts.google.com/gsi/client";
const SCRIPT_ID = "google-gsi-client";

/**
 * Loads Google Identity Services on demand and reports when it's usable.
 *
 * Loaded here rather than in index.html so only the auth page pays for it, and
 * so a blocked or failed script degrades to `ready: false` — leaving the
 * email/password form fully functional — instead of throwing.
 */
export function useGoogleIdentity(enabled) {
  const [ready, setReady] = useState(() => Boolean(window.google?.accounts?.id));

  useEffect(() => {
    if (!enabled || ready) return;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [enabled, ready]);

  return ready;
}
