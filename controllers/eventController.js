const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createEvent = async (req, res) => {
  try {
    const { title, slug, date, venue, fee, feeOptions, formFields, institute } = req.body;

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
      data: { title, slug, date: new Date(date), venue, fee, feeOptions, formFields, institute: institute || 'IMM' }
    });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create event' });
  }
};


exports.getAllEvents = async (req, res) => {
  try {
    const { institute } = req.query;
    const where = {};
    if (institute && institute !== 'ALL') {
      where.OR = [
        { institute: institute.toUpperCase() },
        { slug: { contains: institute.toLowerCase() } }
      ];
    }
    const events = await prisma.event.findMany({
      where,
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

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, date, venue, fee, feeOptions, formFields, isActive, institute } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (date !== undefined) updateData.date = new Date(date);
    if (venue !== undefined) updateData.venue = venue;
    if (fee !== undefined) updateData.fee = Number(fee);
    if (feeOptions !== undefined) updateData.feeOptions = feeOptions;
    if (formFields !== undefined) updateData.formFields = formFields;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (institute !== undefined) updateData.institute = institute;

    const event = await prisma.event.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json(event);
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Could not update event' });
  }
};

exports.toggleEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.event.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const newStatus = typeof req.body.isActive === 'boolean' ? req.body.isActive : !existing.isActive;

    const event = await prisma.event.update({
      where: { id: parseInt(id) },
      data: { isActive: newStatus }
    });

    res.json({ message: `Event ${newStatus ? 'activated' : 'deactivated'} successfully`, event });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Could not change event status' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    const existing = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { rsvps: true } } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing._count?.rsvps > 0) {
      return res.status(400).json({
        error: `Cannot delete event because it has ${existing._count.rsvps} registered participants. Deactivate the link instead, or migrate registrations first.`
      });
    }

    await prisma.event.delete({ where: { id: eventId } });
    res.json({ message: 'Event deleted successfully', eventId });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Could not delete event' });
  }
};

