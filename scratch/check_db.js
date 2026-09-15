const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

async function test() {
  const news = await prisma.news.findMany({ select: { id: true, title: true, image: true, video: true } });
  console.log('News count:', news.length);
  const withImages = news.filter(n => n.image);
  console.log('News with image count:', withImages.length);
  withImages.slice(0, 10).forEach(n => {
    const str = n.image ? n.image.toString('utf8') : '';
    console.log('ID:', n.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });

  const devWork = await prisma.development_work.findMany({ select: { id: true, image: true } });
  console.log('Dev work count:', devWork.length);
  devWork.slice(0, 5).forEach(d => {
    const str = d.image ? d.image.toString('utf8') : '';
    console.log('DevWork ID:', d.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });

  const images = await prisma.images.findMany({ select: { id: true, image: true } });
  console.log('Images table count:', images.length);
  images.slice(0, 5).forEach(img => {
    const str = img.image ? img.image.toString('utf8') : '';
    console.log('Images ID:', img.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });

  const blogs = await prisma.blogs.findMany({ select: { id: true, image: true } });
  console.log('Blogs table count:', blogs.length);
  blogs.slice(0, 5).forEach(b => {
    const str = b.image ? b.image.toString('utf8') : '';
    console.log('Blogs ID:', b.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });

  const events = await prisma.event.findMany({ select: { id: true, main_image: true } });
  console.log('Events table count:', events.length);
  events.slice(0, 5).forEach(e => {
    const str = e.main_image ? e.main_image.toString('utf8') : '';
    console.log('Events ID:', e.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });

  const elections = await prisma.elections.findMany({ select: { id: true, mediaUrl: true } });
  console.log('Elections table count:', elections.length);
  elections.slice(0, 5).forEach(el => {
    const str = el.mediaUrl ? el.mediaUrl.toString('utf8') : '';
    console.log('Elections ID:', el.id, 'HTTP:', str.startsWith('http'), 'Prefix:', str.substring(0, 60));
  });
}

test()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
