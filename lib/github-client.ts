import { loadGitHubToken } from './github-token';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
}

export class GitHubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create a new GitHubClient from stored token
   */
  static async fromStoredToken(): Promise<GitHubClient | null> {
    const tokenInfo = await loadGitHubToken();
    if (!tokenInfo || !tokenInfo.accessToken) {
      return null;
    }

    return new GitHubClient(tokenInfo.accessToken);
  }

  /**
   * Make a request to GitHub API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `https://api.github.com${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
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
        `GitHub API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<GitHubUser> {
    return this.request('/user');
  }

  /**
   * List user repositories
   */
  async listRepos(): Promise<GitHubRepo[]> {
    return this.request('/user/repos?per_page=100');
  }

  /**
   * Get a specific repository by owner and repo name
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null>;
  /**
   * Get a repository by name from the current user's repos
   */
  async getRepo(repoName: string): Promise<GitHubRepo | null>;
  async getRepo(ownerOrName: string, repo?: string): Promise<GitHubRepo | null> {
    try {
      if (repo) {
        // Two-argument form: getRepo(owner, repo)
        return await this.request(`/repos/${ownerOrName}/${repo}`);
      } else {
        // Single-argument form: getRepo(repoName) - search in current user's repos
        const user = await this.getCurrentUser();
        return await this.request(`/repos/${user.login}/${ownerOrName}`);
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a new repository
   */
  async createRepo(name: string, isPrivate: boolean = false): Promise<GitHubRepo> {
    return this.request('/user/repos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        private: isPrivate,
        auto_init: true,
        description: 'Published notes from Synapse',
      }),
    });
  }

  /**
   * Create or update a file in repository
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
      }),
    });
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const response: any = await this.request(`/repos/${owner}/${repo}/contents/${path}`);
      return {
        content: Buffer.from(response.content, 'base64').toString('utf-8'),
        sha: response.sha,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create a commit with multiple files
   */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    files: Array<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }>
  ): Promise<void> {
    // Get the default branch
    const repoInfo = await this.getRepo(owner, repo);
    if (!repoInfo) {
      throw new Error('Repository not found');
    }

    const branch = repoInfo.default_branch;

    // Get the latest commit SHA
    const ref: any = await this.request(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    const latestCommitSha = ref.object.sha;

    // Get the tree SHA from the latest commit
    const commit: any = await this.request(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`);
    const baseTreeSha = commit.tree.sha;

    // Create blobs for each file
    const tree = await Promise.all(
      files.map(async (file) => {
        // If content is already base64-encoded, use it directly
        // Otherwise, convert UTF-8 string to base64
        const base64Content = file.encoding === 'base64'
          ? file.content
          : Buffer.from(file.content).toString('base64');

        const blob: any = await this.request(`/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: base64Content,
            encoding: 'base64',
          }),
        });

        return {
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        };
      })
    );

    // Create a new tree
    const newTree: any = await this.request(`/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree,
      }),
    });

    // Create a new commit
    const newCommit: any = await this.request(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [latestCommitSha],
      }),
    });

    // Update the reference
    await this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: newCommit.sha,
      }),
    });
  }
}
