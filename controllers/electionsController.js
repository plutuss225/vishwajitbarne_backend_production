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
  return mediaStr.split(',')[0]?.trim() || null;
}

// GET ALL ELECTIONS (Optimized fast listing with lightweight thumbnails)
exports.getAllElections = async (req, res) => {
  let { page, limit, search, category, startDate, endDate, year } = req.query;

  const where = {};

  if (category && category !== 'all') {
    where.category = category;
  }

  if (year && year !== 'all') {
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

  const selectFields = {
    id: true,
    title: true,
    electionYear: true,
    category: true,
    description: true,
    mediaType: true,
    uploadDate: true,
    isActive: true,
    created_at: true,
  };

  try {
    let result = [];
    let total = 0;

    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      const offset = (parsedPage - 1) * parsedLimit;

      const [totalCount, queryResult] = await Promise.all([
        prisma.elections.count({ where }),
        prisma.elections.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: offset,
          take: parsedLimit,
          select: selectFields,
        }),
      ]);
      total = totalCount;
      result = queryResult;
    } else {
      result = await prisma.elections.findMany({
        where,
        orderBy: { id: 'desc' },
        select: selectFields,
      });
      total = result.length;
    }

    if (result.length > 0) {
      const ids = result.map((r) => r.id);
      const mediaThumbnails = await prisma.$queryRawUnsafe(`
        SELECT id,
               SUBSTRING_INDEX(images, ',data:', 1) as first_image,
               CASE 
                 WHEN videos IS NOT NULL AND (videos LIKE '%youtube.com%' OR videos LIKE '%youtu.be%') THEN videos
                 ELSE NULL 
               END as youtube_url,
               CASE 
                 WHEN (videos IS NOT NULL AND LENGTH(videos) > 10) OR (mediaType = 'video') THEN 1 
                 ELSE 0 
               END as has_video,
               (CASE WHEN (images LIKE '%,%' OR (images IS NOT NULL AND videos IS NOT NULL)) THEN 1 ELSE 0 END) as has_multiple
        FROM elections 
        WHERE id IN (${ids.join(',')})
      `);

      const mediaMap = new Map();
      mediaThumbnails.forEach((r) => {
        let mediaUrl = null;
        if (r.first_image) {
          mediaUrl = r.first_image.split(',')[0].startsWith('data:') ? r.first_image : r.first_image.split(',')[0];
        } else if (r.youtube_url) {
          mediaUrl = r.youtube_url.split(',')[0].trim();
        } else if (r.has_video) {
          mediaUrl = 'api/elections/media/' + r.id + '.mp4';
        }

        mediaMap.set(r.id, {
          mediaUrl,
          images: r.first_image ? getFirstMedia(r.first_image) : null,
          videos: r.youtube_url ? r.youtube_url : (r.has_video ? 'api/elections/media/' + r.id + '.mp4' : null),
          hasMultiple: !!r.has_multiple,
          mediaType: (r.has_video || r.youtube_url) && !r.first_image ? 'video' : 'image',
        });
      });

      result = result.map((item) => {
        const m = mediaMap.get(item.id);
        return {
          ...item,
          _id: item.id,
          mediaUrl: m?.mediaUrl || null,
          images: m?.images || null,
          videos: m?.videos || null,
          hasMultiple: m?.hasMultiple || false,
          mediaType: m?.mediaType || item.mediaType || 'image',
        };
      });
    }

    if (page && limit) {
      const parsedPage = parseInt(page);
      const parsedLimit = parseInt(limit);
      return res.json({
        data: result,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error("Error in getAllElections:", err);
    return res.status(500).json({ error: err.message });
  }
};

// GET BY ID (Full detail with all images and videos)
exports.getElectionById = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid election ID" });
  }

  try {
    const rawRows = await prisma.$queryRawUnsafe(
      `SELECT id, title, electionYear, category, description, mediaType, mediaUrl, images, videos, uploadDate, isActive, created_at FROM elections WHERE id = ${id}`
    );

    if (!rawRows || rawRows.length === 0) {
      return res.json({ data: null });
    }

    const item = rawRows[0];
    let mediaUrl = item.mediaUrl ? parsePrismaBuffer(item.mediaUrl) : null;
    if (!mediaUrl) {
      if (item.images) {
        mediaUrl = item.images.split(',')[0];
      } else if (item.videos) {
        const v = item.videos.toString('utf-8');
        if (v.includes('youtube.com') || v.includes('youtu.be')) {
          mediaUrl = v.split(',')[0].trim();
        } else {
          mediaUrl = 'api/elections/media/' + item.id + '.mp4';
        }
      }
    }

    const result = {
      ...item,
      _id: item.id,
      mediaUrl,
      images: item.images || null,
      videos: item.videos || null,
    };

    res.json({ data: result });
  } catch (err) {
    console.error("Error in getElectionById:", err);
    return res.status(500).json({ error: err.message });
  }
};

