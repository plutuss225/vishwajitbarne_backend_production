const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

// Helper to parse Prisma Bytes object back to a string URL
function parsePrismaBuffer(bufferObj) {
  if (!bufferObj) return bufferObj;
  if (typeof bufferObj === 'string') return bufferObj;
  try {
    const vals = bufferObj.type === 'Buffer' && Array.isArray(bufferObj.data) ? bufferObj.data : Object.values(bufferObj);
    return Buffer.from(vals).toString('utf-8');
  } catch (err) {
    return bufferObj;
  }
}

async function translateElectionItem(item, targetLang) {
  if (!targetLang) return item;
  try {
    const [title, category, description] = await Promise.all([
      translateText(item.title, targetLang),
      translateText(item.category, targetLang),
      item.description ? translateText(item.description, targetLang) : null,
    ]);

    let finalMediaUrl = item.mediaUrl;
    if (finalMediaUrl && (Buffer.isBuffer(finalMediaUrl) || finalMediaUrl instanceof Uint8Array || typeof finalMediaUrl === 'object')) {
      finalMediaUrl = parsePrismaBuffer(finalMediaUrl);
    }

    return {
      ...item,
      _id: item.id,
      title,
      category,
      description,
      mediaUrl: finalMediaUrl
    };
  } catch (err) {
    console.error("Error in translateElectionItem:", err.message);
    return item;
  }
}

// GET ALL ELECTIONS
exports.getAllElections = async (req, res) => {
  let { page, limit, search, category, startDate, endDate, year } = req.query;

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

  if (year) {
    where.electionYear = parseInt(year);
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } },
    ];
  }

  if (startDate || endDate) {
    where.uploadDate = {};
    if (startDate) {
      where.uploadDate.gte = new Date(startDate);
    }
    if (endDate) {
      where.uploadDate.lte = new Date(endDate);
    }
  }

  try {
    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [total, result] = await Promise.all([
        prisma.elections.count({ where }),
        prisma.elections.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: offset,
          take: parsedLimit,
        }),
      ]);

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateElectionItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error in parallel translation:", transErr.message);
        }
      } else {
        finalResult = result.map(item => {
          if (item.mediaUrl && (Buffer.isBuffer(item.mediaUrl) || item.mediaUrl instanceof Uint8Array || typeof item.mediaUrl === 'object')) {
            item.mediaUrl = parsePrismaBuffer(item.mediaUrl);
          }
          return item;
        });
      }

      return res.json({
        data: finalResult,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      });
    } else {
      const result = await prisma.elections.findMany({
        where,
        orderBy: { id: 'desc' },
      });

      let finalResult = result;
      const targetLang = getTargetLanguage(req);
      if (targetLang) {
        try {
          finalResult = await Promise.all(
            result.map((item) => translateElectionItem(item, targetLang))
          );
        } catch (transErr) {
          console.error("Error in parallel translation:", transErr.message);
        }
      } else {
        finalResult = result.map(item => {
          if (item.mediaUrl && (Buffer.isBuffer(item.mediaUrl) || item.mediaUrl instanceof Uint8Array || typeof item.mediaUrl === 'object')) {
            item.mediaUrl = parsePrismaBuffer(item.mediaUrl);
          }
          return item;
        });
      }

      return res.json({ data: finalResult });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET BY ID
exports.getElectionById = async (req, res) => {
  try {
    const result = await prisma.elections.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!result) return res.json({ data: null });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedItem = await translateElectionItem(result, targetLang);
        return res.json({ data: translatedItem });
      } catch (transErr) {
        console.error("Error in single translation:", transErr.message);
      }
    }

    if (result.mediaUrl && (Buffer.isBuffer(result.mediaUrl) || result.mediaUrl instanceof Uint8Array || typeof result.mediaUrl === 'object')) {
      result.mediaUrl = parsePrismaBuffer(result.mediaUrl);
    }
    
    result._id = result.id;

    res.json({ data: result }); 
  } catch (err) {
    return res.json(err);
  }
};

// INSERT ELECTION
exports.createElection = async (req, res) => {
  const { title, electionYear, category, description, mediaType, mediaUrl, uploadDate, isActive } = req.body;

  try {
    const result = await prisma.elections.create({
      data: {
        title,
        electionYear: parseInt(electionYear),
        category: category || 'Elections',
        description,
        mediaType,
        mediaUrl: Array.isArray(mediaUrl) ? Buffer.from(JSON.stringify(mediaUrl), 'utf-8') : (typeof mediaUrl === 'string' ? Buffer.from(mediaUrl, 'utf-8') : mediaUrl),
        uploadDate: uploadDate ? new Date(uploadDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    res.json({ message: "Election added", result });
  } catch (err) {
    console.error("Error creating election:", err);
    return res.status(500).json({ error: err.message || "Failed to create election" });
  }
};

// UPDATE ELECTION
exports.updateElection = async (req, res) => {
  const { title, electionYear, category, description, mediaType, mediaUrl, uploadDate, isActive } = req.body;

  try {
    const result = await prisma.elections.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        electionYear: electionYear ? parseInt(electionYear) : undefined,
        category: category || 'Elections',
        description,
        mediaType,
        mediaUrl: Array.isArray(mediaUrl) ? Buffer.from(JSON.stringify(mediaUrl), 'utf-8') : (typeof mediaUrl === 'string' ? Buffer.from(mediaUrl, 'utf-8') : mediaUrl),
        uploadDate: uploadDate ? new Date(uploadDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    res.json({ message: "Updated", result });
  } catch (err) {
    return res.json(err);
  }
};

// DELETE ELECTION
exports.deleteElection = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const selectResult = await prisma.elections.findUnique({
      where: { id },
      select: { mediaUrl: true },
    });

    // Cloudinary logic removed

    await prisma.elections.delete({
      where: { id },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    return res.status(500).json(err);
  }
};

// GET CATEGORIES
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.elections.findMany({
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
        return res.json({ data: resultCategories });
      } catch (transErr) {
        console.error("Error translating categories:", transErr.message);
      }
    }

    const resultCategories = originalCategories.map(c => ({ key: c, label: c }));
    res.json({ data: resultCategories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET CATEGORIES BY YEAR
exports.getCategoriesByYear = async (req, res) => {
  const { year } = req.params;
  try {
    const categories = await prisma.elections.findMany({
      select: { category: true },
      distinct: ['category'],
      where: {
        category: { not: null, not: '' },
        electionYear: parseInt(year),
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
        return res.json({ data: translated });
      } catch (transErr) {
        console.error("Error translating categories by year:", transErr.message);
      }
    }

    res.json({ data: originalCategories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
