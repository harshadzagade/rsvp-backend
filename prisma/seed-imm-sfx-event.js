const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const eventData = {
    title: "Special Effects Make-up (SFX) Seminar",
    slug: "imm-sfx-seminar",
    date: new Date("2026-10-21T10:00:00Z"),
    venue: "MET, Mumbai",
    fee: 299,
    feeOptions: {
      options: [
        {
          fee: 299,
          currency: "INR",
          logic: "AND",
          conditions: []
        }
      ]
    },
    formFields: [
      {
        name: "fullName",
        type: "text",
        label: "Enter Student Full Name",
        required: true
      },
      {
        name: "mobile",
        type: "tel",
        label: "Enter Mobile No.",
        required: true
      },
      {
        name: "email",
        type: "email",
        label: "Enter Email Id",
        required: true
      },
      {
        name: "state",
        type: "select",
        label: "Select State",
        options: [
          "Maharashtra",
          "Gujarat",
          "Delhi",
          "Karnataka",
          "Tamil Nadu",
          "Uttar Pradesh",
          "West Bengal",
          "Rajasthan",
          "Telangana",
          "Kerala",
          "Madhya Pradesh",
          "Punjab",
          "Haryana",
          "Bihar",
          "Goa",
          "Other"
        ],
        required: true
      },
      {
        name: "city",
        type: "text",
        label: "Select City",
        required: true
      }
    ]
  };

  const event = await prisma.event.upsert({
    where: { slug: eventData.slug },
    update: eventData,
    create: eventData,
  });

  // Also seed with alternative slug 'sfx-seminar' so both URLs work seamlessly
  await prisma.event.upsert({
    where: { slug: "sfx-seminar" },
    update: { ...eventData, slug: "sfx-seminar" },
    create: { ...eventData, slug: "sfx-seminar" },
  });

  console.log('Successfully seeded IMM SFX Seminar event:', JSON.stringify(event, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
