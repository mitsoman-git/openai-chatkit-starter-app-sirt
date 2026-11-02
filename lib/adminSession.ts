export const SESSION_COOKIE = "sirtaki_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function sign(password: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`admin-session:${payload}`)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(given: string, password: string | undefined): boolean {
  return !!password && sameString(given, password);
}

export async function createSessionToken(password: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const exp = String(nowSec + SESSION_MAX_AGE);
  return `${exp}.${await sign(password, exp)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!token || !password) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < nowSec) return false;
  return sameString(sig, await sign(password, exp));
}

export function safeNext(next: string | null | undefined): string {
  if (!next || !/^\/admin(?:[/?#]|$)/.test(next) || next.startsWith("/admin/login")) return "/admin";
  return next;
}
