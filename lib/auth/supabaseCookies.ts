export type CookieEntry = { name: string; value: string };

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;

  // Edge runtime has atob; Node has Buffer. Support both.
  if (typeof globalThis.atob === "function") return globalThis.atob(padded);
  // eslint-disable-next-line no-restricted-globals
  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeSupabaseCookieValue(raw: string): string {
  // @supabase/ssr uses "base64url" cookieEncoding by default and prefixes values with "base64-".
  const BASE64_PREFIX = "base64-";
  if (raw.startsWith(BASE64_PREFIX)) {
    return base64UrlDecode(raw.slice(BASE64_PREFIX.length));
  }
  return raw;
}

export function isJwtNotExpired(jwt: string) {
  const parts = jwt.split(".");
  if (parts.length < 2) return false;
  try {
    const payloadRaw = base64UrlDecode(parts[1]!);
    const payload = JSON.parse(payloadRaw) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // small skew to avoid edge-of-expiry weirdness
    return Date.now() / 1000 < payload.exp - 10;
  } catch {
    return false;
  }
}

function tryParseSupabaseAuthCookie(raw: string): { access_token?: string } | null {
  const candidates: string[] = [];
  candidates.push(raw, decodeSupabaseCookieValue(raw));
  try {
    const dec = decodeURIComponent(raw);
    candidates.push(dec, decodeSupabaseCookieValue(dec));
  } catch {
    // ignore
  }

  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand) as { access_token?: string };
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

export function extractAccessTokenFromCookieEntries(entries: CookieEntry[]): string | null {
  // Legacy cookie name
  const legacy = entries.find((c) => c.name === "sb-access-token")?.value;
  if (legacy) return legacy;

  // Direct JSON cookie: sb-<project-ref>-auth-token
  const direct = entries.find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (direct) {
    const parsed = tryParseSupabaseAuthCookie(direct.value);
    if (typeof parsed?.access_token === "string" && parsed.access_token.length > 0) return parsed.access_token;
  }

  // Chunked: sb-<ref>-auth-token.0/.1/...
  const chunkMap = new Map<string, Array<{ idx: number; value: string }>>();
  for (const c of entries) {
    if (!c.name.startsWith("sb-")) continue;
    const m = c.name.match(/^(sb-.*-auth-token)\.(\d+)$/);
    if (!m) continue;
    const base = m[1]!;
    const idx = Number(m[2]!);
    const arr = chunkMap.get(base) ?? [];
    arr.push({ idx, value: c.value });
    chunkMap.set(base, arr);
  }

  for (const [, chunks] of chunkMap) {
    chunks.sort((a, b) => a.idx - b.idx);
    const joined = chunks.map((c) => c.value).join("");
    const parsed = tryParseSupabaseAuthCookie(joined);
    if (typeof parsed?.access_token === "string" && parsed.access_token.length > 0) return parsed.access_token;
  }

  return null;
}

