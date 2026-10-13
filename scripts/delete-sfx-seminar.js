const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning duplicate sfx-seminar on Database ---');
  
  const duplicate = await prisma.event.findUnique({
    where: { slug: 'sfx-seminar' },
    include: { _count: { select: { rsvps: true } } }
  });

  if (!duplicate) {
    console.log("Result: Event 'sfx-seminar' does not exist in database (already deleted).");
    return;
  }

  const primaryEvent = await prisma.event.findUnique({
    where: { slug: 'imm-sfx-seminar' }
  });

  const rsvpCount = duplicate._count?.rsvps || 0;
  console.log(`Found 'sfx-seminar' (ID: ${duplicate.id}) with ${rsvpCount} registrations.`);

  if (rsvpCount > 0 && primaryEvent) {
    console.log(`Migrating ${rsvpCount} registrations from 'sfx-seminar' (ID: ${duplicate.id}) to 'imm-sfx-seminar' (ID: ${primaryEvent.id})...`);
    await prisma.rsvp.updateMany({
      where: { eventId: duplicate.id },
      data: { eventId: primaryEvent.id }
    });
    console.log('Registrations safely migrated to imm-sfx-seminar.');
  }

  console.log("Deleting 'sfx-seminar' event record...");
  await prisma.event.delete({
    where: { id: duplicate.id }
  });

  console.log("SUCCESS: Duplicate 'sfx-seminar' has been permanently removed.");
  console.log("Only active SFX event is: 'imm-sfx-seminar'");
}

main()
  .catch((e) => {
    console.error('Error removing sfx-seminar:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
