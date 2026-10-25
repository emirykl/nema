import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let client: SupabaseClient | undefined;

/** Server-side Supabase client (service role). Never imported by client code. */
export function db(): SupabaseClient {
  if (!client) {
    if (!config.supabaseUrl || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
    }
    client = createClient(config.supabaseUrl, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Every row is namespaced by vault so a fresh deployment starts clean. */
export const VAULT = config.deployment.contracts.vault;

/** Throws on a Supabase error, otherwise returns the data. */
export function must<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(`supabase: ${error.message}`);
  return data;
}

export const kv = {
  async get<T>(key: string): Promise<T | undefined> {
    const row = must(await db().from("kv").select("value").eq("key", `${VAULT}:${key}`).maybeSingle());
    return (row?.value as T | undefined) ?? undefined;
  },
  async set(key: string, value: unknown) {
    must(await db().from("kv").upsert({ key: `${VAULT}:${key}`, value, updated_at: new Date().toISOString() }));
  },
  /**
   * Takes a lease on `key` if nobody took it in the last `ttlMs`. Atomic in
   * Postgres, so concurrent serverless instances never both get it.
   */
  async lease(key: string, ttlMs: number): Promise<boolean> {
    const id = `${VAULT}:${key}`;
    const now = new Date();
    const cutoff = new Date(now.getTime() - ttlMs).toISOString();
    await db().from("kv").upsert({ key: id, value: {}, updated_at: new Date(0).toISOString() }, { ignoreDuplicates: true });
    const taken = must(
      await db().from("kv").update({ updated_at: now.toISOString() }).eq("key", id).lt("updated_at", cutoff).select("key"),
    );
    return (taken ?? []).length > 0;
  },
};
