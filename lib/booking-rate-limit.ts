import type { SupabaseClient } from "@supabase/supabase-js";

const BOOKING_RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_BOOKINGS_PER_IP_SHOP_PER_HOUR = 20;

export async function bookingRateExceeded(
  admin: SupabaseClient,
  ip: string,
  barbershopId: string
): Promise<boolean> {
  const since = new Date(Date.now() - BOOKING_RATE_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("booking_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("barbershop_id", barbershopId)
    .gte("occurred_at", since);

  if (error) {
    return false;
  }
  return (count ?? 0) >= MAX_BOOKINGS_PER_IP_SHOP_PER_HOUR;
}

export async function recordBookingRateEvent(
  admin: SupabaseClient,
  ip: string,
  barbershopId: string
): Promise<void> {
  await admin.from("booking_rate_events").insert({
    ip,
    barbershop_id: barbershopId,
  });
}
