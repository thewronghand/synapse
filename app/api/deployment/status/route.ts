import { NextResponse } from 'next/server';
import { VercelClient } from '@/lib/vercel-client';

/**
 * GET /api/deployment/status
 * Get the latest deployment status for the user's published project
 */
export async function GET() {
  try {
    const vercelClient = await VercelClient.fromStoredToken();

    if (!vercelClient) {
      return NextResponse.json({
        success: true,
        data: {
          hasDeployment: false,
        },
      });
    }

    // Get Vercel username for project naming
    const vercelUser = await vercelClient.getCurrentUser() as { user: { username: string } };
    const projectName = `synapse-published-${vercelUser.user.username}`;

    // Get project for production domain info
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

    // Get actual production domain from project
    // Vercel may add suffix like -2, -3 if project name already exists
    // For team projects, domain includes team name which we want to avoid
    let productionUrl: string;

    // Helper to find the shortest/cleanest .vercel.app domain
    const findBestVercelDomain = (domains: string[]): string | undefined => {
      const vercelDomains = domains.filter(d => d.endsWith('.vercel.app'));
      if (vercelDomains.length === 0) return undefined;
      // Sort by length to get the shortest (cleanest) domain
      vercelDomains.sort((a, b) => a.length - b.length);
      return vercelDomains[0];
    };

    // Try to get from targets.production.alias first (most reliable)
    if (project?.targets?.production?.alias && project.targets.production.alias.length > 0) {
      const bestDomain = findBestVercelDomain(project.targets.production.alias);
      productionUrl = `https://${bestDomain || project.targets.production.alias[0]}`;
    } else if (project?.alias && project.alias.length > 0) {
      const domains = project.alias.map(a => a.domain);
      const bestDomain = findBestVercelDomain(domains);
      productionUrl = `https://${bestDomain || project.alias[0].domain}`;
    } else {
      // Last fallback: use project.name (actual name may differ from requested name)
      productionUrl = `https://${project?.name || projectName}.vercel.app`;
    }

    console.log('[Deployment Status] Project data:', JSON.stringify({
      name: project?.name,
      targets: project?.targets,
      alias: project?.alias,
    }, null, 2));
    console.log('[Deployment Status] Selected URL:', productionUrl);

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
