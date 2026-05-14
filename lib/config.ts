/** Origem pública do site (checkout, links de agendamento). */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://cortepro.pages.dev"
    : "http://localhost:3000");
