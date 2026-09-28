import { useEffect } from "react";
import { useSession } from "@/lib/api-hooks";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { pageAllowedForRole, roleHome } from "@/lib/rbac";

const PUBLIC_PATHS = ["/login", "/termos", "/lgpd", "/equipe"];

export function useRouteGuard(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: session } = useSession();

  useEffect(() => {
    const user = session?.user;
    if (user === undefined) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!user) {
      if (!isPublic) navigate({ to: "/login" });
      return;
    }
    if (user.role === "cliente" && !pageAllowedForRole(user.role, pathname)) {
      navigate({ to: roleHome(user.role) });
    }
  }, [session, pathname, navigate]);
}