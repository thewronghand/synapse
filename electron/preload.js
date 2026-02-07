// Preload script for security
// This runs before the renderer process loads
// Can expose specific APIs to the renderer if needed

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  // Navigation (Cmd+[/] → main에서 renderer로 전달 → Next.js router로 처리)
  onNavBack: (callback) => ipcRenderer.on('nav-back', callback),
  onNavForward: (callback) => ipcRenderer.on('nav-forward', callback),
  removeNavListeners: () => {
    ipcRenderer.removeAllListeners('nav-back');
    ipcRenderer.removeAllListeners('nav-forward');
  },
  // Find in page (Cmd+F 토글만 — 검색 자체는 프론트엔드 CSS Highlight API로 처리)
  onToggleFind: (callback) => ipcRenderer.on('toggle-find', callback),
  removeToggleFind: () => ipcRenderer.removeAllListeners('toggle-find'),
  // 파일 변경 감지 (notes 폴더 와칭)
  onNotesChanged: (callback) => ipcRenderer.on('notes-changed', (_event, data) => callback(data)),
  removeNotesChangedListener: () => ipcRenderer.removeAllListeners('notes-changed'),
});
