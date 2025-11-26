/**
 * Check if the app is running in published (read-only) mode
 *
 * - Electron app: Always returns false (local mode with full editing)
 * - Web deployment: Returns true if NEXT_PUBLIC_IS_PUBLISHED=true
 */
export function isPublishedMode(): boolean {
  // Check if running in Electron app
  if (typeof window !== 'undefined' && (window as any).electron) {
    return false; // Electron app is always editable
  }

  // For web deployment, check environment variable
  return process.env.NEXT_PUBLIC_IS_PUBLISHED === 'true';
}
