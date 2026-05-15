/** Origem pública do site (checkout, links de agendamento).
 * Em Cloudflare Workers, defina `NEXT_PUBLIC_APP_URL` com o URL real (workers.dev ou domínio próprio).
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://corte-pro.pages.dev"
    : "http://localhost:3000");
