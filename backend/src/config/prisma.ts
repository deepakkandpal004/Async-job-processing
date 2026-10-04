import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  // Force every connection's Postgres session to UTC. Without this,
  // @prisma/adapter-pg misparses `timestamptz` values whenever the
  // session timezone isn't UTC (it double-applies the offset), causing
  // fields like `leaseUntil` to come back shifted by the session's UTC
  // offset (e.g. +5:30 for Asia/Kolkata).
  options: "-c timezone=UTC",
});

export const prisma = new PrismaClient({
  adapter,
});
