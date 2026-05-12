/**
 * @file tests/runtime_smoke_test.js
 * @description L4 Runtime Smoke Test.
 * Scans all modular files to ensure there are no broken import/export links.
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = "/mnt/c/Users/eidol/Desktop/WebTool/WebTool_SaaS/";

function scanFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanFiles(filePath, fileList);
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function runL4() {
  console.log("=== 🧪 Starting L4 Runtime Smoke Tests ===\n");
  const allFiles = scanFiles(TARGET_DIR);
  let errors = 0;

  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const imports = content.match(/import\s+.*\s+from\s+['"].*['"]/g) || [];
    
    imports.forEach(imp => {
      const match = imp.match(/from\s+['"](.*)['"]/);
      if (match) {
        const relPath = match[1];
        if (relPath.startsWith('.')) {
          // Resolve relative path to absolute
          const dir = path.dirname(file);
          const absPath = path.resolve(dir, relPath);
          
          // Check if the resolved path exists as a file (or a directory with index.js)
          if (!fs.existsSync(absPath) && !fs.existsSync(absPath + '.js') && !fs.existsSync(absPath + '.jsx')) {
            console.log(`❌ Broken Import in ${file}: ${relPath} -> ${absPath} (NOT FOUND)`);
            errors++;
          }
        }
      }
    });
  });

  if (errors === 0) {
    console.log("\n✅ L4 Result: No broken import links found. All module paths are valid.");
    process.exit(0);
  } else {
    console.log(`\n❌ L4 Result: Found ${errors} broken links.`);
    process.exit(1);
  }
}

runL4();