// STREAM VIDEO ENDPOINT
exports.streamElectionVideo = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).send("Invalid ID");
  }

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, mediaUrl, videos FROM elections WHERE id = ${id}`
    );
    const work = rows && rows[0];
    if (!work) return res.status(404).send("Not found");

    let videoStr = null;
    if (work.videos && work.videos.length > 10) {
      const v = work.videos.toString("utf-8");
      videoStr = v.startsWith("data:") ? v : v.split(",")[0];
    } else if (work.mediaUrl && work.mediaUrl.length > 10) {
      const v = work.mediaUrl.toString("utf-8");
      videoStr = v.startsWith("data:") ? v : v.split(",")[0];
    }

    if (!videoStr) return res.status(404).send("No video found");

    const base64Data = videoStr.split(",")[1] || videoStr;
    const buffer = Buffer.from(base64Data, "base64");

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(buffer);
  } catch (err) {
    console.error("Error streaming election video:", err);
    res.status(500).send("Error");
  }
};

// GET DISTINCT ELECTION YEARS
exports.getElectionYears = async (req, res) => {
  try {
    const years = await prisma.elections.findMany({
      select: { electionYear: true },
      distinct: ['electionYear'],
      where: { isActive: true },
      orderBy: { electionYear: 'desc' },
    });

    const result = years.map((y) => y.electionYear);
    res.json({ data: result.length > 0 ? result : [2026] });
  } catch (err) {
    console.error("Error fetching election years:", err);
    res.json({ data: [2026] });
  }
};

// INSERT ELECTION
exports.createElection = async (req, res) => {
  const { title, electionYear, category, description, mediaType, mediaUrl, images, videos, uploadDate, isActive } = req.body;

  try {
    const result = await prisma.elections.create({
      data: {
        title,
        electionYear: parseInt(electionYear),
        category: category || 'Elections',
        description,
        mediaType: mediaType || 'image',
        mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? Buffer.from(JSON.stringify(mediaUrl), 'utf-8') : (typeof mediaUrl === 'string' ? Buffer.from(mediaUrl, 'utf-8') : mediaUrl)) : null,
        uploadDate: uploadDate ? new Date(uploadDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    if (images || videos) {
      await prisma.$queryRawUnsafe(
        `UPDATE elections SET images = ?, videos = ? WHERE id = ?`,
        typeof images === 'object' ? JSON.stringify(images) : (images || null),
        typeof videos === 'object' ? JSON.stringify(videos) : (videos || null),
        result.id
      );
    }

    res.json({ message: "Election added", result });
  } catch (err) {
    console.error("Error creating election:", err);
    return res.status(500).json({ error: err.message || "Failed to create election" });
  }
};

// UPDATE ELECTION
exports.updateElection = async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, electionYear, category, description, mediaType, mediaUrl, images, videos, uploadDate, isActive } = req.body;

  try {
    const result = await prisma.elections.update({
      where: { id },
      data: {
        title,
        electionYear: electionYear ? parseInt(electionYear) : undefined,
        category: category || 'Elections',
        description,
        mediaType: mediaType || 'image',
        mediaUrl: mediaUrl ? (Array.isArray(mediaUrl) ? Buffer.from(JSON.stringify(mediaUrl), 'utf-8') : (typeof mediaUrl === 'string' ? Buffer.from(mediaUrl, 'utf-8') : mediaUrl)) : null,
        uploadDate: uploadDate ? new Date(uploadDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    if (images !== undefined || videos !== undefined) {
      await prisma.$queryRawUnsafe(
        `UPDATE elections SET images = ?, videos = ? WHERE id = ?`,
        typeof images === 'object' ? JSON.stringify(images) : (images || null),
        typeof videos === 'object' ? JSON.stringify(videos) : (videos || null),
        id
      );
    }

    res.json({ message: "Updated", result });
  } catch (err) {
    console.error("Error updating election:", err);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE ELECTION
exports.deleteElection = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.elections.delete({
      where: { id },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    const resultCategories = categories
      .map((r) => r.category)
      .filter((c) => c && c.trim() !== '')
      .map((c) => ({ key: c, label: c }));

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

    const result = categories
      .map((r) => r.category)
      .filter((c) => c && c.trim() !== '');

    res.json({ data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
