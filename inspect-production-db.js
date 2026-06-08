const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Fetch all events
  const events = await prisma.event.findMany({
    orderBy: { id: 'asc' }
  });
  console.log('--- ALL DATABASE EVENTS ---');
  events.forEach(e => {
    console.log(`ID: ${e.id} | Slug: ${e.slug} | Title: ${e.title}`);
    console.log(`Form Fields:`, JSON.stringify(e.formFields, null, 2));
    console.log('----------------------------------------------------');
  });

  // 2. Fetch RSVP ID 141 if it exists
  const rsvp141 = await prisma.rSVP.findUnique({
    where: { id: 141 },
    include: { event: true }
  });
  if (rsvp141) {
    console.log('\n--- RSVP ID 141 DETAILS ---');
    console.log(`Event ID: ${rsvp141.eventId} (${rsvp141.event?.slug})`);
    console.log(`fullName column: "${rsvp141.fullName}"`);
    console.log(`email column: "${rsvp141.email}"`);
    console.log(`mobile column: "${rsvp141.mobile}"`);
    console.log(`formData:`, JSON.stringify(rsvp141.formData, null, 2));
  } else {
    console.log('\nRSVP ID 141 not found in database.');
    
    // Find any RSVP for event ID 4 to see its keys
    const anyRsvp4 = await prisma.rSVP.findFirst({
      where: { eventId: 4 },
      orderBy: { id: 'desc' }
    });
    if (anyRsvp4) {
      console.log('\n--- ANY RSVP FOR EVENT 4 DETAILS ---');
      console.log(`ID: ${anyRsvp4.id}`);
      console.log(`formData:`, JSON.stringify(anyRsvp4.formData, null, 2));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
