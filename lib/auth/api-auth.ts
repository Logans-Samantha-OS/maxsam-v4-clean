/**
 * API Authentication Middleware
 * Simple API key-based authentication for MaxSam V4 endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ApiAuthConfig {
  // Routes that require API key authentication
  protectedRoutes?: string[];
  // Routes that are always public (no auth required)
  publicRoutes?: string[];
  // Whether to require auth by default
  requireAuthByDefault?: boolean;
}

const DEFAULT_CONFIG: ApiAuthConfig = {
  // Routes that always require API key
  protectedRoutes: [
    '/api/leads',
    '/api/contracts',
    '/api/deals',
    '/api/settings',
    '/api/outreach-queue',
    '/api/conversations',
    '/api/morning-brief',
    '/api/eleanor',
    '/api/classification',
    '/api/agreements',
  ],
  // Routes that are always public (webhooks, health checks)
  publicRoutes: [
    '/api/twilio/inbound-sms',
    '/api/twilio/status',
    '/api/docusign/webhook',
    '/api/jotform/webhook',
    '/api/stripe/webhook',
    '/api/health',
    '/api/cron', // Cron jobs use CRON_SECRET separately
  ],
  requireAuthByDefault: false,
};

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!process.env.MAXSAM_API_KEY;
}

/**
 * Validate API key from request
 */
export function validateApiKey(request: NextRequest): boolean {
  if (!isApiKeyConfigured()) {
    // If no API key is set, skip authentication (development mode)
    return true;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Support both "Bearer <key>" and just "<key>"
    const key = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (key === process.env.MAXSAM_API_KEY) {
      return true;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader === process.env.MAXSAM_API_KEY) {
    return true;
  }

  // Check query parameter (less secure, but useful for testing)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get('api_key');
  if (apiKeyParam === process.env.MAXSAM_API_KEY) {
    return true;
  }

  return false;
}

/**
 * Check if route requires authentication
 */
export function routeRequiresAuth(
  pathname: string,
  config: ApiAuthConfig = DEFAULT_CONFIG
): boolean {
  // Check if explicitly public
  if (config.publicRoutes?.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Check if explicitly protected
  if (config.protectedRoutes?.some(route => pathname.startsWith(route))) {
    return true;
  }

  // Default behavior
  return config.requireAuthByDefault || false;
}

/**
 * API authentication middleware
 * Use this in API routes that need protection
 */
export function withApiAuth(
  handler: (request: NextRequest, context?: unknown) => Promise<NextResponse>,
  config: ApiAuthConfig = DEFAULT_CONFIG
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    const pathname = new URL(request.url).pathname;

    // Check if this route requires auth
    if (routeRequiresAuth(pathname, config)) {
      if (!validateApiKey(request)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'Valid API key required. Provide via Authorization header, X-API-Key header, or api_key query param.',
          },
          { status: 401 }
        );
      }
    }

    // Call the actual handler
    return handler(request, context);
  };
}

/**
 * Quick auth check for use inside API routes
 * Returns error response if unauthorized, null if authorized
 */
export function checkApiAuth(request: NextRequest): NextResponse | null {
  if (!isApiKeyConfigured()) {
    return null; // No auth required
  }

  if (!validateApiKey(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Valid API key required',
      },
      { status: 401 }
    );
  }

  return null; // Authorized
}

/**
 * Generate a new API key (for admin use)
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'msk_'; // MaxSam Key prefix
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
