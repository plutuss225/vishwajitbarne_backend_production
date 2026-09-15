const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = buffer.toString('base64');
  return `data:${contentType};base64,${base64}`;
}

async function migrateCloudinaryToBuffer() {
  const blogs = await prisma.blogs.findMany();
  let updatedCount = 0;

  for (const blog of blogs) {
    if (blog.image) {
      const imgStr = blog.image.toString('utf8');
      if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) {
        console.log(`Downloading image for Blog ID ${blog.id} from ${imgStr}...`);
        try {
          const dataUrl = await fetchImageAsDataUrl(imgStr);
          const imageBuffer = Buffer.from(dataUrl, 'utf-8');

          await prisma.blogs.update({
            where: { id: blog.id },
            data: { image: imageBuffer }
          });
          console.log(`Successfully updated Blog ID ${blog.id} with buffer data.`);
          updatedCount++;
        } catch (err) {
          console.error(`Failed to migrate image for Blog ID ${blog.id}:`, err.message);
        }
      }
    }
  }

  console.log(`\nMigration completed! Total blogs updated: ${updatedCount}`);
}

migrateCloudinaryToBuffer()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Migration script failed:', err);
    prisma.$disconnect();
  });
