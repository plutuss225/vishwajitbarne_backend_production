const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

async function checkDb() {
  const works = await prisma.development_work.findMany({
    where: {
      OR: [
        { images: { contains: 'cloudinary' } },
        { videos: { contains: 'cloudinary' } }
      ]
    },
    select: { id: true, images: true, videos: true }
  });
  console.log('Found ' + works.length + ' items still containing cloudinary in images/videos.');
  if (works.length > 0) {
    console.log(works[0]);
  }
}

checkDb()
  .then(() => prisma.$disconnect())
  .catch(console.error);
