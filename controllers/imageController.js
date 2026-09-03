const prisma = require("../config/prisma");
const { translateText, getTargetLanguage } = require("../utils/translator");

async function translateImageItem(item, targetLang) {
  if (!targetLang || !item.title) return item;
  try {
    const translatedTitle = await translateText(item.title, targetLang);
    return {
      ...item,
      title: translatedTitle
    };
  } catch (err) {
    console.error("Error in translateImageItem:", err.message);
    return item;
  }
}

// GET ALL IMAGES
exports.getAllImages = async (req, res) => {
  try {
    const result = await prisma.images.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedResult = await Promise.all(
          result.map(item => translateImageItem(item, targetLang))
        );
        return res.json(translatedResult);
      } catch (transErr) {
        console.error("Error in parallel translation:", transErr.message);
      }
    }
    
    res.json(result);
  } catch (err) {
    return res.status(500).json(err);
  }
};

// GET BY ID
exports.getImageById = async (req, res) => {
  try {
    const result = await prisma.images.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!result) return res.status(404).json({ message: "Image not found" });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedItem = await translateImageItem(result, targetLang);
        return res.json([translatedItem]);
      } catch (transErr) {
        console.error("Error in single translation:", transErr.message);
      }
    }

    res.json([result]); // kept as array for backward compatibility
  } catch (err) {
    return res.status(500).json(err);
  }
};

// INSERT IMAGE
exports.createImage = async (req, res) => {
  const { image, isHeroSelectionImage, title } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Image path/URL is required" });
  }

  try {
    const result = await prisma.images.create({
      data: {
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        isHeroSelectionImage: isHeroSelectionImage ? true : false,
        title: title || null,
      },
    });

    res.json({ message: "Image added successfully", result });
  } catch (err) {
    return res.status(500).json(err);
  }
};

// UPDATE IMAGE
exports.updateImage = async (req, res) => {
  const { image, isHeroSelectionImage, title } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Image path/URL is required" });
  }

  try {
    await prisma.images.update({
      where: { id: parseInt(req.params.id) },
      data: {
        image: typeof image === 'string' ? Buffer.from(image, 'utf-8') : image,
        isHeroSelectionImage: isHeroSelectionImage ? true : false,
        title: title || null,
      },
    });

    res.json({ message: "Image updated successfully" });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: "Image not found" });
    }
    return res.status(500).json(err);
  }
};

// DELETE IMAGE
exports.deleteImage = async (req, res) => {
  const imageId = parseInt(req.params.id);

  try {
    const selectResult = await prisma.images.findUnique({
      where: { id: imageId },
      select: { image: true },
    });

    if (!selectResult) return res.status(404).json({ message: "Image not found" });

    await prisma.images.delete({
      where: { id: imageId },
    });

    // Cloudinary logic removed

    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
};

// GET HERO IMAGES (isHeroSelectionImage = true, latest first)
exports.getHeroImages = async (req, res) => {
  try {
    const result = await prisma.images.findMany({
      where: { isHeroSelectionImage: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const targetLang = getTargetLanguage(req);
    if (targetLang) {
      try {
        const translatedResult = await Promise.all(
          result.map((item) => translateImageItem(item, targetLang))
        );
        return res.json(translatedResult);
      } catch (transErr) {
        console.error("Error translating hero images:", transErr.message);
      }
    }

    res.json(result);
  } catch (err) {
    return res.status(500).json(err);
  }
};
