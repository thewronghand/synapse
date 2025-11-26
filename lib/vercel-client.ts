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

export class VercelClient {
  private accessToken: string;
  private teamId?: string;

  constructor(accessToken: string, teamId?: string) {
    this.accessToken = accessToken;
    this.teamId = teamId;
  }

  /**
   * Create a new VercelClient from stored token
   */
  static async fromStoredToken(): Promise<VercelClient | null> {
    const tokenInfo = await loadVercelToken();
    if (!tokenInfo || !tokenInfo.accessToken) {
      return null;
    }

    return new VercelClient(tokenInfo.accessToken, tokenInfo.teamId);
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
}
