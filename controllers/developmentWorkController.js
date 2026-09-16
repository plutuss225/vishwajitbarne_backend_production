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
function getFirstMedia(mediaStr) {
  if (!mediaStr || typeof mediaStr !== 'string') return mediaStr;
  const match = mediaStr.match(/^(data:[^;]+;base64,[^,]+)/i);
  if (match) return match[1];
  if (mediaStr.startsWith('[')) {
    try {
      const arr = JSON.parse(mediaStr);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch (e) {}
  }
  return mediaStr.split(',')[0];
}

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
    where.OR = [{ title: { contains: search } }, { description: { contains: search } }, { category: { contains: search } }, { place: { contains: search } }];
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

  const selectFields = {
    id: true,
    title: true,
    category: true,
    description: true,
    news_date: true,
    place: true,
    // Omit image, video, images, videos to save RAM
  };

  try {
    let result = [];
    let total = 0;
    
    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [totalCount, queryResult] = await Promise.all([
        prisma.development_work.count({ where }),
        prisma.development_work.findMany({
          where,
          orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
          skip: offset,
          take: parsedLimit,
          select: selectFields
        }),
      ]);
      total = totalCount;
      result = queryResult;
    } else {
      result = await prisma.development_work.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        take: 20,
        select: selectFields
      });
    }

    // Fetch only the first thumbnail for each record to prevent OOM (Out Of Memory)
    if (result.length > 0) {
      const ids = result.map(r => r.id);
      const mediaThumbnails = await prisma.$queryRawUnsafe(`
        SELECT id,
               SUBSTRING_INDEX(image, ',data:', 1) as image,
               SUBSTRING_INDEX(images, ',data:', 1) as images,
               CASE WHEN (video IS NOT NULL AND LENGTH(video) > 10) OR (videos IS NOT NULL AND LENGTH(videos) > 10) THEN 1 ELSE 0 END as has_video,
               CASE WHEN videos IS NOT NULL AND (videos LIKE '%youtube.com%' OR videos LIKE '%youtu.be%') THEN videos ELSE NULL END as youtube_url
        FROM development_work
        WHERE id IN (${ids.join(',')})
      `);

      const mediaMap = {};
      for (const m of mediaThumbnails) {
        mediaMap[m.id] = m;
      }

      result = result.map(item => {
        const m = mediaMap[item.id];
        let videoUrl = null;
        if (m && m.youtube_url) {
          // Return YouTube URL as-is so frontend can embed it
          videoUrl = m.youtube_url.split(',')[0].trim();
        } else if (m && m.has_video) {
          videoUrl = 'api/development_work/media/' + item.id + '.mp4';
        }
        return {
          ...item,
          image: getFirstMedia(m?.image),
          video: null,
          images: getFirstMedia(m?.images),
          videos: videoUrl
        };
      });
    }

    let finalResult = result;

    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      return res.json({
        data: finalResult,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      });
    } else {
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

    if (req.query.lite === 'true') {
      // Strip heavy binary video fields but preserve YouTube URLs
      if (result.video && result.video.length > 10) {
        const videoStr = result.video.toString ? result.video.toString('utf8') : String(result.video);
        if (videoStr.includes('youtube.com') || videoStr.includes('youtu.be')) {
          result.video = videoStr;
        } else {
          result.video = null;
          if (!result.videos) {
            result.videos = 'api/development_work/media/' + result.id + '.mp4';
          }
        }
      }
      if (result.videos) {
        const vidStr = result.videos.toString ? result.videos.toString('utf8') : String(result.videos);
        if (vidStr.includes('youtube.com') || vidStr.includes('youtu.be')) {
          result.videos = vidStr; // Keep YouTube URLs as-is
        } else if (vidStr.length > 10 && !vidStr.startsWith('api/')) {
          result.videos = 'api/development_work/media/' + result.id + '.mp4';
        }
      }
    }

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
    where.OR = [{ title: { contains: search } }, { description: { contains: search } }, { category: { contains: search } }, { place: { contains: search } }];
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
    
    const selectFields = {
      id: true,
      title: true,
      category: true,
      description: true,
      news_date: true,
      place: true,
    };

    try {
      let result = await prisma.development_work.findMany({
        where,
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        take: 3,
        select: selectFields
      });

      if (result.length > 0) {
        const ids = result.map(r => r.id);
        const mediaThumbnails = await prisma.$queryRawUnsafe(`
          SELECT id, image, video,
                 SUBSTRING_INDEX(images, ',data:', 1) as images,
                 SUBSTRING_INDEX(videos, ',data:', 1) as videos
          FROM development_work
          WHERE id IN (${ids.join(',')})
        `);
  
        const mediaMap = {};
        for (const m of mediaThumbnails) {
          mediaMap[m.id] = m;
        }
  
        result = result.map(item => ({
          ...item,
          image: mediaMap[item.id]?.image,
          video: mediaMap[item.id]?.video,
          images: getFirstMedia(mediaMap[item.id]?.images),
          videos: getFirstMedia(mediaMap[item.id]?.videos)
        }));
      }

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
      { marathi: 'थेरगाव', db: 'थेरगाव' },
      { marathi: 'वाकड', db: 'वाकड' },
      { marathi: 'काळेवाडी', db: 'काळेवाडी' },
      { marathi: 'पिंपरी चिंचवड', db: 'पिंपरी चिंचवड' },
      { marathi: 'गणेश नगर', db: 'गणेश नगर' },
      { marathi: 'मोशी', db: 'मोशी' },
      { marathi: 'मावळ', db: 'मावळ' },
      { marathi: 'गुजर नगर', db: 'गुजर नगर' }
    ];
    
    const selectFields = {
      id: true,
      title: true,
      category: true,
      description: true,
      news_date: true,
      place: true,
    };

    try {
      const queries = places.map(async (place) => {
        const work = await prisma.development_work.findFirst({
          where: { place: { contains: place.db } },
          orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
          select: selectFields
        });
        if (work) return { ...work, searchedPlace: place.marathi };
        return null;
      });
      let results = (await Promise.all(queries)).filter(w => w !== null);

      if (results.length > 0) {
        const ids = results.map(r => r.id);
        const mediaThumbnails = await prisma.$queryRawUnsafe(`
          SELECT id,
                 SUBSTRING_INDEX(image, ',data:', 1) as image,
                 SUBSTRING_INDEX(images, ',data:', 1) as images,
                 CASE WHEN (video IS NOT NULL AND LENGTH(video) > 10) OR (videos IS NOT NULL AND LENGTH(videos) > 10) THEN 1 ELSE 0 END as has_video,
                 CASE WHEN videos IS NOT NULL AND (videos LIKE '%youtube.com%' OR videos LIKE '%youtu.be%') THEN videos ELSE NULL END as youtube_url
          FROM development_work
          WHERE id IN (${ids.join(',')})
        `);
  
        const mediaMap = {};
        for (const m of mediaThumbnails) {
          mediaMap[m.id] = m;
        }
  
        results = results.map(item => {
          const m = mediaMap[item.id];
          let videoUrl = null;
          if (m && m.youtube_url) {
            videoUrl = m.youtube_url.split(',')[0].trim();
          } else if (m && m.has_video) {
            videoUrl = 'api/development_work/media/' + item.id + '.mp4';
          }
          return {
            ...item,
            image: getFirstMedia(m?.image),
            video: null,
            images: getFirstMedia(m?.images),
            videos: videoUrl
          };
        });
      }

      const targetLang = getTargetLanguage(req);
      let finalResult = results;
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            results.map((item) => translateDevelopmentWorkItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error translating development_work by places:", transErr.message);
        }
      }

      res.json(finalResult);
    } catch (err) {
      return res.status(500).json({ error: err.message });
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
    where.OR = [{ title: { contains: search } }, { description: { contains: search } }, { category: { contains: search } }, { place: { contains: search } }];
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


// STREAM VIDEO ENDPOINT
exports.streamDevelopmentWorkVideo = async (req, res) => {
  try {
    const work = await prisma.development_work.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { video: true, videos: true }
    });
    
    if (!work) return res.status(404).send('Not found');
    
    let videoStr = null;
    if (work.video && work.video.length > 10) {
      videoStr = work.video.toString('utf-8');
    } else if (work.videos && work.videos.length > 10) {
      const v = work.videos.toString('utf-8');
      videoStr = v.startsWith('data:') ? v : v.split(',')[0];
    }
    
    if (!videoStr) return res.status(404).send('No video');
    
    const base64Data = videoStr.split(',')[1] || videoStr;
    const buffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (e) {
    console.error("Error streaming video:", e);
    res.status(500).send('Error');
  }
};

