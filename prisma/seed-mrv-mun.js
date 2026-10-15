const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Ensure MRV InstituteSetting exists
  const immSetting = await prisma.instituteSetting.findUnique({
    where: { instituteCode: 'IMM' }
  });

  await prisma.instituteSetting.upsert({
    where: { instituteCode: 'MRV' },
    update: {
      instituteName: 'MET Rishikul Vidyalaya',
      // By default use same PayU gateway or placeholder
      payuKey: immSetting?.payuKey || 'wRoVzf',
      payuSalt: immSetting?.payuSalt || 'd6ySDVyAl0ZFDAlOR9jPgCWku025hWbT',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: immSetting?.emailUser || 'mdp_imm@met.edu',
      emailPass: immSetting?.emailPass || 'rmpc rwos btgo gxxw',
      adminEmails: 'mrvmun@met.edu, conference_imm@met.edu',
      brandColor: '#B91C1C',
      whatsappText: 'Thank you for registering for MRV MUN. We look forward to seeing you at MET Rishikul Vidyalaya!',
    },
    create: {
      instituteCode: 'MRV',
      instituteName: 'MET Rishikul Vidyalaya',
      payuKey: immSetting?.payuKey || 'wRoVzf',
      payuSalt: immSetting?.payuSalt || 'd6ySDVyAl0ZFDAlOR9jPgCWku025hWbT',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: immSetting?.emailUser || 'mdp_imm@met.edu',
      emailPass: immSetting?.emailPass || 'rmpc rwos btgo gxxw',
      adminEmails: 'mrvmun@met.edu, conference_imm@met.edu',
      brandColor: '#B91C1C',
      whatsappText: 'Thank you for registering for MRV MUN. We look forward to seeing you at MET Rishikul Vidyalaya!',
    }
  });

  // 2. Upsert MRV MUN Event
  const eventData = {
    title: 'MRV MUN - External Registrations',
    slug: 'mrv-mun',
    date: new Date('2026-12-12T09:00:00Z'),
    venue: 'MET Rishikul Vidyalaya, Bhujbal Knowledge City, Bandra West, Mumbai',
    fee: 2500,
    feeOptions: {
      options: [
        {
          fee: 2500,
          currency: 'INR',
          logic: 'AND',
          conditions: []
        }
      ]
    },
    institute: 'MRV',
    isActive: true,
    formFields: [
      {
        name: 'fullName',
        type: 'text',
        label: 'Full Name (This will reflect on your certificate)',
        required: true
      },
      {
        name: 'email',
        type: 'email',
        label: 'Email',
        required: true
      },
      {
        name: 'mobile',
        type: 'tel',
        label: 'Phone number',
        required: true
      },
      {
        name: 'grade',
        type: 'text',
        label: 'Grade',
        required: true
      },
      {
        name: 'institution',
        type: 'text',
        label: 'School/Institution/College Name',
        required: true
      },
      {
        name: 'resume',
        type: 'file',
        label: 'Please upload your MUN Resume',
        required: true
      },
      {
        name: 'rolePreference',
        type: 'radio',
        label: 'What would you like to join us as?',
        options: ['Chair', 'Vice-chair'],
        required: true
      },
      {
        name: 'committeeChoice1',
        type: 'select',
        label: 'Committee Preference - Choice 1',
        options: [
          'UNSC',
          'UNHRC (Junior)',
          'ICJ',
          'ECOSOC',
          'FIFA',
          'BRICS (Junior)',
          'AIPPM',
          'UNODC'
        ],
        required: true
      },
      {
        name: 'committeeChoice2',
        type: 'select',
        label: 'Committee Preference - Choice 2',
        options: [
          'UNSC',
          'UNHRC (Junior)',
          'ICJ',
          'ECOSOC',
          'FIFA',
          'BRICS (Junior)',
          'AIPPM',
          'UNODC'
        ],
        required: true
      },
      {
        name: 'committeeChoice3',
        type: 'select',
        label: 'Committee Preference - Choice 3',
        options: [
          'UNSC',
          'UNHRC (Junior)',
          'ICJ',
          'ECOSOC',
          'FIFA',
          'BRICS (Junior)',
          'AIPPM',
          'UNODC'
        ],
        required: true
      },
      {
        name: 'additionalNotes',
        type: 'textarea',
        label: 'Anything else you want us to know?',
        required: false
      }
    ]
  };

  const event = await prisma.event.upsert({
    where: { slug: eventData.slug },
    update: eventData,
    create: eventData
  });

  console.log('Successfully seeded MRV MUN Event:', JSON.stringify(event, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
