import deployment from "@/config/deployment.json";

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
  ...deployment,
};

export const DECIMALS = 7;
export const ONE = 10n ** BigInt(DECIMALS);

/** Slippage tolerance applied to deposit/withdraw previews (0.5%). */
export const SLIPPAGE_BPS = 50n;

export const explorer = {
  contract: (id: string) => `https://stellar.expert/explorer/${config.network}/contract/${id}`,
  account: (id: string) => `https://stellar.expert/explorer/${config.network}/account/${id}`,
  tx: (hash: string) => `https://stellar.expert/explorer/${config.network}/tx/${hash}`,
};
