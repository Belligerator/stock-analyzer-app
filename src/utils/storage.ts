export const STOCKS_KEY = "sa_stocks_override_v1";
export const NOTES_KEY = "sa_notes_override_v1";

export interface Override {
  json: string;
  savedAt: string;
}

export function loadOverride(key: string): Override | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Override).json === "string" &&
      typeof (parsed as Override).savedAt === "string"
    ) {
      return parsed as Override;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveOverride(key: string, json: string): Override {
  const payload: Override = { json, savedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(payload));
  return payload;
}

export function clearOverride(key: string): void {
  localStorage.removeItem(key);
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
