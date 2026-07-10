// Prisma 7 connection configuration — replaces the legacy `datasource.url` in schema.prisma.
// The Prisma CLI (migrate/generate/studio) reads DATABASE_URL from here; the running app reads
// it separately via src/persistence/prismaClient.ts using the @prisma/adapter-pg driver adapter.
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
