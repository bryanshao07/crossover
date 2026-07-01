import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function BorderBeam({
  className,
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  borderWidth = 1,
  transition,
  style,
  reverse = false,
  initialOffset = 0,
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth: `${borderWidth}px` }}
    >
      <motion.div
        className={cn(
          "absolute aspect-square bg-gradient-to-l",
          className || "from-[var(--color-from)] via-[var(--color-to)] to-transparent",
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          ...style,
        }}
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `-${initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}
