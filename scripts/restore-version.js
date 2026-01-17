/**
 * Restore original version after electron-builder completes
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const originalVersionPath = path.join(__dirname, '..', '.original-version');

if (!fs.existsSync(originalVersionPath)) {
  console.log('[restore-version] No original version file found, skipping');
  process.exit(0);
}

const originalVersion = fs.readFileSync(originalVersionPath, 'utf-8').trim();
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

packageJson.version = originalVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Clean up
fs.unlinkSync(originalVersionPath);

console.log(`[restore-version] Version restored to: ${originalVersion}`);
