import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from './generated/prisma';

const { DATABASE_URL } = process.env;

const adapter = new PrismaNeon({
  connectionString: DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
