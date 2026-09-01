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
        <p className="mt-1.5 text-xs leading-relaxed">
          Este ambiente não oferece um banco persistente ({" "}
          <span className="font-mono">node:sqlite</span> indisponível no runtime de preview), então
          os dados escritos aqui são perdidos a cada reinício ou novo deploy.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
          <li>
            Para dados duradouros, rode localmente (<span className="font-mono">npm run dev</span>)
            — usa SQLite em <span className="font-mono">.data/portal.db</span>.
          </li>
          <li>
            Neste preview, baixe um backup em Administração → Validação e restaure após cada novo
            deploy.
          </li>
        </ul>
      </div>
    </div>
  );
}
