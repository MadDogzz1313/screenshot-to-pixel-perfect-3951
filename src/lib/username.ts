import { useQuery } from "@tanstack/react-query";
import { sb } from "./db";

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export const USERNAME_HINT = "3–20 Zeichen: Buchstaben, Zahlen und Unterstriche.";

export function validateUsername(value: string): string | null {
  const name = value.trim();
  if (!name) return "Bitte wähle einen Benutzernamen.";
  if (!USERNAME_PATTERN.test(name)) return USERNAME_HINT;
  return null;
}

export function usernameError(error: { code?: string; message?: string } | null | undefined): string {
  const message = (error?.message ?? "").toLowerCase();
  if (message.includes("username_taken") || message.includes("duplicate key") || message.includes("profiles_username")) return "Dieser Benutzername ist bereits vergeben.";
  if (message.includes("username_reserved")) return "Dieser Benutzername ist nicht verfügbar. Bitte wähle einen anderen.";
  if (message.includes("username_invalid")) return USERNAME_HINT;
  if (message.includes("auth_required")) return "Bitte melde dich an.";
  return "Der Benutzername konnte nicht gespeichert werden. Bitte versuche es erneut.";
}

export async function checkUsernameAvailable(value: string, excludeId?: string | null): Promise<boolean> {
  const error = validateUsername(value);
  if (error) return false;
  const { data, error: rpcError } = await sb.rpc("username_available", { _username: value.trim(), _exclude: excludeId ?? null });
  if (rpcError) throw rpcError;
  return data === true;
}

export function useUsernameAvailability(value: string, excludeId?: string | null) {
  const clean = value.trim();
  const validationError = clean ? validateUsername(clean) : null;
  return useQuery({
    queryKey: ["username-availability", clean.toLowerCase(), excludeId ?? null],
    enabled: !!clean && !validationError,
    staleTime: 5_000,
    retry: false,
    queryFn: () => checkUsernameAvailable(clean, excludeId),
  });
}
