import { useState } from "react";
import { SPORT_COLOR } from "../../lib/attributes";

const SPORT_GRADIENT = {
  basketball: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)",
  soccer: "linear-gradient(180deg, #0a0a0f 0%, #39d353 100%)",
};

const SOCCER_FALLBACK = "/soccer-avatar.png";

export default function Avatar({ sport, src, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const gradient = SPORT_GRADIENT[sport] ?? SPORT_COLOR[sport];

  const activeSrc = src && !imgError ? src : (sport === "soccer" ? SOCCER_FALLBACK : null);
  const isFallback = activeSrc === SOCCER_FALLBACK;

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden relative"
      style={{ width: size, height: size, background: gradient }}
    >
      {activeSrc && (
        <img
          src={activeSrc}
          alt=""
          onError={() => { if (!isFallback) setImgError(true); }}
          style={isFallback ? { filter: "invert(1)" } : undefined}
          className={`absolute inset-0 w-full h-full ${isFallback ? "object-contain opacity-70" : `object-cover object-top ${sport === "soccer" ? "scale-[1.35] origin-top" : ""}`}`}
        />
      )}
    </div>
  );
}
