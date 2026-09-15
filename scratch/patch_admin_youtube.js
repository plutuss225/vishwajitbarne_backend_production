const fs = require('fs');

const targetFile = 'C:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_adminpanel_production\\src\\routes\\admin.development.tsx';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // 1. Add youtube input state
  const stateSearch = 'const [search, setSearch] = useState("");';
  const stateReplace = 'const [search, setSearch] = useState("");\n  const [youtubeUrl, setYoutubeUrl] = useState("");';
  content = content.replace(stateSearch, stateReplace);

  // 2. Add youtube input UI under the file upload
  const fileUploadCode = `                <div className="flex items-center gap-3 mt-1">
                  <Input type="file" accept="image/*,video/*" multiple onChange={onFile} />
                </div>`;
  const fileUploadReplace = `                <div className="flex items-center gap-3 mt-1">
                  <Input type="file" accept="image/*,video/*" multiple onChange={onFile} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    placeholder="Or paste YouTube URL here" 
                    value={youtubeUrl} 
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <Button 
                    type="button" 
                    onClick={() => {
                      if (youtubeUrl.trim()) {
                        const newUrl = youtubeUrl.trim();
                        setForm(prev => ({
                          ...prev,
                          image: prev.image ? prev.image + ',' + newUrl : newUrl
                        }));
                        setYoutubeUrl("");
                      }
                    }}
                  >
                    Add URL
                  </Button>
                </div>`;
  content = content.replace(fileUploadCode, fileUploadReplace);

  // 3. Fix the display in the modal to handle youtube
  // We need to change the isVideo logic and rendering.
  const oldModalRender = `                    return sortedUrls.map((url, idx) => {
                      const parsedUrl = parseMediaUrl(url);
                      const isVideo = parsedUrl.match(/\\.(mp4|webm|ogg|mov)$/i) || parsedUrl.startsWith("data:video") || parsedUrl.includes("video");
                      return (
                        <div key={idx} className="relative">
                          {isVideo ? (
                            <video src={getImageUrl(parsedUrl)} className="h-32 w-32 object-cover rounded-md" controls />
                          ) : (
                            <img src={getImageUrl(url)} className="h-32 w-32 object-cover rounded-md" alt="" />
                          )}`;
  
  const newModalRender = `                    return sortedUrls.map((url, idx) => {
                      const parsedUrl = parseMediaUrl(url);
                      const isYoutube = parsedUrl.includes('youtube.com') || parsedUrl.includes('youtu.be');
                      const isVideo = parsedUrl.match(/\\.(mp4|webm|ogg|mov)$/i) || parsedUrl.startsWith("data:video") || parsedUrl.includes("video");
                      return (
                        <div key={idx} className="relative">
                          {isYoutube ? (
                            <iframe src={parsedUrl.replace("watch?v=", "embed/")} className="h-32 w-32 object-cover rounded-md" />
                          ) : isVideo ? (
                            <video src={getImageUrl(parsedUrl)} className="h-32 w-32 object-cover rounded-md" controls />
                          ) : (
                            <img src={getImageUrl(url)} className="h-32 w-32 object-cover rounded-md" alt="" />
                          )}`;
  content = content.replace(oldModalRender, newModalRender);

  // 4. Fix the sorting logic so youtube links are treated as videos
  const oldSortCode = `                      const isVideoA = urlA.match(/\\.(mp4|webm|ogg|mov)$/i) || urlA.startsWith("data:video") || urlA.includes("video");
                      const isVideoB = urlB.match(/\\.(mp4|webm|ogg|mov)$/i) || urlB.startsWith("data:video") || urlB.includes("video");`;
  
  const newSortCode = `                      const isVideoA = urlA.match(/\\.(mp4|webm|ogg|mov)$/i) || urlA.startsWith("data:video") || urlA.includes("video") || urlA.includes("youtube.com") || urlA.includes("youtu.be");
                      const isVideoB = urlB.match(/\\.(mp4|webm|ogg|mov)$/i) || urlB.startsWith("data:video") || urlB.includes("video") || urlB.includes("youtube.com") || urlB.includes("youtu.be");`;
  content = content.replace(oldSortCode, newSortCode);

  // 5. Fix the preview in the list view (Card)
  const oldListPreview = `              {firstMedia && (
                firstMedia.match(/\\.(mp4|webm|ogg|mov)$/i) || firstMedia.startsWith("data:video") || firstMedia.includes("video") ? (
                  <video src={getImageUrl(firstMedia)} className="h-40 w-full object-cover" />
                ) : (
                  <img src={getImageUrl(firstMedia)} alt={n.title} className="h-40 w-full object-cover" />
                )
              )}`;
  const newListPreview = `              {firstMedia && (
                (firstMedia.includes('youtube.com') || firstMedia.includes('youtu.be')) ? (
                  <iframe src={firstMedia.replace("watch?v=", "embed/")} className="h-40 w-full object-cover" />
                ) : firstMedia.match(/\\.(mp4|webm|ogg|mov)$/i) || firstMedia.startsWith("data:video") || firstMedia.includes("video") ? (
                  <video src={getImageUrl(firstMedia)} className="h-40 w-full object-cover" />
                ) : (
                  <img src={getImageUrl(firstMedia)} alt={n.title} className="h-40 w-full object-cover" />
                )
              )}`;
  content = content.replace(oldListPreview, newListPreview);
  
  // 6. Backend mapping in mutations:
  // In createMutation and updateMutation, we need to ensure youtube urls go to videoList so they are saved in videos.
  // Wait, if it goes to imageList it still gets saved in images, and the frontend works/[id]/page.tsx parses it from both.
  // BUT the frontend works list Works.tsx might only check videos first.
  // Let's modify the mutation so YouTube links go to videoList!
  const oldMutationCode = `          if (parsed.match(/\\.(mp4|webm|ogg|mov)$/i) || parsed.includes("video")) {`;
  const newMutationCode = `          if (parsed.match(/\\.(mp4|webm|ogg|mov)$/i) || parsed.includes("video") || parsed.includes("youtube.com") || parsed.includes("youtu.be")) {`;
  // Replace all instances of this
  content = content.split(oldMutationCode).join(newMutationCode);

  fs.writeFileSync(targetFile, content);
  console.log("Successfully patched admin.development.tsx for YouTube support!");
} catch (e) {
  console.error("Error:", e);
}
