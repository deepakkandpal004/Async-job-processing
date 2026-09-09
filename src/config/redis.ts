import { createClient } from "@redis/client";
import { config } from "./env";

export const redis = createClient({
  url: config.redis.url,
})

redis.on("error", (error) => {
  console.error("Redis Client Error:", error);
})

export const connectRedis = async () => {
  if(!redis.isOpen) {
    await redis.connect();
  }
  console.log("Redis connected");
}
