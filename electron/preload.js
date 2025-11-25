// Preload script for security
// This runs before the renderer process loads
// Can expose specific APIs to the renderer if needed

const { contextBridge } = require('electron');

// For now, we don't need to expose any APIs
// The app works purely through the Next.js server
contextBridge.exposeInMainWorld('electron', {
  // Add any Electron-specific APIs here if needed
  platform: process.platform,
});
