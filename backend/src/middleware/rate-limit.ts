import { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis";

const WINDOW_SECONDS = 60; // 1 minute
const MAX_REQUESTS = 1000; // 1000 requests per window

export const rateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip ?? "unknown";
  const key = `rate-limit:${clientId}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    } else {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        await redis.expire(key, WINDOW_SECONDS);
      }
    }

    if (count > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }
    return next();
  } catch (error) {
    console.error("Rate limiter redis error", error);

    return next();
  }
};
