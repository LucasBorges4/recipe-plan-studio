import { cn } from "@/lib/utils";

export function PanelCard({
  children,
  className,
  noPadding = false,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className={cn(noPadding ? "" : "p-5 lg:p-6")}>{children}</div>
    </section>
  );
}
