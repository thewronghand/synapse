import { loadVercelToken } from './vercel-token';

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  framework: string | null;
  link?: {
    type: string;
    repo: string;
    repoId: number;
    gitCredentialId: string;
    sourceless: boolean;
    createdAt: number;
    updatedAt: number;
  };
  // Production domains/aliases for the project
  alias?: Array<{
    domain: string;
    target?: 'production' | 'preview';
  }>;
  // Alternative: targets object with production info
  targets?: {
    production?: {
      alias?: string[];
    };
  };
}

export interface VercelDeployment {
  id: string;
  url: string;
  name: string;
  state: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED';
  type: 'LAMBDAS';
  created: number;
  creator: {
    uid: string;
    email?: string;
    username?: string;
  };
  meta?: Record<string, string>;
  target?: 'production' | 'staging';
  aliasAssigned?: boolean;
  aliasError?: {
    code: string;
    message: string;
  } | null;
  readyState: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED';
}

export interface VercelDeploymentEvent {
  type: string;
  created: number;
  date?: number;
  text?: string; // Direct text field (v3 API)
  payload: {
    text?: string;
    statusCode?: number;
    deploymentId?: string;
    info?: Record<string, unknown>;
  };
}

export class VercelClient {
  private accessToken: string;
  private teamId?: string;
  private userId?: string;

  constructor(accessToken: string, teamId?: string, userId?: string) {
    this.accessToken = accessToken;
    this.teamId = teamId;
    this.userId = userId;
  }

  /**
   * Create a new VercelClient from stored token
   */
  static async fromStoredToken(): Promise<VercelClient | null> {
    const tokenInfo = await loadVercelToken();
    if (!tokenInfo || !tokenInfo.accessToken) {
      return null;
    }

    return new VercelClient(tokenInfo.accessToken, tokenInfo.teamId, tokenInfo.userId);
  }

  /**
   * Get stored user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Make a request to Vercel API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = new URL(endpoint, 'https://api.vercel.com');

    // Add teamId to query params if available
    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Check for token expiration
    if (response.status === 401 || response.status === 403) {
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vercel API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return this.request('/v2/user');
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<{ projects: VercelProject[] }> {
    return this.request('/v9/projects');
  }

  /**
   * Get a specific project by name
   */
  async getProject(nameOrId: string): Promise<VercelProject | null> {
    try {
      return await this.request(`/v9/projects/${nameOrId}`);
    } catch (error) {
      // Project not found
      return null;
    }
  }

