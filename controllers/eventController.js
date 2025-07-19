const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createEvent = async (req, res) => {
  try {
    const { title, slug, date, venue, fee, feeOptions, formFields } = req.body;

    if (feeOptions) {
      if (!Array.isArray(feeOptions.options)) {
        return res.status(400).json({ error: "feeOptions.options must be an array" });
      }

      for (let i = 0; i < feeOptions.options.length; i++) {
        const option = feeOptions.options[i];

        if (typeof option.fee !== 'number') {
          return res.status(400).json({ error: `feeOptions.options[${i}].fee must be a number` });
        }

        if (option.conditions && !Array.isArray(option.conditions)) {
          return res.status(400).json({ error: `feeOptions.options[${i}].conditions must be an array` });
        }

        if (option.conditions) {
          for (let j = 0; j < option.conditions.length; j++) {
            const cond = option.conditions[j];
            if (
              typeof cond !== 'object' ||
              !cond.field ||
              typeof cond.field !== 'string' ||
              typeof cond.value !== 'string'
            ) {
              return res.status(400).json({
                error: `feeOptions.options[${i}].conditions[${j}] must be an object with 'field' and 'value' strings`
              });
            }
          }
        }
      }
    }

    const event = await prisma.event.create({
      data: { title, slug, date: new Date(date), venue, fee, feeOptions, formFields }
    });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create event' });
  }
};


exports.getAllEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch events' });
  }
};


exports.getEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const event = await prisma.event.findUnique({ where: { slug } });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch event' });
  }
};


exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id: parseInt(id) } });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch event' });
  }
};
