import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function convertBigInts<T>(obj: T): T {
  if (typeof obj === "bigint") return Number(obj) as T;
  if (Array.isArray(obj)) return obj.map(convertBigInts) as T;
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigInts(value);
    }
    return result as T;
  }
  return obj;
}

const prismaClientSingleton = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args);
          return convertBigInts(result);
        },
      },
    },
  });

type PrismaClientExtended = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientExtended | undefined };

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
