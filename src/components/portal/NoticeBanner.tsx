import { Info, AlertTriangle, HardDrive } from "lucide-react";
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

  if (persistent && !storageInitError) {
    console.log(`Armazenamento: SQLite persistente — ${storagePath ?? "desconhecido"}`);
    return null;
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <HardDrive className="size-3.5" /> Armazenamento em memória (não persistente)
        </p>
        {storagePath ? (
          <p className="mt-0.5 font-mono text-[11px] opacity-80">{storagePath}</p>
        ) : null}
        <p className="mt-1.5 text-xs leading-relaxed">
          Os dados escritos aqui não sobrevivem a reinícios nem deploys neste ambiente.
          <br />
          Em execução local, instale um Node com <span className="font-mono">node:sqlite</span> ou
          defina <span className="font-mono">DATABASE_PATH</span> para persistir. No deploy, baixe
          um backup em Administração → Validação e restaure após novos deploys.
        </p>
        {storageInitError ? (
          <p className="mt-2 border-t border-warning/20 pt-2 text-[11px] opacity-80">
            {storageInitError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
