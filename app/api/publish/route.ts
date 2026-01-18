import { NextRequest, NextResponse } from 'next/server';
import { VercelClient } from '@/lib/vercel-client';
import { deleteVercelToken } from '@/lib/vercel-token';
import { getExportDataDir } from '@/lib/data-path';
import fs from 'fs/promises';
import path from 'path';

/**
 * POST /api/publish
 * Publish to Vercel via direct file upload (no GitHub required)
 *
 * Process:
 * 1. Run export to generate public/data/*.json files
 * 2. Upload all source files to Vercel
 * 3. Create deployment with those files
 * 4. Wait for deployment to complete
 */
export async function POST(request: NextRequest) {
  try {
    // Parse excludedFolders from request body
    let excludedFolders: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body.excludedFolders)) {
        excludedFolders = body.excludedFolders;
      }
    } catch {
      // No body or invalid JSON - use empty array
    }

    // Step 1: Get Vercel client from stored token
    const vercelClient = await VercelClient.fromStoredToken();

    if (!vercelClient) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel not connected. Please connect your Vercel account first.',
        },
        { status: 401 }
      );
    }

    // Step 2: Run export first (pass excludedFolders)
    console.log('[Publish] Running export...');
    if (excludedFolders.length > 0) {
      console.log('[Publish] Excluding folders:', excludedFolders.join(', '));
    }
    const exportResponse = await fetch('http://localhost:3000/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excludedFolders }),
    });

    if (!exportResponse.ok) {
      const result = await exportResponse.json();
      return NextResponse.json(
        {
          success: false,
          error: `Export failed: ${result.error || 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    const exportResult = await exportResponse.json();
    console.log('[Publish] Export completed:', exportResult.data);

    // Step 3: Get user ID for unique naming
    const userId = vercelClient.getUserId();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID not found. Please reconnect your Vercel account.',
        },
        { status: 400 }
      );
    }
    const projectName = `synapse-published-${userId.substring(0, 8).toLowerCase()}`;

    // Step 4: Read all project files
    console.log('[Publish] Reading project files...');
    const projectRoot = process.cwd();
    console.log('[Publish] process.cwd():', projectRoot);
    const filesToPush: Array<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }> = [];

    // Binary file extensions that should not be read as UTF-8
    const binaryExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.flac',
      '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dmg', '.deb', '.rpm', '.apk',
    ]);

    // Helper function to check if file is binary
    function isBinaryFile(filename: string): boolean {
      const ext = path.extname(filename).toLowerCase();
      return binaryExtensions.has(ext);
    }

    // Helper function to read files recursively
    async function readDirectory(dirPath: string, baseDir: string = '') {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.join(baseDir, entry.name).replace(/\\/g, '/');

        // Skip directories and files
        const skipPatterns = [
          'node_modules',
          '.next',
          '.git',
          'dist',
          '.vercel',
          '.electron',
          'out',
          '.DS_Store',
          '.vercel-token.json',
          '.github-token.json',
          '.env.local',
          '.env',
          'oauth-proxy',
        ];

        if (skipPatterns.some(pattern => entry.name === pattern || entry.name.startsWith('.'))) {
          continue;
        }

        if (entry.isDirectory()) {
          await readDirectory(fullPath, relativePath);
        } else {
          // Read file content based on file type
          if (isBinaryFile(entry.name)) {
            // Read binary file as buffer and convert to base64
            const buffer = await fs.readFile(fullPath);
            filesToPush.push({
              path: relativePath,
              content: buffer.toString('base64'),
              encoding: 'base64',
            });
          } else {
            // Read text file as UTF-8
            const content = await fs.readFile(fullPath, 'utf-8');
            filesToPush.push({
              path: relativePath,
              content,
              encoding: 'utf-8',
            });
          }
        }
      }
    }

    // Essential paths to include
    const essentialPaths = [
      'package-lock.json',
      'next.config.ts',
      'next.config.js',
      'tsconfig.json',
      'tailwind.config.ts',
      'postcss.config.mjs',
      'app',
      'components',
      'lib',
      'types',
      'public',
    ];

    for (const essentialPath of essentialPaths) {
      const fullPath = path.join(projectRoot, essentialPath);

      try {
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await readDirectory(fullPath, essentialPath);
        } else {
          // Read file content based on file type
          if (isBinaryFile(essentialPath)) {
            // Read binary file as buffer and convert to base64
            const buffer = await fs.readFile(fullPath);
            filesToPush.push({
              path: essentialPath,
              content: buffer.toString('base64'),
              encoding: 'base64',
            });
          } else {
            // Read text file as UTF-8
            const content = await fs.readFile(fullPath, 'utf-8');
            filesToPush.push({
              path: essentialPath,
              content,
              encoding: 'utf-8',
            });
          }
        }
      } catch (error) {
        console.warn(`[Publish] Skipping ${essentialPath}:`, error);
      }
    }

    // Create Vercel-optimized package.json (without Electron config)
    const originalPackageJson = JSON.parse(
      await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8')
    );

    // Remove Electron-related dev dependencies
    const cleanDevDeps = { ...originalPackageJson.devDependencies };
    delete cleanDevDeps.electron;
    delete cleanDevDeps['electron-builder'];
    delete cleanDevDeps.concurrently;
    delete cleanDevDeps['cross-env'];
    delete cleanDevDeps['wait-on'];

    const vercelPackageJson = {
      name: originalPackageJson.name,
      version: originalPackageJson.version,
      private: originalPackageJson.private,
      scripts: {
        dev: originalPackageJson.scripts.dev,
        build: originalPackageJson.scripts.build,
        start: originalPackageJson.scripts.start,
      },
      dependencies: originalPackageJson.dependencies,
      devDependencies: cleanDevDeps,
    };

    filesToPush.push({
      path: 'package.json',
      content: JSON.stringify(vercelPackageJson, null, 2),
      encoding: 'utf-8',
    });

    // Add .env file with NEXT_PUBLIC_IS_PUBLISHED=true
    filesToPush.push({
      path: '.env',
      content: 'NEXT_PUBLIC_IS_PUBLISHED=true\n',
      encoding: 'utf-8',
    });

    // Add vercel.json for configuration
    filesToPush.push({
      path: 'vercel.json',
      content: JSON.stringify({
        framework: 'nextjs',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
      }, null, 2),
      encoding: 'utf-8',
    });

    console.log(`[Publish] Found ${filesToPush.length} files to deploy (before export data)`);

    // Step 4.5: Read export data files and add them as public/data/*
    const exportDataDir = getExportDataDir();
    console.log('[Publish] Export data dir:', exportDataDir);

    try {
      const exportDataExists = await fs.stat(exportDataDir).then(() => true).catch(() => false);

      if (exportDataExists) {
        // Helper function to read export data files recursively
        async function readExportDataDirectory(dirPath: string, baseDir: string = '') {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.join(baseDir, entry.name).replace(/\\/g, '/');

            if (entry.isDirectory()) {
              await readExportDataDirectory(fullPath, relativePath);
            } else {
              // Read as UTF-8 (all export data files are JSON)
              const content = await fs.readFile(fullPath, 'utf-8');
              filesToPush.push({
                path: `public/data/${relativePath}`,
                content,
                encoding: 'utf-8',
              });
            }
          }
        }

        await readExportDataDirectory(exportDataDir);
        console.log(`[Publish] Added export data files, total files now: ${filesToPush.length}`);
      } else {
        console.warn('[Publish] Export data directory does not exist:', exportDataDir);
      }
    } catch (error) {
      console.error('[Publish] Error reading export data:', error);
    }

    // Debug: Check if public/data files are included
    const publicDataFiles = filesToPush.filter(f => f.path.startsWith('public/data'));
    console.log(`[Publish] public/data files: ${publicDataFiles.length}`);
    publicDataFiles.forEach(f => console.log(`  - ${f.path}`));

    // Step 5: Create direct deployment to Vercel
    console.log('[Publish] Creating Vercel deployment...');
    const deployment = await vercelClient.createDirectDeployment(
      projectName,
      filesToPush,
      {
        target: 'production',
        projectSettings: {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          installCommand: 'npm install',
        },
      }
    );

    console.log('[Publish] Deployment created:', deployment.id);

    // Step 6: Make project public (remove all protection types)
    console.log('[Publish] Making project public...');
    try {
      const project = await vercelClient.getProject(projectName);
      if (project) {
        await vercelClient.disableDeploymentProtection(project.id);
        console.log('[Publish] Project is now public');
      }
    } catch (protectionError) {
      // Non-fatal error - deployment still works, just might need manual protection removal
      console.warn('[Publish] Could not remove protection (non-fatal):', protectionError);
    }

    return NextResponse.json({
      success: true,
      data: {
        deploymentId: deployment.id,
        deploymentUrl: `https://${deployment.url}`,
        projectName: projectName,
        projectUrl: `https://vercel.com/dashboard`,
        message: 'Published successfully! Vercel is building your site.',
        state: deployment.state,
        // Debug info
        debug: {
          totalFiles: filesToPush.length,
          publicDataFiles: publicDataFiles.length,
          hasGraphJson: publicDataFiles.some(f => f.path === 'public/data/graph.json'),
          hasDocumentsJson: publicDataFiles.some(f => f.path === 'public/data/documents.json'),
        },
      },
    });
  } catch (error) {
    console.error('[Publish] Error:', error);

    // Check for token expiration
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      // Automatically delete expired tokens
      console.log('[Publish] Token expired, removing stored tokens...');
      await deleteVercelToken();

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication token has expired. Please reconnect your Vercel account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    // Check for permission denied (usually Team-related)
    if (error instanceof Error && error.message.startsWith('PERMISSION_DENIED:')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied. Please reconnect with a Personal Account (not a Team) or ensure you have project creation permissions.',
          code: 'PERMISSION_DENIED',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish',
      },
      { status: 500 }
    );
  }
}
