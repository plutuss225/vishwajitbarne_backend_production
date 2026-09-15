const fs = require('fs');
const path = require('path');

const frontendDir = 'c:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_production';

// 1. Update utils.ts
const utilsPath = path.join(frontendDir, 'src/lib/utils.ts');
let utilsContent = fs.readFileSync(utilsPath, 'utf8');

if (!utilsContent.includes('splitMediaUrls')) {
  utilsContent += `\nexport function splitMediaUrls(urlsStr?: string): string[] {
  if (!urlsStr) return [];
  const parts = urlsStr.split(',');
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.match(/^data:[^;]+;base64$/i) && i + 1 < parts.length) {
      result.push(part + ',' + parts[i + 1].trim());
      i++;
    } else if (part) {
      result.push(part);
    }
  }
  return result;
}\n`;
  fs.writeFileSync(utilsPath, utilsContent);
  console.log('Added splitMediaUrls to utils.ts');
} else {
  console.log('splitMediaUrls already exists in utils.ts');
}

// 2. Update works/page.tsx
const worksPagePath = path.join(frontendDir, 'src/app/works/page.tsx');
let worksPageContent = fs.readFileSync(worksPagePath, 'utf8');

worksPageContent = worksPageContent.replace(
  /import\s*{\s*decodeBufferToString\s*}\s*from\s*"@\/lib\/utils";/g,
  'import { decodeBufferToString, splitMediaUrls } from "@/lib/utils";'
);

worksPageContent = worksPageContent.replace(
  /mediaUrl\s*=\s*w\.images\.startsWith\('data:'\)\s*\?\s*w\.images\s*:\s*w\.images\.split\(\S+\)\[0\];/g,
  'mediaUrl = splitMediaUrls(w.images)[0] || "";'
);
worksPageContent = worksPageContent.replace(
  /mediaUrl\s*=\s*w\.images\.split\(\S+\)\[0\];/g,
  'mediaUrl = splitMediaUrls(w.images)[0] || "";'
);

worksPageContent = worksPageContent.replace(
  /videoUrl\s*=\s*w\.videos\.startsWith\('data:'\)\s*\?\s*w\.videos\s*:\s*w\.videos\.split\(\S+\)\[0\];/g,
  'videoUrl = splitMediaUrls(w.videos)[0] || "";'
);
worksPageContent = worksPageContent.replace(
  /videoUrl\s*=\s*w\.videos\.split\(\S+\)\[0\];/g,
  'videoUrl = splitMediaUrls(w.videos)[0] || "";'
);

fs.writeFileSync(worksPagePath, worksPageContent);
console.log('Updated works/page.tsx');

// 3. Update works/[id]/page.tsx
const worksIdPagePath = path.join(frontendDir, 'src/app/works/[id]/page.tsx');
let worksIdPageContent = fs.readFileSync(worksIdPagePath, 'utf8');

worksIdPageContent = worksIdPageContent.replace(
  /import\s*{\s*decodeBufferToString\s*}\s*from\s*"@\/lib\/utils";/g,
  'import { decodeBufferToString, splitMediaUrls } from "@/lib/utils";'
);

// Replace images parsing block
worksIdPageContent = worksIdPageContent.replace(
  /} else if \(rawWork\.images\.startsWith\('data:'\)\) {\s*imgArr = \[rawWork\.images\];\s*} else {\s*imgArr = rawWork\.images\.split\(','\)\.filter\(Boolean\);\s*}/g,
  `} else {
        imgArr = splitMediaUrls(rawWork.images).filter(Boolean);
      }`
);

// Replace videos parsing block
worksIdPageContent = worksIdPageContent.replace(
  /} else if \(rawWork\.videos\.startsWith\('data:'\)\) {\s*vidArr = \[rawWork\.videos\];\s*} else {\s*vidArr = rawWork\.videos\.split\(','\)\.filter\(Boolean\);\s*}/g,
  `} else {
        vidArr = splitMediaUrls(rawWork.videos).filter(Boolean);
      }`
);

fs.writeFileSync(worksIdPagePath, worksIdPageContent);
console.log('Updated works/[id]/page.tsx');
