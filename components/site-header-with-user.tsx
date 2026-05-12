import { getSessionUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";

/**
 * Cabeçalho com e-mail da sessão no servidor.
 *
 * O middleware (`middleware.ts`) continua sendo a fonte de verdade para redirects
 * protegidos e refresh de cookies Supabase em cada navegação. Aqui só lemos a sessão
 * uma vez por request RSC via `getSessionUser` (React `cache` em `lib/auth`) para UI.
 * Não duplicar lógica de autorização neste componente.
 */
export async function SiteHeaderWithUser() {
  const user = await getSessionUser();
  return <SiteHeader userEmail={user?.email ?? null} />;
}
