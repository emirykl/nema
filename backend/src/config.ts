import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const contractId = z.string().regex(/^C[A-Z2-7]{55}$/);
const accountId = z.string().regex(/^G[A-Z2-7]{55}$/);

const Deployment = z.object({
  network: z.string(),
  rpcUrl: z.url(),
  horizonUrl: z.url(),
  networkPassphrase: z.string(),
  deployedAt: z.string(),
  admin: accountId,
  assets: z.object({
    usdt0: z.object({ code: z.string(), issuer: accountId, contract: contractId, mock: z.boolean() }),
    nusdt0: z.object({ code: z.string(), issuer: accountId, contract: contractId }),
  }),
  contracts: z.object({
    vault: contractId,
    strategyXoxno: contractId,
    lending: contractId,
    oracle: contractId,
  }),
  lending: z.object({ mock: z.boolean(), hubId: z.number(), spokeId: z.number(), aprBps: z.number() }),
  vault: z.object({ feeBps: z.number(), bufferBps: z.number(), targetBps: z.number() }),
});
export type Deployment = z.infer<typeof Deployment>;

const Env = z.object({
  PORT: z.coerce.number().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DEPLOYMENT_FILE: z.string().default("../deployments/testnet.json"),
  KEEPER_SECRET: z.string().startsWith("S").optional(),
  FAUCET_ISSUER_SECRET: z.string().startsWith("S").optional(),
  KEEPER_ENABLED: z.stringbool().default(true),
  KEEPER_INTERVAL_SECONDS: z.coerce.number().min(30).default(300),
  SNAPSHOT_INTERVAL_SECONDS: z.coerce.number().min(30).default(300),
  FAUCET_AMOUNT: z.coerce.number().positive().max(100_000).default(1_000),
  DATA_DIR: z.string().default("data"),
});

const env = Env.parse(process.env);
const deploymentPath = resolve(process.cwd(), env.DEPLOYMENT_FILE);

export const config = {
  ...env,
  deployment: Deployment.parse(JSON.parse(readFileSync(deploymentPath, "utf8"))),
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
