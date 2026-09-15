const fs = require('fs');
const path = require('path');

const targetFile = 'C:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_backend_production\\controllers\\developmentWorkController.js';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Replace getTopDevelopmentWorkByCategory
  const oldTop = /exports\.getTopDevelopmentWorkByCategory\s*=\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{[\s\S]*?res\.json\(finalResult\);\s*\n\s*\}\s*catch\s*\(err\)\s*\{\s*\n\s*return\s*res\.status\(500\)\.json\(\{\s*error:\s*err\.message\s*\}\);\s*\n\s*\}\s*\n\};/;

  const newTop = `exports.getTopDevelopmentWorkByCategory = async (req, res) => {
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
        const mediaThumbnails = await prisma.$queryRawUnsafe(\`
          SELECT id, image, video,
                 SUBSTRING_INDEX(images, ',data:', 1) as images,
                 SUBSTRING_INDEX(videos, ',data:', 1) as videos
          FROM development_work
          WHERE id IN (\${ids.join(',')})
        \`);
  
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
};`;

  // Replace getLatestDevelopmentWorkByPlaces
  const oldPlaces = /exports\.getLatestDevelopmentWorkByPlaces\s*=\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{[\s\S]*?res\.json\(finalResult\);\s*\n\s*\}\s*catch\s*\(err\)\s*\{\s*\n\s*return\s*res\.status\(500\)\.json\(\{\s*error:\s*err\.message\s*\}\);\s*\n\s*\}\s*\n\};/;

  const newPlaces = `exports.getLatestDevelopmentWorkByPlaces = async (req, res) => {
    const places = [
      { marathi: 'थेरगाव', db: 'थेरगाव' },
      { marathi: 'वाकड', db: 'वाकड' },
      { marathi: 'काळेवाडी', db: 'Kalewadi' },
      { marathi: 'पिंपरी चिंचवड', db: 'Pimpri Chinchwad' },
      { marathi: 'गणेश नगर', db: 'Ganesh Nagar' },
      { marathi: 'मोशी', db: 'Moshi' },
      { marathi: 'मावळ', db: 'Maval' }
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
      let results = [];
      for (const place of places) {
        const work = await prisma.development_work.findFirst({
          where: { place: { contains: place.db } },
          orderBy: [{ news_date: 'desc' }, { id: 'desc' }],
          select: selectFields
        });
        if (work) results.push({ ...work, searchedPlace: place.marathi });
      }

      if (results.length > 0) {
        const ids = results.map(r => r.id);
        const mediaThumbnails = await prisma.$queryRawUnsafe(\`
          SELECT id, image, video,
                 SUBSTRING_INDEX(images, ',data:', 1) as images,
                 SUBSTRING_INDEX(videos, ',data:', 1) as videos
          FROM development_work
          WHERE id IN (\${ids.join(',')})
        \`);
  
        const mediaMap = {};
        for (const m of mediaThumbnails) {
          mediaMap[m.id] = m;
        }
  
        results = results.map(item => ({
          ...item,
          image: mediaMap[item.id]?.image,
          video: mediaMap[item.id]?.video,
          images: getFirstMedia(mediaMap[item.id]?.images),
          videos: getFirstMedia(mediaMap[item.id]?.videos)
        }));
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
};`;

  if (oldTop.test(content) && oldPlaces.test(content)) {
    content = content.replace(oldTop, newTop);
    content = content.replace(oldPlaces, newPlaces);
    fs.writeFileSync(targetFile, content);
    console.log("Successfully optimized endpoints in developmentWorkController.js!");
  } else {
    console.log("Could not find the target code blocks in developmentWorkController.js");
  }
} catch (e) {
  console.error("Error modifying file:", e);
}
