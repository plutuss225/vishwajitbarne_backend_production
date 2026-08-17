const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

// LOGIN (simple)
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.admins.findFirst({
      where: { username },
    });

    if (user) {
      // Check if stored password is a bcrypt hash
      const isBcrypt = user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$"));
      let isMatch = false;

      try {
        if (isBcrypt) {
          isMatch = await bcrypt.compare(password, user.password);
        } else {
          isMatch = (password === user.password);
        }
      } catch (compareErr) {
        return res.status(500).json({ message: "Error verifying password" });
      }

      if (isMatch) {
        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, username: user.username },
          process.env.JWT_SECRET || "fallback_secret",
          { expiresIn: "1d" }
        );
        res.json({ message: "Login success", user: { id: user.id, username: user.username }, token });
      } else {
        res.status(401).json({ message: "Invalid login" });
      }
    } else {
      res.status(401).json({ message: "Invalid login" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

// CREATE ADMIN
exports.createAdmin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await prisma.admins.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
    res.json({ message: "Admin created successfully", adminId: result.id });
  } catch (err) {
    return res.status(500).json({ message: "Error creating admin", error: err.message });
  }
};

// GET ALL ADMINS
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await prisma.admins.findMany({
      select: {
        id: true,
        username: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
    res.json(admins);
  } catch (err) {
    res.status(500).json(err);
  }
};

// GET STATS
exports.getStats = async (req, res) => {
  try {
    const [newsCount, blogsCount, adminsCount, imagesCount] = await Promise.all([
      prisma.news.count(),
      prisma.blogs.count(),
      prisma.admins.count(),
      prisma.images.count().catch(() => 0),
    ]);

    res.json({
      news: newsCount,
      blogs: blogsCount,
      admins: adminsCount,
      images: imagesCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET LATEST DATA (latest 5 news, blogs, admins) – with language translation
exports.getLatestData = async (req, res) => {
  try {
    const [latestNews, latestBlogs, latestAdmins] = await Promise.all([
      prisma.news.findMany({
        select: { id: true, category: true, title: true, description: true, image: true, created_at: true, news_date: true },
        orderBy: { id: 'desc' },
        take: 5,
      }),
      prisma.blogs.findMany({
        select: { id: true, title: true, slug: true, image: true, author: true, status: true, published_at: true, created_at: true, updated_at: true },
        orderBy: { id: 'desc' },
        take: 5,
      }),
      prisma.admins.findMany({
        select: { id: true, username: true },
        orderBy: { id: 'desc' },
        take: 5,
      }),
    ]);

    // Need to convert image bytes to string or what it used to be if needed
    // But original query just returned buffer. So let's keep it as is.
    const mapWithToString = (arr) => arr; // bytes will be serialized by express JSON as buffer or base64. MySQL raw returned buffer anyway.
    
    const targetLang = getTargetLanguage(req);

    // Translate news fields if a target language was requested
    const translatedNews = targetLang
      ? await Promise.all(
          latestNews.map(async (item) => {
            try {
              const [title, category, description] = await Promise.all([
                translateText(item.title, targetLang),
                translateText(item.category, targetLang),
                translateText(item.description, targetLang)
              ]);
              return { ...item, title, category, description };
            } catch {
              return item;
            }
          })
        )
      : latestNews;

    // Translate blog title field if a target language was requested
    const translatedBlogs = targetLang
      ? await Promise.all(
          latestBlogs.map(async (item) => {
            try {
              const title = await translateText(item.title, targetLang);
              return { ...item, title };
            } catch {
              return item;
            }
          })
        )
      : latestBlogs;

    res.json({
      news: translatedNews,
      blogs: translatedBlogs,
      admins: latestAdmins
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET ALL NEWS CATEGORIES
exports.getAllNewsCategories = async (req, res) => {
  try {
    const categories = await prisma.news.findMany({
      select: {
        category: true,
      },
      distinct: ['category'],
      where: {
        category: {
          not: null,
          not: '',
        },
      },
      orderBy: {
        category: 'asc',
      },
    });
    
    // MySQL query had `TRIM(category) != ''` which is harder in basic prisma, so just map it.
    const result = categories
      .map(row => row.category)
      .filter(category => category && category.trim() !== '');

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
