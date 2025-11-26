import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Check if running in published mode
  const isPublished = process.env.NEXT_PUBLIC_IS_PUBLISHED === 'true';

  // Block access to settings and editor routes in published mode
  if (isPublished) {
    const { pathname } = request.nextUrl;

    // Redirect to home if accessing restricted routes
    if (pathname.startsWith('/settings') || pathname.startsWith('/editor')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

// Configure which routes to run proxy on
export const config = {
  matcher: ['/settings/:path*', '/editor/:path*'],
};
