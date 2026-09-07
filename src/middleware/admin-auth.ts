import { NextFunction, Request, Response } from "express";

export const adminAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    console.error("ADMIN_API_KEY is not configured");

    return res.status(500).json({
      success: false,
      message: "Admin authentication is not configured",
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authorization header is required",
    });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Invalid authorization format",
    });
  }

  if (token !== adminApiKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin API key",
    });
  }

  next();
};
