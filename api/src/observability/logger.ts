import os from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export type LoggerOptions = {
  serviceName: string;
  environment: string;
};

export function createLogger(options: LoggerOptions) {
  const baseFields = {
    service: options.serviceName,
    env: options.environment,
    hostname: os.hostname(),
    pid: process.pid,
  };

  function log(level: LogLevel, message: string, fields: LogFields = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...baseFields,
      ...fields,
    };

    const serialized = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(`${serialized}\n`);
      return;
    }

    process.stdout.write(`${serialized}\n`);
  }

  return {
    debug(message: string, fields?: LogFields) {
      log("debug", message, fields);
    },
    info(message: string, fields?: LogFields) {
      log("info", message, fields);
    },
    warn(message: string, fields?: LogFields) {
      log("warn", message, fields);
    },
    error(message: string, fields?: LogFields) {
      log("error", message, fields);
    },
  };
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
      type?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };

    return {
      error_type:
        typeof candidate.name === "string"
          ? candidate.name
          : typeof candidate.type === "string"
            ? candidate.type
            : "UnknownError",
      error_message:
        typeof candidate.message === "string"
          ? candidate.message
          : "Unexpected error",
      error_stack:
        typeof candidate.stack === "string" ? candidate.stack : undefined,
      error_status:
        typeof candidate.statusCode === "number"
          ? candidate.statusCode
          : typeof candidate.status === "number"
            ? candidate.status
            : undefined,
    };
  }

  return {
    error_type: "UnknownError",
    error_message: String(error),
  };
}
