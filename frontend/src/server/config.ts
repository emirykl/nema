import "server-only";
import { z } from "zod";
import deployment from "@/config/deployment.json";

const Env = z.object({
  KEEPER_SECRET: z.string().startsWith("S").optional(),
  FAUCET_ISSUER_SECRET: z.string().startsWith("S").optional(),
  /** Shared secret for /api/cron/tick (sent by Supabase pg_cron). */
  CRON_SECRET: z.string().min(16).optional(),
  /** Optional Discord/Slack-compatible webhook for keeper risk alerts. */
  RISK_WEBHOOK_URL: z.url().optional(),
  KEEPER_ENABLED: z.stringbool().default(true),
  FAUCET_AMOUNT: z.coerce.number().positive().max(100_000).default(1_000),
  /** The Vercel Supabase integration sets SUPABASE_URL; NEXT_PUBLIC_ is the fallback. */
  SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const env = Env.parse(process.env);

export const config = {
  ...env,
  supabaseUrl: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
  deployment,
};

/** Mainnet references from NEMA_BRIEF.md (verified on StellarExpert). */
export const mainnet = {
  usdt0: {
    code: "USDT0",
    issuer: "GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q",
    contract: "CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF",
  },
  xoxnoController: "CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX",
  aquariusUsdt0UsdcPool: "CCJHUCHZ2DC6MP7LMGQJYSENNTGIFWU4J4TCGFYYDLAC5LTD4YMF6HSQ",
} as const;
