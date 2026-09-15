const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

async function inspectAllTables() {
  const tables = ['blogs', 'news', 'development_work', 'event', 'images', 'elections'];
  
  for (const table of tables) {
    const rows = await prisma[table].findMany();
    console.log(`\n=== Table: ${table} (Total: ${rows.length}) ===`);
    rows.forEach(r => {
      Object.keys(r).forEach(k => {
        if (r[k] && (Buffer.isBuffer(r[k]) || typeof r[k] === 'string')) {
          const val = r[k].toString('utf8');
          if (val.includes('cloudinary.com') || val.includes('http://') || val.includes('https://')) {
            console.log(`Row ID: ${r.id}, Field: ${k}, Value: ${val.substring(0, 100)}`);
          }
        }
      });
    });
  }
}

inspectAllTables()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
