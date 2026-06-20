import { useState } from "react";
import { SPORT_COLOR } from "../../lib/attributes";

const SPORT_GRADIENT = {
  basketball: "linear-gradient(180deg, #0a0a0f 0%, #4a7fff 100%)",
  soccer: "linear-gradient(180deg, #0a0a0f 0%, #39d353 100%)",
};

export default function Avatar({ sport, src, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const gradient = SPORT_GRADIENT[sport] ?? SPORT_COLOR[sport];

  return (
    <div
      className="rounded-full shrink-0 overflow-hidden relative"
      style={{ width: size, height: size, background: gradient }}
    >
      {src && !imgError && (
        <img
          src={src}
          alt=""
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
