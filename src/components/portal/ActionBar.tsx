import { cn } from "@/lib/utils";

export function ActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 -mb-8 rounded-b-xl border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
