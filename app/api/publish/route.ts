import { NextResponse } from 'next/server';
import { GitHubClient } from '@/lib/github-client';
import { VercelClient } from '@/lib/vercel-client';
import { deleteVercelToken } from '@/lib/vercel-token';
import { deleteGitHubToken } from '@/lib/github-token';
import fs from 'fs/promises';
import path from 'path';

/**
 * POST /api/publish
 * Publish to Vercel via GitHub (Git-based deployment)
 *
 * Process:
 * 1. Run export to generate public/data/*.json files
 * 2. Create GitHub repository (or use existing)
 * 3. Push all source code to GitHub
 * 4. Create Vercel project linked to GitHub repo
 * 5. Trigger automatic deployment
 */
export async function POST() {
  try {
    // Step 1: Get clients from stored tokens
    const githubClient = await GitHubClient.fromStoredToken();
    const vercelClient = await VercelClient.fromStoredToken();

    if (!githubClient) {
      return NextResponse.json(
        {
          success: false,
          error: 'GitHub not connected. Please connect your GitHub account first.',
        },
        { status: 401 }
      );
    }

    if (!vercelClient) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel not connected. Please connect your Vercel account first.',
        },
        { status: 401 }
      );
    }

    // Step 2: Run export first
    console.log('[Publish] Running export...');
    const exportResponse = await fetch('http://localhost:3000/api/export', {
      method: 'POST',
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

    // Step 3: Get GitHub username for unique naming
    const githubUser = await githubClient.getCurrentUser();
    const repoName = `synapse-published-${githubUser.login}`;
    const projectName = `synapse-published-${githubUser.login}`;

    // Step 4: Check if GitHub repo exists, create if not
    console.log('[Publish] Checking GitHub repository...');
    let repo = await githubClient.getRepo(repoName);

    if (repo) {
      console.log('[Publish] Repository exists:', repo.full_name);
    } else {
      console.log('[Publish] Repository not found, creating...');
      repo = await githubClient.createRepo(repoName, true); // Private repository
      console.log('[Publish] Repository created:', repo.full_name);
    }

    // Step 5: Read all project files
    console.log('[Publish] Reading project files...');
    const projectRoot = process.cwd();
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

    // Add .gitignore for published version
    filesToPush.push({
      path: '.gitignore',
      content: `# Dependencies
node_modules
/.pnp
.pnp.*

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# OS
.DS_Store
Thumbs.db

# Electron (not needed in published version)
/dist
*.dmg
*.exe
*.AppImage
*.deb

# Local env files
.env*.local
.env

# OAuth tokens (not needed in published version)
.vercel-token.json
.github-token.json
`,
      encoding: 'utf-8',
    });

    // Add README for published version
    filesToPush.push({
      path: 'README.md',
      content: `# Synapse Published

This is the published version of Synapse notes, deployed on Vercel.

This repository is automatically managed by the Synapse desktop application.

## Environment Variables

Make sure to set the following environment variable in Vercel:

\`\`\`
NEXT_PUBLIC_IS_PUBLISHED=true
\`\`\`

This enables read-only mode for the published version.
`,
      encoding: 'utf-8',
    });

    console.log(`[Publish] Found ${filesToPush.length} files to push`);

    // Step 6: Push all files to GitHub
    console.log('[Publish] Pushing files to GitHub...');
    await githubClient.createCommit(
      repo.owner.login,
      repo.name,
      'Update published notes',
      filesToPush
    );
    console.log('[Publish] Files pushed successfully');

    // Step 7: Check if Vercel project exists
    console.log('[Publish] Checking Vercel project...');
    let project = await vercelClient.getProject(projectName);

    const isNewProject = !project;

    if (project) {
      console.log('[Publish] Vercel project exists:', project.name);
    } else {
      console.log('[Publish] Vercel project not found, creating...');

      // Create Vercel project with GitHub repo linked
      project = await vercelClient.createProject(
        projectName,
        'nextjs',
        {
          owner: repo.owner.login,
          repo: repo.name
        }
      );
      console.log('[Publish] Vercel project created with GitHub link:', project.name);

      // Set environment variable
      await vercelClient.setEnvVariable(
        project.id,
        'NEXT_PUBLIC_IS_PUBLISHED',
        'true',
        'production'
      );
      console.log('[Publish] Environment variable set');
    }

    // Step 8: Trigger deployment
    if (isNewProject && project.link?.repoId) {
      // For new projects, manually trigger first deployment
      console.log('[Publish] Triggering initial deployment...');
      try {
        await vercelClient.triggerDeployment(
          projectName,
          {
            type: 'github',
            repoId: project.link.repoId,
            ref: repo.default_branch || 'main',
          }
        );
        console.log('[Publish] Initial deployment triggered successfully');
      } catch (deployError) {
        console.warn('[Publish] Failed to trigger deployment, but project is set up:', deployError);
        // Don't fail the whole publish if deployment trigger fails
        // User can manually deploy or push again
      }
    } else {
      console.log('[Publish] Deployment will be triggered automatically by GitHub push');
    }

    return NextResponse.json({
      success: true,
      data: {
        repoName: repo.full_name,
        repoUrl: repo.html_url,
        projectName: project.name,
        projectUrl: `https://vercel.com/dashboard`,
        message: 'Published successfully! Vercel is building your site from GitHub.',
      },
    });
  } catch (error) {
    console.error('[Publish] Error:', error);

    // Check for token expiration
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      // Automatically delete expired tokens
      console.log('[Publish] Token expired, removing stored tokens...');
      await deleteVercelToken();
      await deleteGitHubToken();

      return NextResponse.json(
        {
          success: false,
          error: 'Authentication token has expired. Please reconnect your accounts.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
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
