const fs = require('fs');
const path = require('path');

const targetFile = 'C:\\Users\\Admin\\Documents\\GitHub\\vishwajitbarne_adminpanel_production\\src\\routes\\admin.development.tsx';

try {
  let content = fs.readFileSync(targetFile, 'utf8');

  // We are replacing the PREVIOUSLY injected code with the FIXED one.
  const oldCode = `const openEdit = async (n: any) => {
    setEditing(n);
    
    try {
      const id = n._id || n.id;
      if (id) {
        const response = await fetch(\`\${API_BASE_URL}/api/development_work/\${id}\`, {
          headers: { "Authorization": \`Bearer \${getAuthToken()}\` }
        });
        if (response.ok) {
          const fullData = await response.json();
          n = { ...n, ...fullData };
        }
      }
    } catch (e) {
      console.error(e);
    }

    const existingMedia = [`;

  const newCode = `const openEdit = async (n: any) => {
    setEditing(n);
    
    try {
      const id = n._id || n.id;
      if (id) {
        const response = await fetch(\`\${API_BASE_URL}/api/development_work/\${id}\`, {
          headers: { "Authorization": \`Bearer \${getAuthToken()}\` }
        });
        if (response.ok) {
          let fullData = await response.json();
          if (Array.isArray(fullData) && fullData.length > 0) fullData = fullData[0];
          n = { ...n, ...fullData };
        }
      }
    } catch (e) {
      console.error(e);
    }

    const existingMedia = [`;

  if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(targetFile, content);
    console.log("Successfully fixed array destructuring in admin.development.tsx!");
  } else {
    console.log("Could not find the target code block in admin.development.tsx");
  }
} catch (e) {
  console.error("Error modifying file:", e);
}
