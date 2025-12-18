import { describe, expect, it, vi } from "vitest";

import { extractAccessTokenFromCookieEntries, isJwtNotExpired } from "../lib/auth/supabaseCookies";

function b64url(s: string) {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeJwt(exp: number) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ exp }));
  return `${header}.${payload}.sig`;
}

describe("extractAccessTokenFromCookieEntries", () => {
  it("prefers legacy sb-access-token", () => {
    const tok = "legacy-token";
    const got = extractAccessTokenFromCookieEntries([
      { name: "sb-access-token", value: tok },
      { name: "sb-foo-auth-token", value: "{}" }
    ]);
    expect(got).toBe(tok);
  });

  it("extracts access_token from direct auth cookie", () => {
    const tok = "abc123";
    const raw = JSON.stringify({ access_token: tok });
    const got = extractAccessTokenFromCookieEntries([{ name: "sb-xyz-auth-token", value: raw }]);
    expect(got).toBe(tok);
  });

  it("extracts access_token from base64-encoded cookie", () => {
    const tok = "tok-1";
    const raw = JSON.stringify({ access_token: tok });
    const val = `base64-${b64url(raw)}`;
    const got = extractAccessTokenFromCookieEntries([{ name: "sb-xyz-auth-token", value: val }]);
    expect(got).toBe(tok);
  });

  it("extracts access_token from chunked cookies", () => {
    const tok = "tok-chunk";
    const raw = JSON.stringify({ access_token: tok });
    const val = `base64-${b64url(raw)}`;
    const a = val.slice(0, Math.floor(val.length / 2));
    const b = val.slice(Math.floor(val.length / 2));

    const got = extractAccessTokenFromCookieEntries([
      { name: "sb-xyz-auth-token.1", value: b },
      { name: "sb-xyz-auth-token.0", value: a }
    ]);
    expect(got).toBe(tok);
  });
});

describe("isJwtNotExpired", () => {
  it("returns true for token with exp in future", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtNotExpired(makeJwt(now + 3600))).toBe(true);
  });

  it("returns false for token with exp in past", () => {
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const now = Math.floor(Date.now() / 1000);
    expect(isJwtNotExpired(makeJwt(now - 3600))).toBe(false);
  });
});
