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

// Next.js 16 standalone 구조: .next/standalone/{프로젝트폴더명}/ 또는 .next/standalone/ 루트
const standaloneDir = path.join('.next', 'standalone');

// server.js 위치 탐색: 하위 폴더 또는 standalone 루트
let serverRoot;

// 1) 하위 폴더에서 server.js 찾기
const standaloneEntries = fs.readdirSync(standaloneDir).filter(
  (entry) => entry !== '.next' && entry !== 'public' && entry !== 'node_modules' &&
    fs.statSync(path.join(standaloneDir, entry)).isDirectory()
);

const projectDir = standaloneEntries.find((dir) =>
  fs.existsSync(path.join(standaloneDir, dir, 'server.js'))
);

if (projectDir) {
  serverRoot = path.join(standaloneDir, projectDir);
  console.log(`Copying Next.js build assets (project dir: ${projectDir})...`);
} else if (fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  // 2) standalone 루트에 server.js가 있는 경우 (CI 환경)
  serverRoot = standaloneDir;
  console.log('Copying Next.js build assets (standalone root)...');
} else {
  console.error('Cannot find server.js in standalone output');
  console.error('Standalone entries:', fs.readdirSync(standaloneDir));
  process.exit(1);
}

// Copy static files
const staticSrc = path.join('.next', 'static');
const staticDest = path.join(serverRoot, '.next', 'static');
copyDir(staticSrc, staticDest);
console.log('✓ Copied .next/static');

// Copy public files
const publicSrc = 'public';
const publicDest = path.join(serverRoot, 'public');
copyDir(publicSrc, publicDest);
console.log('✓ Copied public');

console.log('Asset copying completed!');
