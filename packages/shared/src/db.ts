import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Pre-load environment variables from the root .env file
const envPath = path.resolve(process.cwd(), '../../.env');
console.log(`[Shared-DB] Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

console.log(`[Shared-DB] DATABASE_URL present: ${!!process.env.DATABASE_URL}`);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Append an entry to an organization's activity log. Best-effort: logging must
 * never break the action it records, so failures are swallowed (and logged).
 */
export async function recordActivity(
  organizationId: string | null | undefined,
  action: string,
  message: string,
  actor?: { id?: string | null; name?: string | null }
): Promise<void> {
  if (!organizationId) return;
  try {
    await prisma.activityLog.create({
      data: {
        organizationId,
        action,
        message,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
      },
    });
  } catch (err: any) {
    console.error('[Shared] recordActivity failed:', err?.message || err);
  }
}

/**
 * Record a login attempt (success or failure) for the user-details login history.
 * Best-effort: never block authentication.
 */
export async function recordLogin(data: {
  userId?: string | null;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  result: string;
}): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: data.userId ?? null,
        email: data.email,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
        result: data.result,
      },
    });
  } catch (err: any) {
    console.error('[Shared] recordLogin failed:', err?.message || err);
  }
}
