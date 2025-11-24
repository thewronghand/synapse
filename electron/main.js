const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextServer;
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Synapse',
  });

  // Load the app
  const loadURL = isDev
    ? `http://localhost:${PORT}`
    : `http://localhost:${PORT}`;

  mainWindow.loadURL(loadURL);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, assume Next.js dev server is already running
      console.log('Development mode: expecting Next.js dev server at', `http://localhost:${PORT}`);
      resolve();
    } else {
      // In production, start the Next.js standalone server
      const serverPath = path.join(__dirname, '../.next/standalone/server.js');
      console.log('Starting Next.js server from:', serverPath);

      nextServer = spawn('node', [serverPath], {
        env: {
          ...process.env,
          PORT: PORT.toString(),
        },
        stdio: 'inherit',
      });

      nextServer.on('error', (err) => {
        console.error('Failed to start Next.js server:', err);
        reject(err);
      });

      // Wait for server to be ready
      setTimeout(() => {
        console.log('Next.js server should be ready');
        resolve();
      }, 3000);
    }
  });
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});
