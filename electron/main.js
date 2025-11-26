const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

let mainWindow;
let nextServer;
// Use app.isPackaged to reliably detect if app is packaged or in development
const isDev = !app.isPackaged;
const PORT = process.env.PORT || 3000;

// Setup notes directory in user's Documents folder
function setupNotesDirectory() {
  // Get user's Documents directory
  const documentsPath = app.getPath('documents');
  const synapseDir = path.join(documentsPath, 'Synapse');
  const notesDir = path.join(synapseDir, 'notes');
  const imagesDir = path.join(notesDir, 'images');
  const tempImagesDir = path.join(imagesDir, 'temp');

  // Create directories if they don't exist
  if (!fs.existsSync(synapseDir)) {
    fs.mkdirSync(synapseDir, { recursive: true });
    console.log('Created Synapse directory:', synapseDir);
  }

  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
    console.log('Created notes directory:', notesDir);
  }

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('Created images directory:', imagesDir);
  }

  if (!fs.existsSync(tempImagesDir)) {
    fs.mkdirSync(tempImagesDir, { recursive: true });
    console.log('Created temp images directory:', tempImagesDir);
  }

  // Copy default notes from app bundle if notes directory is empty
  const existingNotes = fs.readdirSync(notesDir).filter(file => file.endsWith('.md'));

  if (existingNotes.length === 0) {
    console.log('Notes directory is empty, copying default notes...');

    // Get the bundled notes directory
    const bundledNotesDir = isDev
      ? path.join(process.cwd(), 'notes')
      : path.join(process.resourcesPath, 'app', 'notes');

    try {
      // Copy all .md files
      const defaultNotes = fs.readdirSync(bundledNotesDir).filter(file => file.endsWith('.md'));
      defaultNotes.forEach(file => {
        const sourcePath = path.join(bundledNotesDir, file);
        const destPath = path.join(notesDir, file);
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied: ${file}`);
      });

      // Copy images directory if it exists
      const bundledImagesDir = path.join(bundledNotesDir, 'images');
      if (fs.existsSync(bundledImagesDir)) {
        const imageFiles = fs.readdirSync(bundledImagesDir);
        imageFiles.forEach(file => {
          const sourcePath = path.join(bundledImagesDir, file);
          const destPath = path.join(imagesDir, file);
          if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied image: ${file}`);
          }
        });
      }

      console.log('Default notes copied successfully');
    } catch (error) {
      console.error('Error copying default notes:', error);
    }
  }

  return notesDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 450,
    minHeight: 650,
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
      // Use app.getAppPath() to get the correct resource path
      const appPath = app.getAppPath();
      const serverPath = path.join(appPath, '.next/standalone/server.js');
      console.log('App path:', appPath);
      console.log('Starting Next.js server from:', serverPath);

      // Check if server.js exists
      const fs = require('fs');
      if (!fs.existsSync(serverPath)) {
        console.error('Server file not found at:', serverPath);
        try {
          console.error('Listing app directory:', fs.readdirSync(appPath));
        } catch (e) {
          console.error('Cannot list directory');
        }

        // Show error dialog instead of crashing
        const { dialog } = require('electron');
        dialog.showErrorBox(
          'Server Error',
          `Cannot find Next.js server at:\n${serverPath}\n\nPlease check the installation.`
        );
        resolve(); // Don't crash, just continue
        return;
      }

      // Setup notes directory and get the path
      const notesDir = setupNotesDirectory();
      console.log('Notes directory:', notesDir);

      // Use fork to run Next.js server with Electron's built-in Node.js
      console.log('Starting Next.js server from:', serverPath);
      nextServer = fork(serverPath, [], {
        env: {
          ...process.env,
          PORT: PORT.toString(),
          // Set HOSTNAME to allow connections from Electron
          HOSTNAME: 'localhost',
          // Pass notes directory to Next.js
          NOTES_DIR: notesDir,
        },
        stdio: 'pipe',
      });

      // Log stdout and stderr
      if (nextServer.stdout) {
        nextServer.stdout.on('data', (data) => {
          console.log('[Next.js]', data.toString());
        });
      }

      if (nextServer.stderr) {
        nextServer.stderr.on('data', (data) => {
          console.error('[Next.js Error]', data.toString());
        });
      }

      nextServer.on('error', (err) => {
        console.error('Failed to start Next.js server:', err);
        reject(err);
      });

      nextServer.on('exit', (code, signal) => {
        console.log('Next.js server exited with code:', code, 'signal:', signal);
        // Don't crash the app, just log the error
        if (code !== 0 && code !== null) {
          console.error(`Next.js server failed with code ${code}`);
        }
      });

      // Wait for server to be ready
      setTimeout(() => {
        console.log('Next.js server should be ready');
        resolve();
      }, 5000); // Increased to 5 seconds
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
