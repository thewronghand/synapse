/**
 * Set dynamic build version before electron-builder runs
 * Format: 0.1.0-abc1234-20260111
 *
 * This script temporarily modifies package.json for the build,
 * and saves the original version to restore later.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const originalVersionPath = path.join(__dirname, '..', '.original-version');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Save original version for restoration
const originalVersion = packageJson.version;
fs.writeFileSync(originalVersionPath, originalVersion);

// Get git commit hash (short)
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  console.warn('Could not get git hash:', e.message);
}

// Get current date in YYYYMMDD format
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

// Base version from package.json (strip any existing suffix)
const baseVersion = originalVersion.split('-')[0];

// Create new version
const newVersion = `${baseVersion}-${gitHash}-${dateStr}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`[set-build-version] Version set to: ${newVersion}`);
