const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");
const { deleteImageFromCloudinary } = require("../utils/cloudinary");

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

// Helper to translate blog_points JSON
async function translateBlogPoints(points, targetLang) {
  if (!points) return points;
  try {
    const parsed = typeof points === "string" ? JSON.parse(points) : points;
    if (Array.isArray(parsed)) {
      if (parsed.every((x) => typeof x === "string")) {
        return await Promise.all(parsed.map((p) => translateText(p, targetLang)));
      }
      return await Promise.all(
        parsed.map(async (item) => {
          if (typeof item === "object" && item !== null) {
            const newItem = { ...item };
            for (const key of Object.keys(newItem)) {
              if (typeof newItem[key] === "string") {
                newItem[key] = await translateText(newItem[key], targetLang);
              }
            }
            return newItem;
          }
          return item;
        })
      );
    } else if (typeof parsed === "object" && parsed !== null) {
      const newObj = { ...parsed };
      for (const key of Object.keys(newObj)) {
        if (typeof newObj[key] === "string") {
          newObj[key] = await translateText(newObj[key], targetLang);
        }
      }
      return newObj;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to translate blog_points:", err.message);
    return points;
  }
}

// Helper to translate a single blog item
async function translateBlogItem(item, targetLang) {
  if (!targetLang) {
    // Even if no translation is needed, parse blog_points if it's a string
    if (item.blog_points && typeof item.blog_points === "string") {
      try {
        item.blog_points = JSON.parse(item.blog_points);
      } catch (e) {}
    }
    if (item.image && (Buffer.isBuffer(item.image) || item.image instanceof Uint8Array || typeof item.image === 'object')) {
      item.image = parsePrismaBuffer(item.image);
    }
    return item;
  }
  try {
    const [title, content, meta_title, meta_description, blog_points] = await Promise.all([
      translateText(item.title, targetLang),
      translateText(item.content, targetLang),
      translateText(item.meta_title, targetLang),
      translateText(item.meta_description, targetLang),
      translateBlogPoints(item.blog_points, targetLang)
    ]);
    
    let finalImage = item.image;
    if (finalImage && (Buffer.isBuffer(finalImage) || finalImage instanceof Uint8Array || typeof finalImage === 'object')) {
      finalImage = parsePrismaBuffer(finalImage);
    }

    return {
      ...item,
      title,
      content,
      meta_title,
      meta_description,
      blog_points,
      image: finalImage
    };
  } catch (err) {
    console.error("Error in translateBlogItem:", err.message);
    return item;
  }
}

// Generate Slug helper
function generateSlug(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// GET ALL BLOGS
exports.getAllBlogs = async (req, res) => {
  const { status, search, date, startDate, endDate } = req.query;
  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { content: { contains: search } },
    ];
  }

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    where.OR = [
      { published_at: { gte: startOfDay, lte: endOfDay } },
      { AND: [ { published_at: null }, { created_at: { gte: startOfDay, lte: endOfDay } } ] }
    ];
  } else {
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        let endParam = endDate;
        if (endDate.length === 10) endParam = `${endDate} 23:59:59`;
        dateFilter.lte = new Date(endParam);
      }
      
      where.OR = [
        { published_at: dateFilter },
        { AND: [ { published_at: null }, { created_at: dateFilter } ] }
      ];
    }
  }

  try {
    const result = await prisma.blogs.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 20,
    });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      const translatedResult = await Promise.all(
        result.map((item) => translateBlogItem(item, targetLang))
      );
      return res.json(translatedResult);
    } else {
      const parsedResult = result.map((item) => {
        if (item.blog_points && typeof item.blog_points === "string") {
          try {
            item.blog_points = JSON.parse(item.blog_points);
          } catch (e) {}
        }
        if (item.image && (Buffer.isBuffer(item.image) || item.image instanceof Uint8Array || typeof item.image === 'object')) {
          item.image = parsePrismaBuffer(item.image);
        }
        return item;
      });
      return res.json(parsedResult);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET BLOG BY ID OR SLUG
exports.getBlogByIdOrSlug = async (req, res) => {
  const { idOrSlug } = req.params;
  const where = {};

  if (!isNaN(idOrSlug)) {
    where.OR = [
      { id: parseInt(idOrSlug) },
      { slug: idOrSlug }
    ];
  } else {
    where.slug = idOrSlug;
  }

  try {
    const result = await prisma.blogs.findFirst({ where });
    if (!result) return res.status(404).json({ message: "Blog not found" });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      const translatedItem = await translateBlogItem(result, targetLang);
      return res.json(translatedItem);
    } else {
      if (result.blog_points && typeof result.blog_points === "string") {
        try {
          result.blog_points = JSON.parse(result.blog_points);
        } catch (e) {}
      }
      if (result.image && (Buffer.isBuffer(result.image) || result.image instanceof Uint8Array || typeof result.image === 'object')) {
        result.image = parsePrismaBuffer(result.image);
      }
      return res.json(result);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// CREATE BLOG
exports.createBlog = async (req, res) => {
  const {
    title,
    slug,
    image,
    content,
    meta_title,
    meta_description,
    blog_points,
    author,
    status
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required fields." });
  }

  const finalSlug = slug ? generateSlug(slug) : generateSlug(title);
  const finalBlogPoints = blog_points ? JSON.stringify(blog_points) : null;
  const finalStatus = status || "draft";
  const publishedAt = finalStatus === "published" ? new Date() : null;

  try {
    const result = await prisma.blogs.create({
      data: {
        title,
        slug: finalSlug,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : (image || null),
        content,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        blog_points: finalBlogPoints,
        author: author || "Admin",
        status: finalStatus,
        published_at: publishedAt
      },
    });
    res.json({ message: "Blog created successfully", blogId: result.id });
  } catch (err) {
    if (err.code === 'P2002') { // Unique constraint failed
      return res.status(400).json({ error: "A blog with this slug or title already exists." });
    }
    return res.status(500).json({ error: err.message });
  }
};

// UPDATE BLOG
exports.updateBlog = async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    title,
    slug,
    image,
    content,
    meta_title,
    meta_description,
    blog_points,
    author,
    status,
    published_at
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required fields." });
  }

  const finalSlug = slug ? generateSlug(slug) : generateSlug(title);
  const finalBlogPoints = blog_points ? JSON.stringify(blog_points) : null;

  try {
    const currentBlog = await prisma.blogs.findUnique({ where: { id } });
    if (!currentBlog) return res.status(404).json({ error: "Blog not found" });

    let finalPublishedAt = published_at ? new Date(published_at) : currentBlog.published_at;

    if (status === "published" && !finalPublishedAt) {
      finalPublishedAt = new Date();
    } else if (status === "draft") {
      finalPublishedAt = null;
    }

    await prisma.blogs.update({
      where: { id },
      data: {
        title,
        slug: finalSlug,
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : (image || null),
        content,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        blog_points: finalBlogPoints,
        author: author || "Admin",
        status: status || "draft",
        published_at: finalPublishedAt,
      }
    });

    res.json({ message: "Blog updated successfully" });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: "A blog with this slug or title already exists." });
    }
    return res.status(500).json({ error: err.message });
  }
};

