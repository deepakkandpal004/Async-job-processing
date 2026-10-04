import app from "./app";
import { connectRedis } from "./config/redis";
import { config } from "./config/env";

const PORT = config.api.port;

const startServer = async () => {
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`server is running at PORT ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("failed to start server", error);
  process.exit(1);
})
