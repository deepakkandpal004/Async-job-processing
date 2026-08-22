import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino(
  isDevelopment
    ? {
        level: process.env.LOG_LEVEL || "info",
        transport: {
          target: "pino-pretty",
          options: {
            Colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        level: process.env.LOG_LEVEL || "info",
      },
);
