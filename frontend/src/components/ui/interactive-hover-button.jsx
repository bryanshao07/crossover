import { ArrowRight } from "lucide-react";

import { cn } from "../../lib/utils";

export function InteractiveHoverButton({ children, className, ...props }) {
  return (
    <button
      className={cn(
        "group bg-background relative w-auto cursor-pointer overflow-hidden rounded-full border p-2 px-6 text-center font-semibold",
        className
      )}
      {...props}
    >
      {/* Dot at button center — scale radiates from dead center, covering full-width layouts */}
      <div className="bg-primary absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300 group-hover:scale-[200]" />
      <div className="relative z-10 flex items-center justify-center gap-2">
        <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
          {children} →
        </span>
      </div>
      <div className="text-primary-foreground absolute top-0 z-20 flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover:-translate-x-5 group-hover:opacity-100">
        <span>{children}</span>
        <ArrowRight />
      </div>
    </button>
  );
}
