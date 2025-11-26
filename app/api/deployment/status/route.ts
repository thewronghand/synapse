import { NextResponse } from 'next/server';
import { VercelClient } from '@/lib/vercel-client';
import { GitHubClient } from '@/lib/github-client';

/**
 * GET /api/deployment/status
 * Get the latest deployment status for the user's published project
 */
export async function GET() {
  try {
    const vercelClient = await VercelClient.fromStoredToken();
    const githubClient = await GitHubClient.fromStoredToken();

    if (!vercelClient || !githubClient) {
      return NextResponse.json({
        success: true,
        data: {
          hasDeployment: false,
        },
      });
    }

    // Get GitHub username for project naming
    const githubUser = await githubClient.getCurrentUser();
    const projectName = `synapse-published-${githubUser.login}`;

    // Get project for production domain
    const project = await vercelClient.getProject(projectName);

    // Get latest deployment
    const deployment = await vercelClient.getLatestDeployment(projectName);

    if (!deployment) {
      return NextResponse.json({
        success: true,
        data: {
          hasDeployment: false,
        },
      });
    }

    // Use production domain if available, otherwise fall back to deployment URL
    const productionUrl = project?.link
      ? `https://${projectName}.vercel.app`
      : deployment.url
        ? `https://${deployment.url}`
        : null;

    return NextResponse.json({
      success: true,
      data: {
        hasDeployment: true,
        status: deployment.readyState, // 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED'
        url: productionUrl,
        createdAt: deployment.created,
      },
    });
  } catch (error) {
    console.error('[Deployment Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deployment status',
      },
      { status: 500 }
    );
  }
}
