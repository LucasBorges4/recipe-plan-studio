import { Info } from "lucide-react";

export function NoticeBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        {children ??
          "Os dados apresentados nesta página são apenas para fins de exemplo e demonstração. Com o tempo, serão substituídos por informações reais."}
      </p>
    </div>
  );
}
