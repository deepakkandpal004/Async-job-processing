import pino from "pino";
import { config } from "./env";

const isDevelopment = config.env.nodeEnv !== "production";

export const logger = pino(
  isDevelopment
    ? {
        level: config.env.logLevel || "info",
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
        level: config.env.logLevel || "info",
      },
);
