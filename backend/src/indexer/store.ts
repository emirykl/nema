import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../config.js";

const dir = resolve(process.cwd(), config.DATA_DIR);
mkdirSync(dir, { recursive: true });

/** Small JSON file store, namespaced by vault so redeploys start clean. */
export function jsonStore<T>(name: string, fallback: T) {
  const file = join(dir, `${name}-${config.deployment.contracts.vault}.json`);
  return {
    load(): T {
      try {
        return JSON.parse(readFileSync(file, "utf8")) as T;
      } catch {
        return fallback;
      }
    },
    save(value: T) {
      writeFileSync(`${file}.tmp`, JSON.stringify(value));
      renameSync(`${file}.tmp`, file);
    },
  };
}