// GET LATEST 1 DEVELOPMENT WORK PER MONTH (for the 4 most recent months)
exports.getLatestDevelopmentWorkByYear = async (req, res) => {
  const selectFields = {
    id: true,
    title: true,
    category: true,
    description: true,
    news_date: true,
    place: true,
  };

  try {
    // Build the 4 most recent months (current month + 3 before it)
    const now = new Date();
    const months = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 }); // month is 1-indexed
    }

    // Step 2: For each month, fetch the single latest record
    const results = [];
    for (const { year, month } of months) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth   = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

      const item = await prisma.development_work.findFirst({
        where: {
          news_date: { gte: startOfMonth, lte: endOfMonth }
        },
        orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
        select: selectFields
      });

      if (item) results.push({ ...item, year, month });
    }

    // Step 3: Attach thumbnail media for each result
    if (results.length > 0) {
      const ids = results.map(r => r.id);
      const mediaThumbnails = await prisma.$queryRawUnsafe(`
        SELECT id,
               SUBSTRING_INDEX(image, ',data:', 1) AS image,
               SUBSTRING_INDEX(images, ',data:', 1) AS images,
               CASE WHEN (video IS NOT NULL AND LENGTH(video) > 10) OR (videos IS NOT NULL AND LENGTH(videos) > 10) THEN 1 ELSE 0 END AS has_video,
               CASE WHEN videos IS NOT NULL AND (videos LIKE '%youtube.com%' OR videos LIKE '%youtu.be%') THEN videos ELSE NULL END AS youtube_url
        FROM development_work
        WHERE id IN (${ids.join(',')})
      `);

      const mediaMap = {};
      for (const m of mediaThumbnails) {
        mediaMap[m.id] = m;
      }

      for (let i = 0; i < results.length; i++) {
        const m = mediaMap[results[i].id];
        let videoUrl = null;
        if (m && m.youtube_url) {
          videoUrl = m.youtube_url.split(',')[0].trim();
        } else if (m && m.has_video) {
          videoUrl = 'api/development_work/media/' + results[i].id + '.mp4';
        }
        results[i] = {
          ...results[i],
          image: getFirstMedia(m?.image),
          video: null,
          images: getFirstMedia(m?.images),
          videos: videoUrl
        };
      }
    }

    // Step 4: Optional translation
    const targetLang = getTargetLanguage(req);
    let finalResult = results;
    if (targetLang) {
      try {
        finalResult = await Promise.all(
          results.map(item => translateDevelopmentWorkItem(item, targetLang))
        );
      } catch (transErr) {
        console.error("Error translating latest-by-month:", transErr.message);
      }
    }

    return res.json(finalResult);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