  /**
   * Create a new project
   */
  async createProject(
    name: string,
    framework?: string,
    gitRepository?: { owner: string; repo: string }
  ): Promise<VercelProject> {
    const body: any = {
      name,
      framework: framework || 'nextjs',
      buildCommand: 'npm run build',
      installCommand: 'npm install',
    };

    // Add gitRepository if provided
    if (gitRepository) {
      body.gitRepository = {
        type: 'github',
        repo: `${gitRepository.owner}/${gitRepository.repo}`,
      };
    }

    return this.request('/v9/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(id: string): Promise<VercelDeployment> {
    return this.request(`/v13/deployments/${id}`);
  }

  /**
   * List deployments for a project
   */
  async listDeployments(projectId: string): Promise<{ deployments: VercelDeployment[] }> {
    return this.request(`/v6/deployments?projectId=${projectId}`);
  }

  /**
   * Set environment variable for a project
   */
  async setEnvVariable(
    projectId: string,
    key: string,
    value: string,
    target: 'production' | 'preview' | 'development' = 'production'
  ) {
    return this.request(`/v10/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        type: 'encrypted',
        target: [target],
      }),
    });
  }

  /**
   * Link GitHub repository to Vercel project
   */
  async linkGitHubRepo(
    projectId: string,
    owner: string,
    repo: string
  ): Promise<void> {
    await this.request(`/v1/projects/${projectId}/link`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'github',
        repo: `${owner}/${repo}`,
      }),
    });
  }

  /**
   * Trigger a deployment from Git
   */
  async triggerDeployment(
    projectName: string,
    gitSource: {
      type: 'github';
      repoId: number;
      ref: string; // branch name, e.g., 'main'
    }
  ): Promise<VercelDeployment> {
    return this.request('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: projectName,
        gitSource,
        projectSettings: {
          framework: 'nextjs',
        },
      }),
    });
  }

  /**
   * Get latest deployment for a project
   */
  async getLatestDeployment(projectName: string): Promise<VercelDeployment | null> {
    try {
      const project = await this.getProject(projectName);
      if (!project) {
        return null;
      }

      const result = await this.listDeployments(project.id);

      // Return the most recent production deployment
      const productionDeployments = result.deployments
        .filter(d => d.target === 'production')
        .sort((a, b) => b.created - a.created);

      return productionDeployments[0] || null;
    } catch (error) {
      console.error('Error getting latest deployment:', error);
      return null;
    }
  }

  /**
   * Update project settings to make it public
   * Disables all protection types (password, SSO, Vercel Authentication)
   */
  async updateProject(
    projectId: string,
    settings: Record<string, unknown>
  ): Promise<VercelProject> {
    return this.request(`/v9/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  /**
   * Disable all deployment protection for a project
   * Based on Vercel API: https://vercel.com/docs/rest-api/reference/endpoints/projects/update-an-existing-project
   */
  async disableDeploymentProtection(projectId: string): Promise<void> {
    // Set all protection types to null to disable them
    // Note: Standard Protection may require dashboard configuration
    const protectionSettings = {
      passwordProtection: null,
      ssoProtection: null,
      trustedIps: null,
      // Allow all paths to bypass OPTIONS preflight
      optionsAllowlist: null,
    };

    await this.request(`/v9/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(protectionSettings),
    });
  }

  /**
   * Upload file to Vercel and get file hash
   * Returns the SHA1 hash of the file for use in deployment
   */
  async uploadFile(content: Buffer | string, contentType: string = 'application/octet-stream'): Promise<string> {
    const url = new URL('/v2/files', 'https://api.vercel.com');

    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    // Convert string to Buffer if needed
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    // Calculate SHA1 hash
    const crypto = await import('crypto');
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': contentType,
        'x-vercel-digest': sha1,
        'Content-Length': buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('TOKEN_EXPIRED');
    }

    // 200 means file uploaded, 409 means file already exists (both are OK)
    if (!response.ok && response.status !== 409) {
      const errorText = await response.text();
      throw new Error(`Vercel file upload error (${response.status}): ${errorText}`);
    }

    return sha1;
  }

  /**
   * Create a deployment with direct file upload (no Git required)
   */
  async createDirectDeployment(
    projectName: string,
    files: Array<{ path: string; content: Buffer | string; encoding?: 'utf-8' | 'base64' }>,
    options?: {
      target?: 'production' | 'preview';
      projectSettings?: {
        framework?: string;
        buildCommand?: string;
        installCommand?: string;
      };
    }
  ): Promise<VercelDeployment> {
    console.log(`[VercelClient] Uploading ${files.length} files...`);

    // Upload all files and collect their hashes
    const fileHashes: Array<{ file: string; sha: string; size: number }> = [];

    for (const file of files) {
      let buffer: Buffer;

      if (file.encoding === 'base64' && typeof file.content === 'string') {
        buffer = Buffer.from(file.content, 'base64');
      } else if (typeof file.content === 'string') {
        buffer = Buffer.from(file.content, 'utf-8');
      } else {
        buffer = file.content;
      }

      const sha = await this.uploadFile(buffer);
      fileHashes.push({
        file: file.path,
        sha,
        size: buffer.length,
      });
    }

    console.log(`[VercelClient] All files uploaded, creating deployment...`);

    // Create deployment with file references
    const url = new URL('/v13/deployments', 'https://api.vercel.com');

    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    const deploymentBody = {
      name: projectName,
      files: fileHashes,
      target: options?.target || 'production',
      projectSettings: options?.projectSettings || {
        framework: 'nextjs',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
      },
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deploymentBody),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vercel deployment error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get deployment events/logs
   * Returns build output logs for a deployment
   * Uses v3 API with builds=1 to get build logs
   */
  async getDeploymentEvents(deploymentIdOrUrl: string): Promise<VercelDeploymentEvent[]> {
    const url = new URL(`/v3/deployments/${deploymentIdOrUrl}/events`, 'https://api.vercel.com');

    if (this.teamId) {
      url.searchParams.set('teamId', this.teamId);
    }

    // Request build logs specifically
    url.searchParams.set('builds', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vercel API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
