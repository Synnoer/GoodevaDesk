import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting GoodevaDesk database seeding...');

  // 1. Create Organization 1: Acme Corp
  const acmeOrg = await prisma.organization.upsert({
    where: { apiKey: 'key_acme_live_test123' },
    update: {},
    create: {
      name: 'Acme Corporation',
      apiKey: 'key_acme_live_test123',
    },
  });

  // 2. Create Organization 2: Stark Industries
  const starkOrg = await prisma.organization.upsert({
    where: { apiKey: 'key_stark_live_test456' },
    update: {},
    create: {
      name: 'Stark Industries',
      apiKey: 'key_stark_live_test456',
    },
  });

  console.log(`✅ Seeded Organizations:
   - ${acmeOrg.name} (API Key: ${acmeOrg.apiKey})
   - ${starkOrg.name} (API Key: ${starkOrg.apiKey})`);

  // 3. Create Sample Tickets for Acme Corp
  await prisma.ticket.deleteMany({
    where: {
      organizationId: {
        in: [acmeOrg.id, starkOrg.id],
      },
    },
  });

  await prisma.ticket.createMany({
    data: [
      {
        organizationId: acmeOrg.id,
        customerEmail: 'john.doe@company.com',
        subject: 'Cannot download invoice for September',
        message: 'Hello, when I click download invoice on billing page, it gives 404. Can you check my payment?',
        category: 'billing',
        suggestedReply: 'Halo John, terima kasih atas laporannya. Kami telah memeriksa faktur bulan September Anda dan mengirimkan salinan langsung ke email Anda.',
        status: 'open',
      },
      {
        organizationId: acmeOrg.id,
        customerEmail: 'alice.w@tech.io',
        subject: 'API 500 error when syncing webhooks',
        message: 'Our integration received HTTP 500 Internal Server Error during POST /v1/sync today at 10:00 UTC.',
        category: 'technical',
        suggestedReply: 'Halo Alice, tim teknis kami telah memantau lonjakan 500 pada gateway sync webhooks dan telah merilis hotfix. Silakan coba kembali sinkronisasi Anda.',
        status: 'in_progress',
      },
      {
        organizationId: starkOrg.id,
        customerEmail: 'pepper.potts@stark.com',
        subject: 'Password reset request for admin console',
        message: 'I locked myself out of the admin panel after 3 wrong password attempts. Please assist.',
        category: 'account',
        suggestedReply: 'Hello Pepper, we have initiated a secure password reset link sent directly to your registered administrator email address.',
        status: 'open',
      },
    ],
  });

  console.log('✅ Seeded sample support tickets.');
  console.log('🎉 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
