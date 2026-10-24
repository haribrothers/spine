import { ConsoleLogger, type LoggerService, type LogLevel } from "@nestjs/common";
import { redact } from "./redact";
import { currentRequestId } from "./request-context";

export type LogFormat = "json" | "pretty";

/** JSON in production (the API image sets NODE_ENV=production) or with LOG_FORMAT=json; Nest's readable lines otherwise. */
export function logFormat(env: NodeJS.ProcessEnv = process.env): LogFormat {
  if (env.LOG_FORMAT === "json" || env.LOG_FORMAT === "pretty") return env.LOG_FORMAT;
  return env.NODE_ENV === "production" ? "json" : "pretty";
}

type Level = "fatal" | "error" | "warn" | "info" | "debug" | "verbose";

/** One finished request, as US-OPS-07 logs it. */
export interface RequestLine {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

/**
 * US-OPS-07 — the API's one logger. In JSON form each line is
 * `{ time, level, requestId?, context?, message, stack? }`; request lines add
 * `method`, `path`, `status` and `durationMs`. Every message and stack is
 * redacted (redact.ts) first, in both forms.
 */
export class SpineLogger implements LoggerService {
  private readonly pretty = new ConsoleLogger();

  constructor(
    private readonly format: LogFormat = logFormat(),
    private readonly write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {}

  log(message: unknown, ...params: unknown[]) {
    this.emit("info", message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.emit("error", message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.emit("warn", message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.emit("debug", message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.emit("verbose", message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.emit("fatal", message, params);
  }

  setLogLevels(levels: LogLevel[]) {
    this.pretty.setLogLevels(levels);
  }

  /** A finished request: info below 400, warn for 4xx, error for 5xx. */
  request(line: RequestLine) {
    const level: Level = line.status >= 500 ? "error" : line.status >= 400 ? "warn" : "info";
    if (this.format === "json") {
      this.write(JSON.stringify({ time: new Date().toISOString(), level, context: "Request", message: `${line.method} ${line.path} ${line.status}`, ...line }));
      return;
    }
    const text = `${line.method} ${line.path} ${line.status} ${line.durationMs}ms [${line.requestId}]`;
    if (level === "info") this.pretty.log(text, "Request");
    else if (level === "warn") this.pretty.warn(text, "Request");
    else this.pretty.error(text, "Request");
  }

  private emit(level: Level, message: unknown, params: unknown[]) {
    // Nest passes the context last; an error also passes its stack before it.
    const rest = [...params];
    const context = rest.length && typeof rest[rest.length - 1] === "string" ? (rest.pop() as string) : undefined;
    const stack = level === "error" || level === "fatal" ? rest.find((p): p is string => typeof p === "string" && p.includes("\n    at ")) : undefined;
    const errorStack = message instanceof Error ? message.stack : undefined;
    const text = redact(message instanceof Error ? message.message : typeof message === "string" ? message : JSON.stringify(message));
    const trace = stack ?? errorStack;
    if (this.format === "json") {
      const requestId = currentRequestId();
      this.write(JSON.stringify({ time: new Date().toISOString(), level, ...(requestId ? { requestId } : {}), ...(context ? { context } : {}), message: text, ...(trace ? { stack: redact(trace) } : {}) }));
      return;
    }
    const args: unknown[] = [text, ...(trace && (level === "error" || level === "fatal") ? [redact(trace)] : []), ...(context ? [context] : [])];
    if (level === "info") this.pretty.log(...(args as [string]));
    else if (level === "warn") this.pretty.warn(...(args as [string]));
    else if (level === "debug") this.pretty.debug(...(args as [string]));
    else if (level === "verbose") this.pretty.verbose(...(args as [string]));
    else if (level === "fatal") this.pretty.fatal(...(args as [string]));
    else this.pretty.error(...(args as [string]));
  }
}

/** The process's logger; main.ts hands it to Nest and Better Auth logs through it. */
export const spineLogger = new SpineLogger();
