const fs = require('fs');

const targetFile = 'C:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_backend_production\\controllers\\developmentWorkController.js';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Regex to remove the translation block in getAllDevelopmentWork
  const oldTranslationBlockRegex = /let finalResult = result;\s*const targetLang = getTargetLanguage\(req\);\s*if\s*\(targetLang\)\s*\{\s*try\s*\{\s*finalResult = await Promise\.all\(\s*result\.map\(\(item\)\s*=>\s*translateDevelopmentWorkItem\(item,\s*targetLang\)\)\s*\);\s*\}\s*catch\s*\(transErr\)\s*\{\s*console\.error\("Error in parallel translation:",\s*transErr\.message\);\s*\}\s*\}/g;

  if (oldTranslationBlockRegex.test(content)) {
    content = content.replace(oldTranslationBlockRegex, 'let finalResult = result;');
    fs.writeFileSync(targetFile, content);
    console.log("Successfully removed translation from getAllDevelopmentWork!");
  } else {
    console.log("Could not find the translation block.");
  }
} catch (e) {
  console.error("Error modifying file:", e);
}
