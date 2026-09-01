import { Info, Database, AlertTriangle } from "lucide-react";
import { usePortalData } from "@/lib/api-hooks";

export function NoticeBanner({ children }: { children?: React.ReactNode }) {
  const { data: state } = usePortalData();
  const persistent = state?.persistent ?? true;
  const storagePath = state?.storagePath;
  const storageInitError = state?.storageInitError;

  if (children) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>{children}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
      {storageInitError ? (
        <>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{storageInitError}</p>
        </>
      ) : (
        <>
          <Database className="mt-0.5 size-4 shrink-0" />
          <p>
            Armazenamento: {persistent ? "SQLite persistente" : "Memória (volátil)"}
            {storagePath ? ` — ${storagePath}` : ""}
          </p>
        </>
      )}
    </div>
  );
}