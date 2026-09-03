const prisma = require('../config/prisma');

async function downloadToBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    const base64Str = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Str}`;
    return Buffer.from(dataUri, 'utf-8');
  } catch (error) {
    console.error(`Error downloading ${url}:`, error.message);
    return null;
  }
}

async function downloadToJsonBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    const base64Str = buffer.toString('base64');
    return `data:${mimeType};base64,${base64Str}`;
  } catch (error) {
    return url;
  }
}

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

function isCloudinaryUrl(str) {
  return typeof str === 'string' && str.includes('res.cloudinary.com');
}

async function migrateBlogs() {
  console.log('Migrating blogs...');
  const records = await prisma.blogs.findMany();
  for (const record of records) {
    const imageStr = parsePrismaBuffer(record.image);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[blogs ID ${record.id}] Found Cloudinary URL, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) {
        await prisma.blogs.update({ where: { id: record.id }, data: { image: newBuffer } });
        console.log(`[blogs ID ${record.id}] Updated successfully.`);
      }
    }
  }
}

async function migrateDevelopmentWork() {
  console.log('Migrating development_work...');
  const records = await prisma.development_work.findMany();
  for (const record of records) {
    const updates = {};
    
    const imageStr = parsePrismaBuffer(record.image);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[development_work ID ${record.id}] Found Cloudinary URL in image, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) updates.image = newBuffer;
    }

    const videoStr = parsePrismaBuffer(record.video);
    if (isCloudinaryUrl(videoStr)) {
      console.log(`[development_work ID ${record.id}] Found Cloudinary URL in video, downloading...`);
      const newBuffer = await downloadToBuffer(videoStr);
      if (newBuffer) updates.video = newBuffer;
    }

    if (record.images && record.images.includes('res.cloudinary.com')) {
      try {
        const imagesArr = JSON.parse(record.images);
        const newImagesArr = await Promise.all(imagesArr.map(async (img) => {
          if (isCloudinaryUrl(img)) return await downloadToJsonBase64(img);
          return img;
        }));
        updates.images = JSON.stringify(newImagesArr);
        console.log(`[development_work ID ${record.id}] Updated images array.`);
      } catch(e) {}
    }

    if (record.videos && record.videos.includes('res.cloudinary.com')) {
      try {
        const videosArr = JSON.parse(record.videos);
        const newVideosArr = await Promise.all(videosArr.map(async (vid) => {
          if (isCloudinaryUrl(vid)) return await downloadToJsonBase64(vid);
          return vid;
        }));
        updates.videos = JSON.stringify(newVideosArr);
        console.log(`[development_work ID ${record.id}] Updated videos array.`);
      } catch(e) {}
    }

    if (Object.keys(updates).length > 0) {
      await prisma.development_work.update({ where: { id: record.id }, data: updates });
      console.log(`[development_work ID ${record.id}] Updated successfully.`);
    }
  }
}

async function migrateEvents() {
  console.log('Migrating events...');
  const records = await prisma.event.findMany();
  for (const record of records) {
    const updates = {};
    
    const imageStr = parsePrismaBuffer(record.main_image);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[event ID ${record.id}] Found Cloudinary URL in main_image, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) updates.main_image = newBuffer;
    }

    if (record.images && record.images.includes('res.cloudinary.com')) {
      try {
        const imagesArr = JSON.parse(record.images);
        const newImagesArr = await Promise.all(imagesArr.map(async (img) => {
          if (isCloudinaryUrl(img)) return await downloadToJsonBase64(img);
          return img;
        }));
        updates.images = JSON.stringify(newImagesArr);
        console.log(`[event ID ${record.id}] Updated images array.`);
      } catch(e) {}
    }

    if (Object.keys(updates).length > 0) {
      await prisma.event.update({ where: { id: record.id }, data: updates });
      console.log(`[event ID ${record.id}] Updated successfully.`);
    }
  }
}

async function migrateImages() {
  console.log('Migrating images table...');
  const records = await prisma.images.findMany();
  for (const record of records) {
    const imageStr = parsePrismaBuffer(record.image);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[images ID ${record.id}] Found Cloudinary URL, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) {
        await prisma.images.update({ where: { id: record.id }, data: { image: newBuffer } });
        console.log(`[images ID ${record.id}] Updated successfully.`);
      }
    }
  }
}

async function migrateNews() {
  console.log('Migrating news...');
  const records = await prisma.news.findMany();
  for (const record of records) {
    const updates = {};
    
    const imageStr = parsePrismaBuffer(record.image);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[news ID ${record.id}] Found Cloudinary URL in image, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) updates.image = newBuffer;
    }

    const videoStr = parsePrismaBuffer(record.video);
    if (isCloudinaryUrl(videoStr)) {
      console.log(`[news ID ${record.id}] Found Cloudinary URL in video, downloading...`);
      const newBuffer = await downloadToBuffer(videoStr);
      if (newBuffer) updates.video = newBuffer;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.news.update({ where: { id: record.id }, data: updates });
      console.log(`[news ID ${record.id}] Updated successfully.`);
    }
  }
}

async function migrateElections() {
  console.log('Migrating elections...');
  const records = await prisma.elections.findMany();
  for (const record of records) {
    const imageStr = parsePrismaBuffer(record.mediaUrl);
    if (isCloudinaryUrl(imageStr)) {
      console.log(`[elections ID ${record.id}] Found Cloudinary URL in mediaUrl, downloading...`);
      const newBuffer = await downloadToBuffer(imageStr);
      if (newBuffer) {
        await prisma.elections.update({ where: { id: record.id }, data: { mediaUrl: newBuffer } });
        console.log(`[elections ID ${record.id}] Updated successfully.`);
      }
    }
  }
}

async function runMigration() {
  try {
    await migrateBlogs();
    await migrateDevelopmentWork();
    await migrateEvents();
    await migrateImages();
    await migrateNews();
    await migrateElections();
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
