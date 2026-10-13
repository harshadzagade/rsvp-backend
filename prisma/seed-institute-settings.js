const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Institute Settings...');

  const institutes = [
    {
      instituteCode: 'IMM',
      instituteName: 'MET Institute of Management',
      payuKey: 'wRoVzf',
      payuSalt: 'd6ySDVyAl0ZFDAlOR9jPgCWku025hWbT',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: 'mdp_imm@met.edu',
      emailPass: 'rmpc rwos btgo gxxw',
      adminEmails: 'mdp_imm@met.edu, conference_imm@met.edu',
      whatsappLink: '',
      whatsappText: 'We have received your registration for IMM Seminar.'
    },
    {
      instituteCode: 'IOP',
      instituteName: 'MET Institute of Pharmacy (Degree)',
      payuKey: 'pYUteO',
      payuSalt: 'Bh89ch1u3JwaBcxwT829Tg8Xtvj25z6j',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: 'seminar_iop@met.edu',
      emailPass: 'ilpe rglf cpiw tjbw',
      adminEmails: 'seminar_iop@met.edu',
      whatsappLink: 'https://chat.whatsapp.com/Gqurc6w03fqIbXuM80TtPj',
      whatsappText: 'We have received your registration. Please join the whatsapp group by clicking on joining link:'
    },
    {
      instituteCode: 'ICS',
      instituteName: 'MET Institute of Computer Science',
      payuKey: '015eQW',
      payuSalt: 'KZsmCRisl68bCu7HdRcsa3JBoZ94ltLG',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: 'icetcism2026@met.edu',
      emailPass: 'eiah wfhs sbvu yxdn',
      adminEmails: 'principal_ics@met.edu',
      whatsappLink: '',
      whatsappText: 'We have received your registration for ICETCISM.'
    },
    {
      instituteCode: 'PGDM',
      instituteName: 'MET Asian Management Development Centre (PGDM)',
      payuKey: 'MSAioA',
      payuSalt: 'E3bYUrQbHb7QG8y4A01oBVKCIT5wiQcB',
      payuBaseUrl: 'https://secure.payu.in/_payment',
      emailUser: 'pgdm_admin@met.edu',
      emailPass: 'pmei ejwh mjoc geqt',
      adminEmails: 'pgdm_admin@met.edu',
      whatsappLink: '',
      whatsappText: 'We have received your registration for PGDM event.'
    }
  ];

  for (const inst of institutes) {
    await prisma.instituteSetting.upsert({
      where: { instituteCode: inst.instituteCode },
      update: {},
      create: inst
    });
    console.log(`Initialized settings for ${inst.instituteCode}`);
  }

  // Update existing events with their respective institute
  await prisma.event.updateMany({
    where: { slug: { in: ['imm-sfx-seminar', 'sfx-seminar', 'bus'] } },
    data: { institute: 'IMM' }
  });
  console.log('Updated IMM events (SFX & Bus) with institute = IMM');

  await prisma.event.updateMany({
    where: { slug: { in: ['iop-cosmonext', 'iop-fdp', 'iop-fdp-python'] } },
    data: { institute: 'IOP' }
  });
  console.log('Updated IOP events with institute = IOP');

  await prisma.event.updateMany({
    where: { slug: 'dummy' },
    data: { institute: 'ICS' }
  });
  console.log('Updated ICS dummy event with institute = ICS');

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
