import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });

// Base PrismaClient instance (singleton in dev)
const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Extended client: normalize tag names to lowercase at the DB boundary
export const prisma = basePrisma.$extends({
  query: {
    tag: {
      async create({ args, query }) {
        if (typeof args.data?.name === 'string') {
          args.data.name = args.data.name.toLowerCase();
        }
        return query(args);
      },
      async update({ args, query }) {
        if (typeof args.data?.name === 'string') {
          args.data.name = args.data.name.toLowerCase();
        }
        return query(args);
      },
    },
  },
});