// DELETE BLOG
exports.deleteBlog = async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const selectResult = await prisma.blogs.findUnique({
      where: { id },
      select: { image: true }
    });

    if (!selectResult) return res.status(404).json({ error: "Blog not found" });

    await prisma.blogs.delete({ where: { id } });

    if (selectResult.image) {
      await deleteImageFromCloudinary(selectResult.image.toString('utf-8'));
    }

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET BLOG AUTHORS as categories (distinct non-null authors from published blogs)
exports.getBlogAuthors = async (req, res) => {
  try {
    const authorsResult = await prisma.blogs.findMany({
      select: { author: true },
      distinct: ['author'],
      where: {
        author: { not: null, not: '' },
        status: 'published'
      },
      orderBy: { author: 'asc' },
    });

    const authors = authorsResult
      .map((r) => r.author)
      .filter((a) => a && a.trim() !== '');

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translated = await Promise.all(
          authors.map((a) => translateText(a, targetLang))
        );
        return res.json({ categories: translated });
      } catch (transErr) {
        console.error("Error translating blog authors:", transErr.message);
      }
    }

    res.json({ categories: authors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET TOP 4 BLOGS (latest published)
exports.getTopBlogs = async (req, res) => {
  try {
    const result = await prisma.blogs.findMany({
      where: { status: 'published' },
      orderBy: { id: 'desc' },
      take: 4,
      select: {
        id: true, title: true, slug: true, image: true, author: true, meta_description: true, published_at: true, created_at: true
      }
    });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translated = await Promise.all(
          result.map((item) => translateBlogItem(item, targetLang))
        );
        return res.json(translated);
      } catch (transErr) {
        console.error("Error translating top blogs:", transErr.message);
      }
    }

    const parsedResult = result.map((item) => {
      if (item.image && (Buffer.isBuffer(item.image) || item.image instanceof Uint8Array || typeof item.image === 'object')) {
        item.image = parsePrismaBuffer(item.image);
      }
      return item;
    });
    res.json(parsedResult);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET ALL PUBLIC BLOGS
exports.getPublicBlogs = async (req, res) => {
  const { search } = req.query;
  const where = { status: 'published' };

  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search } },
      { content: { contains: search } },
      { meta_description: { contains: search } }
    ];
  }

  try {
    const result = await prisma.blogs.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 20,
      select: {
        id: true, title: true, slug: true, image: true, author: true, meta_description: true, published_at: true, created_at: true
      }
    });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translated = await Promise.all(
          result.map((item) => translateBlogItem(item, targetLang))
        );
        return res.json(translated);
      } catch (transErr) {
        console.error("Error translating public blogs:", transErr.message);
      }
    }

    const parsedResult = result.map((item) => {
      if (item.image && (Buffer.isBuffer(item.image) || item.image instanceof Uint8Array || typeof item.image === 'object')) {
        item.image = parsePrismaBuffer(item.image);
      }
      return item;
    });
    res.json(parsedResult);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
