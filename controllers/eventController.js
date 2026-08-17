const prisma = require("../config/prisma");
const { deleteImageFromCloudinary } = require("../utils/cloudinary");
const { translateText, getTargetLanguage } = require("../utils/translator");

async function translateEventItem(item, targetLang) {
  if (!targetLang) return item;
  try {
    const [translatedTitle, translatedDesc] = await Promise.all([
      translateText(item.title, targetLang),
      item.description ? translateText(item.description, targetLang) : null,
    ]);
    return {
      ...item,
      title: translatedTitle || item.title,
      description: translatedDesc || item.description,
    };
  } catch (err) {
    console.error("Error translating event item:", err.message);
    return item;
  }
}

// GET ALL EVENTS
exports.getAllEvents = async (req, res) => {
  const { page, limit, search } = req.query;

  const where = {};

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  try {
    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [total, fetchedResult] = await Promise.all([
        prisma.event.count({ where }),
        prisma.event.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: offset,
          take: parsedLimit,
        }),
      ]);

      let result = fetchedResult;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        result = await Promise.all(
          result.map(item => translateEventItem(item, targetLang))
        );
      }

      return res.json({
        data: result,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      });
    } else {
      let result = await prisma.event.findMany({
        where,
        orderBy: { id: 'desc' },
      });
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        result = await Promise.all(
          result.map(item => translateEventItem(item, targetLang))
        );
      }
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET EVENT BY ID
exports.getEventById = async (req, res) => {
  try {
    let result = await prisma.event.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!result) return res.json([]);
    
    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      result = await translateEventItem(result, targetLang);
    }
    res.json([result]);
  } catch (err) {
    return res.json(err);
  }
};

// CREATE EVENT
exports.createEvent = async (req, res) => {
  const { title, description, main_image, images } = req.body;

  try {
    const result = await prisma.event.create({
      data: {
        title,
        description,
        main_image: typeof main_image === 'string' ? Buffer.from(main_image, 'utf-8') : main_image,
        images: typeof images === 'object' ? JSON.stringify(images) : images, // Store array of images and videos properly as string
      },
    });
    res.json({ message: "Event added", result });
  } catch (err) {
    console.error("Error creating event:", err);
    return res.status(500).json({ error: err.message || "Failed to create event" });
  }
};

// UPDATE EVENT
exports.updateEvent = async (req, res) => {
  const { title, description, main_image, images } = req.body;

  try {
    const dataToUpdate = {
      title,
      description,
      images: typeof images === 'object' ? JSON.stringify(images) : images,
    };

    if (main_image !== undefined) {
      dataToUpdate.main_image = typeof main_image === 'string' ? Buffer.from(main_image, 'utf-8') : main_image;
    }

    const result = await prisma.event.update({
      where: { id: parseInt(req.params.id) },
      data: dataToUpdate,
    });
    res.json({ message: "Event updated", result });
  } catch (err) {
    console.error("Error updating event:", err);
    return res.status(500).json({ error: err.message || "Failed to update event" });
  }
};

// DELETE EVENT
exports.deleteEvent = async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const selectResult = await prisma.event.findUnique({
      where: { id: eventId },
      select: { main_image: true },
    });

    if (selectResult && selectResult.main_image) {
      await deleteImageFromCloudinary(selectResult.main_image.toString('utf-8'));
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    res.json({ message: "Event deleted" });
  } catch (err) {
    return res.status(500).json(err);
  }
};
