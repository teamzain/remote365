const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(file => {
    let dirPath = path.join(dir, file);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (!dirPath.includes('ui')) walkDir(dirPath, callback);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(dirPath);
    }
  });
}

const targetDirs = [
  'f:/TechVision/RemoteLink/apps/mobile/app',
  'f:/TechVision/RemoteLink/apps/mobile/components'
];

targetDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    walkDir(dir, (filePath) => {
      // Do not modify the wrapper itself or ErrorModal
      if (filePath.includes('Text.tsx') || filePath.includes('ErrorModal.tsx')) return; 

      let content = fs.readFileSync(filePath, 'utf8');
      
      const rnImportRegex = /import\s+{[^}]*?\bText\b[^}]*}\s+from\s+['"]react-native['"]/g;
      const rnImportMatch = content.match(rnImportRegex);
      
      if (rnImportMatch) {
         let newContent = content;
         
         // 1. Remove 'Text' from the react-native import
         newContent = newContent.replace(/import\s+{([^}]*?)}\s+from\s+['"]react-native['"]/g, (match, p1) => {
            if (!p1.includes('Text')) return match;
            const imports = p1.split(',').map(s => s.trim()).filter(s => s !== '' && s !== 'Text');
            if (imports.length === 0) {
               return ''; // Removed entirely if Text was the only import
            }
            return `import { ${imports.join(', ')} } from 'react-native'`;
         });
         
         // 2. Add our custom Text import at the top of the file after the last import
         const lastImportIndex = newContent.lastIndexOf('import ');
         const endOfLastImport = newContent.indexOf(';', lastImportIndex) + 1;
         
         const importStr = '\nimport { Text } from "@/components/Text";';

         let finalContent;
         if (endOfLastImport > 0) {
            finalContent = newContent.slice(0, endOfLastImport) + importStr + newContent.slice(endOfLastImport);
         } else {
            finalContent = importStr.trimStart() + '\n' + newContent;
         }
         
         fs.writeFileSync(filePath, finalContent, 'utf8');
         console.log('Updated', filePath);
      }
    });
  }
});
