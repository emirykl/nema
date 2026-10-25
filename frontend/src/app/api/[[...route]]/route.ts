import { app } from "@/server/routes";

/** Keeper transactions wait for confirmation; give the cron round room. */
export const maxDuration = 120;

const handler = (req: Request) => app.fetch(req);

export const GET = handler;
export const POST = handler;
