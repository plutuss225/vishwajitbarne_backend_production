const path = require('path');
const prisma = require(path.join(__dirname, '../config/prisma'));

const dictionary = {
  "thergaon": "थेरगाव",
  "moshi": "मोशी",
  "kalewadi": "काळेवाडी",
  "pimpri chinchwad": "पिंपरी चिंचवड",
  "ganesh nagar": "गणेश नगर",
  "thane": "ठाणे",
  "maval": "मावळ"
};

async function updatePlacesToMarathi() {
  console.log('Fetching development_work records...');
  const works = await prisma.development_work.findMany({
    select: { id: true, place: true }
  });

  let updatedCount = 0;

  for (const work of works) {
    if (work.place) {
      // Check if it's already in Marathi (contains Devanagari characters)
      const hasDevanagari = /[\u0900-\u097F]/.test(work.place);
      
      if (!hasDevanagari) {
        const lowerPlace = work.place.trim().toLowerCase();
        let translatedPlace = dictionary[lowerPlace];
        
        if (translatedPlace) {
          try {
            await prisma.development_work.update({
              where: { id: work.id },
              data: { place: translatedPlace }
            });
            console.log(`Successfully updated ID ${work.id} place from "${work.place}" to "${translatedPlace}"`);
            updatedCount++;
          } catch (err) {
            console.error(`Failed to update place for ID ${work.id}:`, err.message);
          }
        } else {
          console.log(`No manual translation found for ID ${work.id}: "${work.place}"`);
        }
      } else {
        console.log(`Place for ID ${work.id} is already in Marathi: "${work.place}"`);
      }
    }
  }

  console.log(`\nManual translation completed! Total places updated: ${updatedCount}`);
}

updatePlacesToMarathi()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Translation script failed:', err);
    prisma.$disconnect();
  });
