import { clientIpFromHeaders } from "@/lib/trial-identity";

/** IP do cliente para rate limit (mesma heurística do bootstrap trial). */
export function requestClientIp(headersList: Headers): string {
  return clientIpFromHeaders(headersList);
}
