const fs = require('fs');
const path = require('path');

const frontendDir = 'c:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_production';

// Function to update a list page (works/page.tsx, updates/page.tsx, etc.)
function patchListPage(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    /import\s*{\s*decodeBufferToString\s*}\s*from\s*"@\/lib\/utils";/g,
    'import { decodeBufferToString, splitMediaUrls } from "@/lib/utils";'
  );

  content = content.replace(
    /mediaUrl\s*=\s*\w+\.images\.startsWith\('data:'\)\s*\?\s*\w+\.images\s*:\s*\w+\.images\.split\(\S+\)\[0\];/g,
    (match) => {
      const varName = match.match(/(\w+)\.images/)[1];
      return `mediaUrl = splitMediaUrls(${varName}.images)[0] || "";`;
    }
  );
  content = content.replace(
    /mediaUrl\s*=\s*\w+\.images\.split\(\S+\)\[0\];/g,
    (match) => {
      const varName = match.match(/(\w+)\.images/)[1];
      return `mediaUrl = splitMediaUrls(${varName}.images)[0] || "";`;
    }
  );

  content = content.replace(
    /videoUrl\s*=\s*\w+\.videos\.startsWith\('data:'\)\s*\?\s*\w+\.videos\s*:\s*\w+\.videos\.split\(\S+\)\[0\];/g,
    (match) => {
      const varName = match.match(/(\w+)\.videos/)[1];
      return `videoUrl = splitMediaUrls(${varName}.videos)[0] || "";`;
    }
  );
  content = content.replace(
    /videoUrl\s*=\s*\w+\.videos\.split\(\S+\)\[0\];/g,
    (match) => {
      const varName = match.match(/(\w+)\.videos/)[1];
      return `videoUrl = splitMediaUrls(${varName}.videos)[0] || "";`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated list page: ${filePath}`);
}

// Function to update detail page (works/[id]/page.tsx, updates/[id]/page.tsx)
function patchDetailPage(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(
    /import\s*{\s*decodeBufferToString\s*}\s*from\s*"@\/lib\/utils";/g,
    'import { decodeBufferToString, splitMediaUrls } from "@/lib/utils";'
  );

  // Replace images parsing block
  content = content.replace(
    /} else if \((rawWork|rawUpdate)\.images\.startsWith\('data:'\)\) {\s*imgArr = \[\1\.images\];\s*} else {\s*imgArr = \1\.images\.split\(','\)\.filter\(Boolean\);\s*}/g,
    (match, varName) => `} else {
        imgArr = splitMediaUrls(${varName}.images).filter(Boolean);
      }`
  );

  // Replace videos parsing block
  content = content.replace(
    /} else if \((rawWork|rawUpdate)\.videos\.startsWith\('data:'\)\) {\s*vidArr = \[\1\.videos\];\s*} else {\s*vidArr = \1\.videos\.split\(','\)\.filter\(Boolean\);\s*}/g,
    (match, varName) => `} else {
        vidArr = splitMediaUrls(${varName}.videos).filter(Boolean);
      }`
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated detail page: ${filePath}`);
}

patchListPage(path.join(frontendDir, 'src/app/works/page.tsx'));
patchListPage(path.join(frontendDir, 'src/app/updates/page.tsx'));
patchDetailPage(path.join(frontendDir, 'src/app/works/[id]/page.tsx'));
patchDetailPage(path.join(frontendDir, 'src/app/updates/[id]/page.tsx'));
