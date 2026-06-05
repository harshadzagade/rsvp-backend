const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const eventData = {
    title: "Five Days Online Faculty Development Program: 'Holistic Pharmacy Education: Integrating Innovation, Technology and Artificial Intelligence'",
    slug: "iop-fdp",
    date: new Date("2026-07-06T11:00:00Z"),
    venue: "Online Mode (11:00 AM to 1:00 PM)",
    fee: 500,
    formFields: [
      {
        name: "fullName",
        type: "text",
        label: "Name (As required on the certificate)",
        required: true
      },
      {
        name: "email",
        type: "email",
        label: "Email",
        required: true
      },
      {
        name: "instituteName",
        type: "text",
        label: "Name of Institute/College",
        required: true
      },
      {
        name: "designation",
        type: "select",
        label: "Designation",
        options: [
          "Assistant Professor",
          "Associate Professor",
          "Professor",
          "Others"
        ],
        required: true
      },
      {
        name: "mobile",
        type: "tel",
        label: "Contact number",
        required: true
      }
    ],
    feeOptions: {
      options: []
    }
  };

  const event = await prisma.event.upsert({
    where: { slug: eventData.slug },
    update: eventData,
    create: eventData,
  });

  console.log('Successfully seeded event:', JSON.stringify(event, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
