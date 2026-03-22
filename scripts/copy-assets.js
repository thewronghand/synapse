const fs = require('fs');
const path = require('path');

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source directory does not exist: ${src}`);
    return;
  }

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Next.js 16 standalone 구조: .next/standalone/{프로젝트폴더명}/
// 프로젝트 폴더명 자동 감지
const standaloneDir = path.join('.next', 'standalone');
const standaloneEntries = fs.readdirSync(standaloneDir).filter(
  (entry) => entry !== '.next' && entry !== 'public' && entry !== 'node_modules' &&
    fs.statSync(path.join(standaloneDir, entry)).isDirectory()
);

// server.js가 있는 프로젝트 폴더 찾기
const projectDir = standaloneEntries.find((dir) =>
  fs.existsSync(path.join(standaloneDir, dir, 'server.js'))
);

if (!projectDir) {
  console.error('Cannot find project directory in standalone output');
  console.error('Standalone entries:', standaloneEntries);
  process.exit(1);
}

console.log(`Copying Next.js build assets (project dir: ${projectDir})...`);

// Copy static files → standalone/{projectDir}/.next/static
const staticSrc = path.join('.next', 'static');
const staticDest = path.join(standaloneDir, projectDir, '.next', 'static');
copyDir(staticSrc, staticDest);
console.log('✓ Copied .next/static');

// Copy public files → standalone/{projectDir}/public
const publicSrc = 'public';
const publicDest = path.join(standaloneDir, projectDir, 'public');
copyDir(publicSrc, publicDest);
console.log('✓ Copied public');

console.log('Asset copying completed!');
