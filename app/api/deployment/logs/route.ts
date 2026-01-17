import { NextResponse } from 'next/server';
import { VercelClient } from '@/lib/vercel-client';

/**
 * GET /api/deployment/logs
 * Get build logs for the current deployment
 */
export async function GET() {
  try {
    const vercelClient = await VercelClient.fromStoredToken();

    if (!vercelClient) {
      return NextResponse.json({
        success: false,
        error: 'Vercel not connected',
      }, { status: 401 });
    }

    // Get Vercel username for project naming
    const userId = vercelClient.getUserId();
    if (!userId) {
      return NextResponse.json({
        success: true,
        data: {
          hasDeployment: false,
          logs: [],
        },
      });
    }
    const projectName = `synapse-published-${userId.substring(0, 8).toLowerCase()}`;

    // Get latest deployment
    console.log('[Deployment Logs] Looking for deployment in project:', projectName);
    const deployment = await vercelClient.getLatestDeployment(projectName);
    console.log('[Deployment Logs] Found deployment:', deployment ? { id: deployment.id, url: deployment.url, state: deployment.readyState } : null);

    if (!deployment) {
      return NextResponse.json({
        success: true,
        data: {
          hasDeployment: false,
          logs: [],
        },
      });
    }

    // Get deployment events/logs - use deployment URL as identifier (more reliable than id)
    console.log('[Deployment Logs] Fetching events for deployment:', deployment.id, 'url:', deployment.url);
    const events = await vercelClient.getDeploymentEvents(deployment.url);
    console.log('[Deployment Logs] Raw events count:', Array.isArray(events) ? events.length : 'not array');
    console.log('[Deployment Logs] Events sample:', JSON.stringify(events?.slice?.(0, 3) || events, null, 2));

    // Filter and format logs - extract text from command outputs
    // Handle both array format and object format responses
    const eventArray = Array.isArray(events) ? events : [];
    const logs = eventArray
      .filter(event => event.payload?.text || event.text)
      .map(event => ({
        timestamp: event.created || event.date || Date.now(),
        text: event.payload?.text || event.text || '',
        type: event.type || 'log',
      }));

    console.log('[Deployment Logs] Filtered logs count:', logs.length);

    return NextResponse.json({
      success: true,
      data: {
        hasDeployment: true,
        deploymentId: deployment.id,
        status: deployment.readyState,
        logs,
      },
    });
  } catch (error) {
    console.error('[Deployment Logs] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get deployment logs',
      },
      { status: 500 }
    );
  }
}
