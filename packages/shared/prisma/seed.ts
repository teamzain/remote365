import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PLAN_LIMITS } from '../src/plans';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plan limits...');

  const plans = Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
    plan,
    ...limits,
  }));

  for (const p of plans) {
    await (prisma as any).planLimit.upsert({
      where: { plan: p.plan as any },
      update: p,
      create: p as any,
    });
  }

  console.log('Plan limits seeded successfully.');

  // --- Initial Organization Owner Provisioning ---
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@remotelink.io';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const orgName = process.env.ORG_NAME || 'RemoteLink Corporate';
  const orgSlug = process.env.ORG_SLUG || 'remotelink';

  console.log(`Checking for initial organization: ${orgName}...`);
  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug
      }
    });
    console.log(`Created Organization: ${org.name}`);
  }

  console.log(`Checking for organization owner: ${adminEmail}...`);
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'System Administrator',
        role: 'OWNER',
        organizationId: org.id,
        subscription: {
          create: {
            plan: 'ENTERPRISE',
            status: 'ACTIVE'
          }
        }
      }
    });
    console.log(`Successfully created organization owner: ${admin.email}`);
    console.log(`CREDENTIALS: ${adminEmail} / ${adminPassword}`);
    console.log(`IMPORTANT: Please change this password after your first login!`);
  } else {
    console.log('Organization owner already exists. Skipping user creation.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
