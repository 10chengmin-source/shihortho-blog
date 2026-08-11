// Raw tokens are only ever sent once in an email link; only their hash is
// persisted, so a database dump alone can never be used to confirm/
// unsubscribe someone. Not the DB row id either way, per the "unsubscribe
// token must not leak the subscriber's database ID" requirement.

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
