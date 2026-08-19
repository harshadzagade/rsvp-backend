const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const eventData = {
    title: "Two Day National Seminar and Poster Competition: 'CosmoNext- Exploring the Art, Science and Trends of Cosmetics'",
    slug: "iop-cosmonext",
    date: new Date("2026-09-03T09:30:00Z"),
    venue: "MET Institute of Pharmacy (Degree), Mumbai (Convention Centre, 1st Floor)",
    fee: 400,
    feeOptions: {
      options: [
        {
          fee: 400,
          currency: "INR",
          logic: "AND",
          conditions: [
            { field: "category", value: "Student" }
          ]
        },
        {
          fee: 500,
          currency: "INR",
          logic: "AND",
          conditions: [
            { field: "category", value: "Faculty" }
          ]
        },
        {
          fee: 500,
          currency: "INR",
          logic: "AND",
          conditions: [
            { field: "category", value: "Industry Professionals" }
          ]
        }
      ]
    },
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
        name: "category",
        type: "radio",
        label: "Category",
        options: [
          "Student",
          "Faculty",
          "Industry Professionals"
        ],
        required: true
      },
      {
        name: "mobile",
        type: "tel",
        label: "Contact number",
        required: true
      },
      {
        name: "posterParticipation",
        type: "radio",
        label: "Will you be participating in Poster Presentation (If YES then fill poster details below)",
        options: [
          "YES",
          "NO"
        ],
        required: true
      },
      {
        name: "groupMembers",
        type: "text",
        label: "Name of Group Members (If participating in Poster Presentation, max 5 participants)",
        required: false
      },
      {
        name: "posterCategory",
        type: "select",
        label: "Class / Category for Poster Presentation",
        options: [
          "First Year B. Pharm.",
          "Second Year B. Pharm.",
          "Third Year B. Pharm.",
          "Fourth Year B. Pharm.",
          "M. Pharm.",
          "Faculty / Other"
        ],
        required: false
      },
      {
        name: "posterTitle",
        type: "text",
        label: "Title of the poster",
        required: false
      },
      {
        name: "mentorName",
        type: "text",
        label: "Name of the mentor/ guide (As required on the certificate)",
        required: false
      }
    ]
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
