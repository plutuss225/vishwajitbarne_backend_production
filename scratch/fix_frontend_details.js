const fs = require('fs');

const targetFile = 'C:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_production\\src\\app\\updates\\[id]\\page.tsx';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Find where mappedUpdate starts
  const mappedStartRegex = /let mappedUpdate = null;\s*if\s*\(rawUpdate && rawUpdate\.id\)\s*\{[\s\S]*?mappedUpdate\s*=\s*\{[\s\S]*?\};\s*\}/;

  const newMapped = `let mappedUpdate = null;
  if (rawUpdate && rawUpdate.id) {
    let allVideos: string[] = [];
    let allImages: string[] = [];

    if (rawUpdate.video) {
       allVideos.push(decodeBufferToString(rawUpdate.video));
    }
    if (rawUpdate.videos && typeof rawUpdate.videos === 'string') {
       const vids = splitMediaUrls(rawUpdate.videos);
       allVideos = [...allVideos, ...vids];
    }

    if (rawUpdate.image) {
       allImages.push(decodeBufferToString(rawUpdate.image));
    }
    if (rawUpdate.images && typeof rawUpdate.images === 'string') {
       const imgs = splitMediaUrls(rawUpdate.images);
       allImages = [...allImages, ...imgs];
    }

    let fallbackMediaUrl = "";
    let fallbackMediaType = "image";
    if (allVideos.length > 0) {
       fallbackMediaUrl = allVideos[0];
       fallbackMediaType = "video";
    } else if (allImages.length > 0) {
       fallbackMediaUrl = allImages[0];
    }

    mappedUpdate = {
      title: rawUpdate.title,
      description: rawUpdate.description,
      uploadDate: rawUpdate.news_date,
      mediaType: fallbackMediaType,
      mediaUrl: fallbackMediaUrl,
      allVideos,
      allImages
    };
  }`;

  content = content.replace(mappedStartRegex, newMapped);

  // Find rendering area
  const renderStartRegex = /<main className="mx-auto max-w-4xl px-4 sm:px-6 mt-12">\s*<div className="relative rounded-3xl overflow-hidden[\s\S]*?<\/div>\s*<div className="max-w-2xl mx-auto">/;

  const newRender = `<main className="mx-auto max-w-4xl px-4 sm:px-6 mt-12">
        <div className="flex flex-col gap-8 mb-12">
          {update.allVideos && update.allVideos.length > 0 ? (
            update.allVideos.map((vid: string, idx: number) => (
              <div key={\`vid-\${idx}\`} className="relative rounded-3xl overflow-hidden w-full min-h-[320px] sm:min-h-[480px] bg-gray-50 flex items-center justify-center shadow-md border border-border p-2 sm:p-4">
                <video
                  src={getImageUrl(vid)}
                  controls
                  className="w-full h-full max-h-[70vh] object-contain rounded-2xl"
                />
              </div>
            ))
          ) : update.mediaType === "video" || update.mediaType === "video_link" ? (
             <div className="relative rounded-3xl overflow-hidden w-full min-h-[320px] sm:min-h-[480px] bg-gray-50 flex items-center justify-center shadow-md border border-border p-2 sm:p-4">
               <video
                 src={getImageUrl(update.mediaUrl)}
                 controls
                 className="w-full h-full max-h-[70vh] object-contain rounded-2xl"
               />
             </div>
          ) : update.mediaType === "youtube_link" ? (
             <div className="relative rounded-3xl overflow-hidden w-full min-h-[320px] sm:min-h-[480px] bg-gray-50 flex items-center justify-center shadow-md border border-border p-2 sm:p-4">
               <iframe
                 src={update.mediaUrl.replace("watch?v=", "embed/")}
                 className="w-full h-[380px] sm:h-[500px] rounded-2xl"
                 allowFullScreen
               />
             </div>
          ) : null}

          {update.allImages && update.allImages.length > 0 ? (
            update.allImages.map((img: string, idx: number) => (
              <div key={\`img-\${idx}\`} className="relative rounded-3xl overflow-hidden w-full h-[350px] sm:h-[550px] md:h-[650px] bg-gray-50 flex items-center justify-center shadow-md border border-border p-2 sm:p-4">
                <Image
                  src={getImageUrl(img)}
                  alt={\`\${update.title || "News Image"} - \${idx + 1}\`}
                  fill
                  className="object-contain rounded-2xl"
                  unoptimized
                />
              </div>
            ))
          ) : (update.mediaType === "image" && (!update.allImages || update.allImages.length === 0)) ? (
             <div className="relative rounded-3xl overflow-hidden w-full h-[350px] sm:h-[550px] md:h-[650px] bg-gray-50 flex items-center justify-center shadow-md border border-border p-2 sm:p-4">
               <Image
                 src={getImageUrl(update.mediaUrl)}
                 alt={update.title || "News Image"}
                 fill
                 className="object-contain rounded-2xl"
                 unoptimized
               />
             </div>
          ) : null}
        </div>

        <div className="max-w-2xl mx-auto">`;

  content = content.replace(renderStartRegex, newRender);

  fs.writeFileSync(targetFile, content);
  console.log("Successfully updated update details rendering in frontend!");
} catch (e) {
  console.error("Error modifying frontend details page:", e);
}
