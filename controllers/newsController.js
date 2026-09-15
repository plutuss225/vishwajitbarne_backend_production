const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

async function translateNewsItem(item, targetLang) {
  if (!targetLang) return item;
  try {
    const [title, category, description] = await Promise.all([
      translateText(item.title, targetLang),
      translateText(item.category, targetLang),
      translateText(item.description, targetLang)
    ]);
    return {
      ...item,
      title,
      category,
      description
    };
  } catch (err) {
    console.error("Error in translateNewsItem:", err.message);
    return item;
  }
}

// GET ALL NEWS
exports.getAllNews = async (req, res) => {
  let { page, limit, search, category, startDate, endDate } = req.query;

  if (search) {
    try {
      search = await translateText(search, "mr");
    } catch (e) {
      console.error("Error translating search term:", e.message);
    }
  }

  const where = {};

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
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
        prisma.news.count({ where }),
        prisma.news.findMany({
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
            result.map((item) => translateNewsItem(item, targetLang))
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
      const result = await prisma.news.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        take: 20,
      });

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateNewsItem(item, targetLang))
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
exports.getNewsById = async (req, res) => {
  try {
    const result = await prisma.news.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!result) return res.json([]);

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedItem = await translateNewsItem(result, targetLang);
        return res.json([translatedItem]);
      } catch (transErr) {
        console.error("Error in single translation:", transErr.message);
      }
    }

    res.json([result]); // kept array format for backward compatibility
  } catch (err) {
    return res.json(err);
  }
};

// INSERT NEWS
exports.createNews = async (req, res) => {
  const { title, category, description, image, video, news_date } = req.body;

  try {
    const result = await prisma.news.create({
      data: {
        title,
        category: category || 'News',
        description,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        video: typeof video === 'string' ? Buffer.from(video, 'utf-8') : video,
        news_date: news_date ? new Date(news_date) : null,
      },
    });
    res.json({ message: "News added", result });
  } catch (err) {
    console.error("Error creating news:", err);
    return res.status(500).json({ error: err.message || "Failed to create news" });
  }
};

// UPDATE NEWS
exports.updateNews = async (req, res) => {
  const { title, category, description, image, video, news_date } = req.body;

  try {
    const result = await prisma.news.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        category: category || 'News',
        description,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        video: typeof video === 'string' ? Buffer.from(video, 'utf-8') : video,
        news_date: news_date ? new Date(news_date) : null,
      },
    });
    res.json({ message: "Updated", result });
  } catch (err) {
    return res.json(err);
  }
};

// DELETE NEWS
exports.deleteNews = async (req, res) => {
  const newsId = parseInt(req.params.id);

  try {
    const selectResult = await prisma.news.findUnique({
      where: { id: newsId },
      select: { image: true },
    });

    // Cloudinary logic removed

    await prisma.news.delete({
      where: { id: newsId },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    return res.status(500).json(err);
  }
};

// GET CATEGORIES (max 4 distinct from news table)
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.news.findMany({
      select: { category: true },
      distinct: ['category'],
      where: {
        category: { not: null, not: '' },
      },
      orderBy: { category: 'asc' },
    });

    const originalCategories = categories
      .map((r) => r.category)
      .filter((c) => c && c.trim() !== '');

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translated = await Promise.all(
          originalCategories.map((c) => translateText(c, targetLang))
        );
        const resultCategories = originalCategories.map((c, i) => ({
          key: c,
          label: translated[i]
        }));
        return res.json({ categories: resultCategories });
      } catch (transErr) {
        console.error("Error translating categories:", transErr.message);
      }
    }

    const resultCategories = originalCategories.map(c => ({ key: c, label: c }));
    res.json({ categories: resultCategories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET ALL NEWS BY CATEGORY (filtered, latest first)
exports.getNewsByCategory = async (req, res) => {
  let { category, search, page, limit } = req.query;

  if (search) {
    try {
      search = await translateText(search, "mr");
    } catch (e) {
      console.error("Error translating search term:", e.message);
    }
  }

  const where = {};

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
    ];
  }

  try {
    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [total, result] = await Promise.all([
        prisma.news.count({ where }),
        prisma.news.findMany({
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
            result.map((item) => translateNewsItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error translating news by category:", transErr.message);
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
      const result = await prisma.news.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
      });

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateNewsItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error translating news by category:", transErr.message);
        }
      }

      return res.json(finalResult);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET TOP 3 NEWS BY CATEGORY
exports.getTopNewsByCategory = async (req, res) => {
  const { category } = req.query;
  const where = category ? { category } : {};

  try {
    const result = await prisma.news.findMany({
      where,
      orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
      take: 3,
    });

    let finalResult = result;
    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        finalResult = await Promise.all(
          result.map((item) => translateNewsItem(item, targetLang))
        );
      } catch (transErr) {
        console.error("Error translating top news by category:", transErr.message);
      }
    }

    res.json(finalResult);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
