const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

async function translateDevelopmentWorkItem(item, targetLang) {
  if (!targetLang) return item;
  try {
    const [title, category, description, place] = await Promise.all([
      translateText(item.title, targetLang),
      translateText(item.category, targetLang),
      translateText(item.description, targetLang),
      translateText(item.place, targetLang)
    ]);
    return {
      ...item,
      title,
      category,
      description,
      place
    };
  } catch (err) {
    console.error("Error in translateDevelopmentWorkItem:", err.message);
    return item;
  }
}

// GET ALL NEWS
exports.getAllDevelopmentWork = async (req, res) => {
  const { page, limit, search, category, startDate, endDate, place } = req.query;

  const where = {};

  if (category) {
    where.category = category;
  }

  if (place) {
    where.place = place;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (startDate || endDate) {
    where.news_date = {};
    if (startDate) {
      where.news_date.gte = new Date(startDate);
    }
    if (endDate) {
      where.news_date.lte = new Date(endDate);
    }
  }

  try {
    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [total, result] = await Promise.all([
        prisma.development_work.count({ where }),
        prisma.development_work.findMany({
          where,
          orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
          skip: offset,
          take: parsedLimit,
        }),
      ]);

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateDevelopmentWorkItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error in parallel translation:", transErr.message);
        }
      }

      return res.json({
        data: finalResult,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      });
    } else {
      const result = await prisma.development_work.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        take: 20,
      });

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateDevelopmentWorkItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error in parallel translation:", transErr.message);
        }
      }

      return res.json(finalResult);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET BY ID
exports.getDevelopmentWorkById = async (req, res) => {
  try {
    const result = await prisma.development_work.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!result) return res.json([]);

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedItem = await translateDevelopmentWorkItem(result, targetLang);
        return res.json([translatedItem]);
      } catch (transErr) {
        console.error("Error in single translation:", transErr.message);
      }
    }

    res.json([result]); // array for backward compatibility
  } catch (err) {
    return res.json(err);
  }
};

// INSERT NEWS
exports.createDevelopmentWork = async (req, res) => {
  const { title, category, place, description, image, video, images, videos, news_date } = req.body;

  try {
    const result = await prisma.development_work.create({
      data: {
        title,
        category: category || 'DevelopmentWork',
        place,
        description,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        video: typeof video === 'string' ? Buffer.from(video, 'utf-8') : video,
        images: typeof images === 'object' ? JSON.stringify(images) : images,
        videos: typeof videos === 'object' ? JSON.stringify(videos) : videos,
        news_date: news_date ? new Date(news_date) : null,
      },
    });
    res.json({ message: "DevelopmentWork added", result });
  } catch (err) {
    console.error("Error creating development work:", err);
    return res.status(500).json({ error: err.message || "Failed to create" });
  }
};

// UPDATE NEWS
exports.updateDevelopmentWork = async (req, res) => {
  const { title, category, place, description, image, video, images, videos, news_date } = req.body;

  try {
    const result = await prisma.development_work.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        category: category || 'DevelopmentWork',
        place,
        description,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        video: typeof video === 'string' ? Buffer.from(video, 'utf-8') : video,
        images: typeof images === 'object' ? JSON.stringify(images) : images,
        videos: typeof videos === 'object' ? JSON.stringify(videos) : videos,
        news_date: news_date ? new Date(news_date) : null,
      },
    });
    res.json({ message: "Updated", result });
  } catch (err) {
    console.error("Error updating development work:", err);
    return res.status(500).json({ error: err.message || "Failed to update" });
  }
};

