const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            organization: true
        }
    });
    console.log("Current Users in DB:");
    users.forEach(u => {
        console.log(`- ${u.email} (Role: ${u.role}, OrgId: ${u.organizationId})`);
    });
}
main().catch(console.error).finally(() => prisma.$disconnect());
