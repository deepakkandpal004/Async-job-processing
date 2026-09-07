import { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60 * 1000;

const MAX_REQUESTS = 1000;

const clients = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip ?? "unknown";
  const now = Date.now();

  const client = clients.get(clientId);
  if (!client || now >= client.resetAt) {
    clients.set(clientId, { count: 1, resetAt: now + WINDOW_MS });

    return next();
  }
  if (client.count >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });

  }
  client.count++;
  return next();
};