// DELETE NEWS
exports.deleteDevelopmentWork = async (req, res) => {
  const development_workId = parseInt(req.params.id);

  try {
    await prisma.development_work.delete({
      where: { id: development_workId },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    return res.status(500).json(err);
  }
};

// GET CATEGORIES (max 4 distinct from development_work table)
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.development_work.findMany({
      select: { category: true },
      distinct: ['category'],
      where: {
        category: { not: null, not: '' },
      },
      orderBy: { category: 'asc' },
    });

    const places = await prisma.development_work.findMany({
      select: { place: true },
      distinct: ['place'],
      where: {
        place: { not: null, not: '' },
      },
      orderBy: { place: 'asc' },
    });

    const originalCategories = categories
      .map((r) => r.category)
      .filter((c) => c && c.trim() !== '');

    const originalPlaces = places
      .map((r) => r.place)
      .filter((c) => c && c.trim() !== '');

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedCategories = await Promise.all(
          originalCategories.map((c) => translateText(c, targetLang))
        );
        const resultCategories = originalCategories.map((c, i) => ({
          key: c,
          label: translatedCategories[i]
        }));

        const translatedPlaces = await Promise.all(
          originalPlaces.map((p) => translateText(p, targetLang))
        );
        const resultPlaces = originalPlaces.map((p, i) => ({
          key: p,
          label: translatedPlaces[i]
        }));

        return res.json({ categories: resultCategories, places: resultPlaces });
      } catch (transErr) {
        console.error("Error translating categories/places:", transErr.message);
      }
    }

    const resultCategories = originalCategories.map(c => ({ key: c, label: c }));
    const resultPlaces = originalPlaces.map(p => ({ key: p, label: p }));
    res.json({ categories: resultCategories, places: resultPlaces });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET ALL NEWS BY CATEGORY (filtered, latest first)
exports.getDevelopmentWorkByCategory = async (req, res) => {
  let { category, search, page, limit } = req.query;

  const where = {};

  if (category) {
    where.category = category;
  }

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

      const [total, result] = await Promise.all([
        prisma.development_work.count({ where }),
        prisma.development_work.findMany({
          where,
          orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
          skip: offset,
          take: parsedLimit,
        }),
      ]);

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateDevelopmentWorkItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error translating development_work by category:", transErr.message);
        }
      }

      return res.json({
        data: finalResult,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      });
    } else {
      const result = await prisma.development_work.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        take: 20,
      });

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateDevelopmentWorkItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error translating development_work by category:", transErr.message);
        }
      }

      return res.json(finalResult);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET TOP 3 NEWS BY CATEGORY (latest 3, useful for homepage sections)
exports.getTopDevelopmentWorkByCategory = async (req, res) => {
  const { category } = req.query;
  const where = category ? { category } : {};

  try {
    const result = await prisma.development_work.findMany({
      where,
      orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
      take: 3,
    });

    let finalResult = result;
    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        finalResult = await Promise.all(
          result.map((item) => translateDevelopmentWorkItem(item, targetLang))
        );
      } catch (transErr) {
        console.error("Error translating top development_work by category:", transErr.message);
      }
    }

    res.json(finalResult);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getLatestDevelopmentWorkByPlaces = async (req, res) => {
  const places = [
    { marathi: 'गुजर नगर', db: 'गुजर नगर' },
    { marathi: 'थेरगाव', db: 'थेरगाव' },
    { marathi: 'काळेवाडी', db: 'Kalewadi' },
    { marathi: 'पिंपरी चिंचवड', db: 'Pimpri Chinchwad' },
    { marathi: 'गणेश नगर', db: 'Ganesh Nagar' },
    { marathi: 'मोशी', db: 'Moshi' },
    { marathi: 'मावळ', db: 'Maval' }
  ];
  try {
    const results = [];
    for (const place of places) {
      const work = await prisma.development_work.findFirst({
        where: { place: { contains: place.db } },
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }]
      });
      if (work) results.push({ ...work, searchedPlace: place.marathi });
    }
    const targetLang = getTargetLanguage(req);
    let finalResult = results;
    if (targetLang) {
      finalResult = await Promise.all(results.map(item => translateDevelopmentWorkItem(item, targetLang)));
    }
    return res.status(200).json(finalResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch latest development works by place" });
  }
};
