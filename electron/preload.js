// Preload script for security
// This runs before the renderer process loads
// Can expose specific APIs to the renderer if needed

const { contextBridge, ipcRenderer } = require('electron');

// For now, we don't need to expose any APIs
// The app works purely through the Next.js server
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  // Navigation
  goBack: () => ipcRenderer.send('nav-back'),
  goForward: () => ipcRenderer.send('nav-forward'),
  // Find in page (Cmd+F 토글만 — 검색 자체는 프론트엔드 CSS Highlight API로 처리)
  onToggleFind: (callback) => ipcRenderer.on('toggle-find', callback),
  removeToggleFind: () => ipcRenderer.removeAllListeners('toggle-find'),
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
