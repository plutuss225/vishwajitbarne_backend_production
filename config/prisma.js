const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log(`Database connected successfully to host: ${url.hostname}, database: ${url.pathname.replace('/', '')}`);
    } catch (e) {
      console.log('Database connected successfully');
    }
  })
  .catch((err) => console.error('Database connection failed', err));

module.exports = prisma;
