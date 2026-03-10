import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "./libs/dashboard-prisma/schema.prisma",
  migrations: {
    path: "./libs/dashboard-prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
