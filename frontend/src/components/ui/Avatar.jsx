import { useState } from "react";
import { SPORT_COLOR } from "../../lib/attributes";

export default function Avatar({ sport, src, size = 40 }) {
  const [imgError, setImgError] = useState(false);

  const style = { width: size, height: size };

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setImgError(true)}
        className="rounded-full shrink-0 object-cover"
        style={style}
      />
    );
  }

  return (
    <div
      className="rounded-full shrink-0"
      style={{ ...style, backgroundColor: SPORT_COLOR[sport] }}
    />
  );
}
