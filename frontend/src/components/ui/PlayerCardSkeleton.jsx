import Skeleton from "./Skeleton";

export function CenterColumnSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-4"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading comparison"
    >
      <div className="flex flex-col items-center space-y-2 w-full">
        <Skeleton className="h-20 w-32" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="glass p-4 w-full">
        <Skeleton className="h-[320px] w-full" />
        <div className="flex justify-center gap-6 mt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function PlayerCardSkeleton() {
  return (
    <div
      className="glass p-5 flex flex-col h-full"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading player"
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-[72px] h-[72px] rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-10 shrink-0" />
            <Skeleton className="h-3 w-8 shrink-0" />
          </div>
        </div>
      </div>
      {/* DNA */}
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="h-5 w-4/5" />
      </div>
      {/* 7 attribute rows — mirrors AttributeScores layout */}
      <div className="mt-5 grid gap-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 shrink-0" />
            <Skeleton
              className="h-2.5 shrink-0"
              style={{ width: "8.5rem" }}
            />
            <Skeleton className="flex-1 h-[3px]" />
            <Skeleton className="h-4 w-9 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
