import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./client";

let sessionSnapshot: Session | null = null;

export function setSessionSnapshot(session: Session | null): void {
  sessionSnapshot = session;
}

export function getSessionSnapshot(): Session | null {
  return sessionSnapshot;
}

export function getAccessTokenSnapshot(): string | null {
  const accessToken = sessionSnapshot?.access_token?.trim();
  return accessToken ? accessToken : null;
}

export async function resolveSessionSnapshot(
  client: SupabaseClient<any, any, any> = createClient()
): Promise<Session | null> {
  const cachedSession = getSessionSnapshot();
  if (cachedSession?.access_token) {
    return cachedSession;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  setSessionSnapshot(session ?? null);
  return session ?? null;
}

export async function resolveAccessToken(
  client: SupabaseClient<any, any, any> = createClient()
): Promise<string | null> {
  const cachedAccessToken = getAccessTokenSnapshot();
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const session = await resolveSessionSnapshot(client);
  const accessToken = session?.access_token?.trim();
  return accessToken ? accessToken : null;
}
