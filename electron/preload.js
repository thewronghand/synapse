// Preload script for security
// This runs before the renderer process loads
// Can expose specific APIs to the renderer if needed

const { contextBridge, ipcRenderer } = require('electron');

// For now, we don't need to expose any APIs
// The app works purely through the Next.js server
contextBridge.exposeInMainWorld('electron', {
  // Add any Electron-specific APIs here if needed
  platform: process.platform,
  // Navigation functions for mouse back/forward buttons
  goBack: () => ipcRenderer.send('nav-back'),
  goForward: () => ipcRenderer.send('nav-forward'),
  // Find in page functions
  findInPage: (text) => ipcRenderer.send('find-in-page', text),
  findNext: () => ipcRenderer.send('find-in-page-next'),
  findPrev: () => ipcRenderer.send('find-in-page-prev'),
  stopFind: () => ipcRenderer.send('stop-find-in-page'),
  onToggleFind: (callback) => ipcRenderer.on('toggle-find', callback),
});

// Listen for mouse back/forward buttons (button 3 = back, button 4 = forward)
// Wait for DOM to be ready before adding event listener
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('mouseup', (e) => {
    // Mouse button 3 = back, button 4 = forward (standard for multi-button mice)
    if (e.button === 3) {
      e.preventDefault();
      ipcRenderer.send('nav-back');
    } else if (e.button === 4) {
      e.preventDefault();
      ipcRenderer.send('nav-forward');
    }
  });
});
