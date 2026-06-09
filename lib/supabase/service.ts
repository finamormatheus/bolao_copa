import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Cliente com service role para uso exclusivo em rotas de servidor (cron jobs, sync).
// Nunca expor no frontend — ignora Row Level Security.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
