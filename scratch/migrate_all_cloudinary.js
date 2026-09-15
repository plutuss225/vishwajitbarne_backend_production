const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

async function fetchUrlAsDataUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`HTTP warning for ${url}: ${response.status} ${response.statusText}`);
      return url; // keep original URL if download fails
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || (url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
    return url;
  }
}

async function migrateAllCloudinaryData() {
  console.log('=== 1. Migrating Blogs Table ===');
  const blogs = await prisma.blogs.findMany();
  for (const blog of blogs) {
    if (blog.image) {
      const imgStr = blog.image.toString('utf8');
      if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) {
        console.log(`[Blogs] Downloading image for Blog ID ${blog.id}...`);
        const dataUrl = await fetchUrlAsDataUrl(imgStr);
        if (dataUrl.startsWith('data:')) {
          await prisma.blogs.update({
            where: { id: blog.id },
            data: { image: Buffer.from(dataUrl, 'utf-8') }
          });
          console.log(`[Blogs] Saved Buffer for Blog ID ${blog.id}`);
        }
      }
    }
  }

  console.log('\n=== 2. Migrating Development Work Table ===');
  const devWorks = await prisma.development_work.findMany();
  for (const item of devWorks) {
    let updated = false;
    let newImagesStr = item.images;
    let newVideosStr = item.videos;

    // Process images column (comma separated URLs)
    if (item.images && item.images.includes('http')) {
      const urls = item.images.split(',').map(s => s.trim()).filter(Boolean);
      const convertedUrls = [];
      for (const u of urls) {
        if (u.startsWith('http://') || u.startsWith('https://')) {
          console.log(`[DevWork ID ${item.id}] Downloading image: ${u.substring(0, 60)}...`);
          const dataUrl = await fetchUrlAsDataUrl(u);
          convertedUrls.push(dataUrl);
        } else {
          convertedUrls.push(u);
        }
      }
      newImagesStr = convertedUrls.join(',');
      updated = true;
    }

    // Process videos column (comma separated URLs)
    if (item.videos && item.videos.includes('http')) {
      const urls = item.videos.split(',').map(s => s.trim()).filter(Boolean);
      const convertedUrls = [];
      for (const u of urls) {
        if (u.startsWith('http://') || u.startsWith('https://')) {
          console.log(`[DevWork ID ${item.id}] Downloading video: ${u.substring(0, 60)}...`);
          const dataUrl = await fetchUrlAsDataUrl(u);
          convertedUrls.push(dataUrl);
        } else {
          convertedUrls.push(u);
        }
      }
      newVideosStr = convertedUrls.join(',');
      updated = true;
    }

    // Process single image column if buffer contains HTTP
    let newSingleImage = item.image;
    if (item.image) {
      const str = item.image.toString('utf8');
      if (str.startsWith('http://') || str.startsWith('https://')) {
        console.log(`[DevWork ID ${item.id}] Downloading main image buffer...`);
        const dataUrl = await fetchUrlAsDataUrl(str);
        if (dataUrl.startsWith('data:')) {
          newSingleImage = Buffer.from(dataUrl, 'utf-8');
          updated = true;
        }
      }
    }

    // Process single video column if buffer contains HTTP
    let newSingleVideo = item.video;
    if (item.video) {
      const str = item.video.toString('utf8');
      if (str.startsWith('http://') || str.startsWith('https://')) {
        console.log(`[DevWork ID ${item.id}] Downloading main video buffer...`);
        const dataUrl = await fetchUrlAsDataUrl(str);
        if (dataUrl.startsWith('data:')) {
          newSingleVideo = Buffer.from(dataUrl, 'utf-8');
          updated = true;
        }
      }
    }

    if (updated) {
      await prisma.development_work.update({
        where: { id: item.id },
        data: {
          images: newImagesStr,
          videos: newVideosStr,
          image: newSingleImage,
          video: newSingleVideo
        }
      });
      console.log(`[DevWork] Successfully updated ID ${item.id}`);
    }
  }

  console.log('\n=== All Migrations Complete ===');
}

migrateAllCloudinaryData()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Migration failed:', err);
    prisma.$disconnect();
  });
