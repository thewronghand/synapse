const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const net = require('net');

let mainWindow;
let nextServer;
// Use app.isPackaged to reliably detect if app is packaged or in development
const isDev = !app.isPackaged;
let PORT = 3000;

// Find an available port starting from the preferred port
async function findAvailablePort(startPort = 3000, endPort = 3100) {
  for (let port = startPort; port <= endPort; port++) {
    const available = await checkPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available port found between ${startPort} and ${endPort}`);
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    // Listen on all interfaces to properly detect port conflicts
    server.listen(port);
  });
}

// Setup notes directory in user's Documents folder
function setupNotesDirectory() {
  // Get user's Documents directory
  const documentsPath = app.getPath('documents');
  const synapseDir = path.join(documentsPath, 'Synapse');
  const notesDir = path.join(synapseDir, 'notes');

  // Create directories if they don't exist
  if (!fs.existsSync(synapseDir)) {
    fs.mkdirSync(synapseDir, { recursive: true });
    console.log('Created Synapse directory:', synapseDir);
  }

  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
    console.log('Created notes directory:', notesDir);
  }

  // Note: Image directories are now created per-folder (e.g., notes/default/images/)
  // when images are uploaded, not globally in notes/images/

  // Copy default notes from app bundle if notes directory is empty
  // Check both root .md files and subfolders for existing notes
  const rootNotes = fs.readdirSync(notesDir).filter(file => file.endsWith('.md'));
  const subfolders = fs.readdirSync(notesDir).filter(file => {
    const fullPath = path.join(notesDir, file);
    return fs.statSync(fullPath).isDirectory() && !file.startsWith('.');
  });
  const hasNotesInFolders = subfolders.some(folder => {
    const folderPath = path.join(notesDir, folder);
    const folderFiles = fs.readdirSync(folderPath);
    return folderFiles.some(file => file.endsWith('.md'));
  });

  if (rootNotes.length === 0 && !hasNotesInFolders) {
    console.log('Notes directory is empty, copying default notes...');

    // Get the bundled notes directory
    const bundledNotesDir = isDev
      ? path.join(process.cwd(), 'notes')
      : path.join(process.resourcesPath, 'app', 'notes');

    // Create default folder for default notes
    const defaultFolderPath = path.join(notesDir, 'default');
    if (!fs.existsSync(defaultFolderPath)) {
      fs.mkdirSync(defaultFolderPath, { recursive: true });
      console.log('Created default folder:', defaultFolderPath);
    }

    try {
      // Copy all .md files to default folder
      const defaultNotes = fs.readdirSync(bundledNotesDir).filter(file => file.endsWith('.md'));
      defaultNotes.forEach(file => {
        const sourcePath = path.join(bundledNotesDir, file);
        const destPath = path.join(defaultFolderPath, file);
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

  // macOS 스와이프 제스처 감지 (로지텍 등 마우스 사이드 버튼 → Logi Options+가 스와이프로 변환)
  mainWindow.on('swipe', (event, direction) => {
    if (direction === 'left') {
      mainWindow.webContents.send('nav-back');
    } else if (direction === 'right') {
      mainWindow.webContents.send('nav-forward');
    }
  });

  // Open external links in system browser instead of Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if URL is external (not localhost)
    if (!url.startsWith('http://localhost')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Also handle link clicks with target="_blank"
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App Menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // File Menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ]),
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-find');
            }
          }
        }
      ]
    },
    // Navigation (Cmd+[ / Cmd+] — 로지텍 등 마우스 사이드 버튼이 키보드 단축키로 매핑됨)
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+[',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('nav-back');
            }
          }
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+]',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('nav-forward');
            }
          }
        }
      ]
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 네비게이션: Cmd+[/] 메뉴 단축키 → renderer에 nav-back/nav-forward 전송
// renderer에서 Next.js router.back()/forward()로 처리

// Find in page: 검색 자체는 프론트엔드 CSS Highlight API로 처리
// 메인 프로세스는 Cmd+F 메뉴 단축키 → toggle-find 이벤트 전송만 담당

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

      // Get user data directory for storing tokens and app data
      const userDataDir = app.getPath('userData');
      console.log('User data directory:', userDataDir);

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
          // Pass user data directory for storing tokens and app data
          USER_DATA_DIR: userDataDir,
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
    // In development, use fixed port (dev server already running)
    // In production, find available port dynamically
    if (isDev) {
      PORT = 3000;
      console.log(`Development mode: using fixed port ${PORT}`);
    } else {
      PORT = await findAvailablePort(3000, 3100);
      console.log(`Production mode: using dynamic port ${PORT}`);
    }

    await startNextServer();
    createMenu();
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
