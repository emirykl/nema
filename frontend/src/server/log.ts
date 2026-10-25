type Level = "info" | "warn" | "error";

function write(level: Level, scope: string, message: string, extra?: unknown) {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  const out = level === "error" ? console.error : console.log;
  if (extra === undefined) out(line);
  else out(line, extra);
}

export const logger = (scope: string) => ({
  info: (msg: string, extra?: unknown) => write("info", scope, msg, extra),
  warn: (msg: string, extra?: unknown) => write("warn", scope, msg, extra),
  error: (msg: string, extra?: unknown) => write("error", scope, msg, extra),
});
