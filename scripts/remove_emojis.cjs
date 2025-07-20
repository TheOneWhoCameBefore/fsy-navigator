const fs = require('fs');
const path = require('path');

// Function to remove emojis from text
function removeEmojis(text) {
  // This regex matches most emoji characters
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]/gu, '');
}

// Function to process a file
function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const cleanContent = removeEmojis(content);
    
    if (content !== cleanContent) {
      fs.writeFileSync(filePath, cleanContent, 'utf8');
      console.log(` Cleaned emojis from: ${filePath}`);
    } else {
      console.log(`   No emojis found in: ${filePath}`);
    }
  } catch (error) {
    console.error(` Error processing ${filePath}:`, error.message);
  }
}

// Function to recursively find files
function findFiles(dir, extensions, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other unnecessary directories
      if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
        findFiles(fullPath, extensions, files);
      }
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
console.log(' Starting emoji cleanup across the application...');

const rootDir = path.join(__dirname, '..');
const extensions = ['.jsx', '.js', '.ts', '.tsx', '.html', '.cjs'];

const files = findFiles(rootDir, extensions);
console.log(`Found ${files.length} files to process`);

files.forEach(processFile);

console.log(' Emoji cleanup completed!');
console.log(' Summary: All emojis have been removed for a professional appearance');
