// Stripe-Spenden über das Emergent-Backend (/api/payments/*). Abzeichen vergibt danach ein Admin (Supabase `donations`).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DonationTier { id: string; lookup_key: string; amount_cents: number; badge: string }
export interface TiersResponse { tiers: DonationTier[]; custom_min_cents: number; custom_max_cents: number; test_mode: boolean }
export interface CheckoutResponse { checkout_url: string; session_id: string }
export interface StatusResponse { session_id: string; status: string; payment_status: string }
export interface AdminDonation { session_id: string; user_id: string; amount_cents: number; currency: string; payment_status: string; credit_status: "open" | "crediting" | "credited"; created_at: string; credited_at: string | null }

export const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });

async function api<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Bitte melde dich an");
    headers["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try { res = await fetch(path, { ...init, headers, cache: "no-store" }); } catch { throw new Error("Keine Verbindung – bitte später erneut versuchen"); }
  const body = await res.json().catch(() => null) as { detail?: unknown } | null;
  if (!res.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Das hat nicht geklappt – bitte später erneut versuchen");
  return body as T;
}

export function useDonationTiers() {
  return useQuery({ queryKey: ["donation-tiers"], staleTime: 300_000, queryFn: () => api<TiersResponse>("/api/payments/tiers") });
}

export function startCheckout(choice: { tier_id: string } | { custom_amount_cents: number }) {
  return api<CheckoutResponse>("/api/payments/checkout", { method: "POST", body: JSON.stringify({ ...choice, origin_url: window.location.origin }) }, true);
}

const FINAL = ["paid", "expired", "failed", "refunded"];
export function usePaymentStatus(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["payment-status", sessionId], enabled: !!sessionId, retry: 2,
    queryFn: () => api<StatusResponse>(`/api/payments/status/${encodeURIComponent(sessionId!)}`),
    // Alle 2 s nachfragen, bis Stripe ein Endergebnis meldet (max. ~2 Minuten).
    refetchInterval: (q) => (FINAL.includes(q.state.data?.payment_status ?? "") || q.state.dataUpdateCount > 60 ? false : 2000),
  });
}

export function useAdminStripeDonations(enabled: boolean) {
  return useQuery({ queryKey: ["stripe-donations"], enabled, queryFn: () => api<{ donations: AdminDonation[] }>("/api/payments/admin/donations", {}, true).then((r) => r.donations) });
}

export function confirmStripeDonation(sessionId: string) {
  return api<AdminDonation>(`/api/payments/admin/donations/${encodeURIComponent(sessionId)}/confirm`, { method: "POST" }, true);
}
