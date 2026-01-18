/**
 * Authority Guard - OS vs SaaS Boundary Enforcement
 *
 * Checks the x-maxsam-authority header to determine access level.
 * - 'os': Full operator access (execution, approvals, internal data)
 * - 'saas': Projection access only (read-only, requests, no execution)
 *
 * If header is missing, defaults to 'saas' (least privilege).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Authority } from '@/types/shared';

const AUTHORITY_HEADER = 'x-maxsam-authority';

/**
 * Extract authority from request headers
 * Defaults to 'saas' if not specified (least privilege)
 */
export function getAuthority(request: NextRequest): Authority {
  const headerValue = request.headers.get(AUTHORITY_HEADER);

  if (headerValue === 'os') {
    return 'os';
  }

  return 'saas';
}

/**
 * Check if request has OS authority
 */
export function hasOSAuthority(request: NextRequest): boolean {
  return getAuthority(request) === 'os';
}

/**
 * Check if request has SaaS authority (or higher)
 */
export function hasSaaSAuthority(request: NextRequest): boolean {
  const authority = getAuthority(request);
  return authority === 'saas' || authority === 'os';
}

/**
 * Require OS authority - returns 403 if not authorized
 */
export function requireOSAuthority(request: NextRequest): NextResponse | null {
  if (!hasOSAuthority(request)) {
    return NextResponse.json(
      {
        error: 'OS authority required',
        code: 'AUTHORITY_DENIED',
        required: 'os',
        provided: getAuthority(request),
        message: 'This endpoint requires OS-level access. Set x-maxsam-authority: os header.',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Require SaaS authority (minimum level)
 * Since SaaS is default, this mainly validates the header format if present
 */
export function requireSaaSAuthority(request: NextRequest): NextResponse | null {
  const authority = getAuthority(request);

  if (authority !== 'os' && authority !== 'saas') {
    return NextResponse.json(
      {
        error: 'Invalid authority',
        code: 'AUTHORITY_INVALID',
        message: 'Authority must be "os" or "saas".',
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Create standard 403 response for authority errors
 */
export function authorityDeniedResponse(
  required: Authority,
  provided: Authority
): NextResponse {
  return NextResponse.json(
    {
      error: `${required.toUpperCase()} authority required`,
      code: 'AUTHORITY_DENIED',
      required,
      provided,
      message: `This endpoint requires ${required}-level access.`,
    },
    { status: 403 }
  );
}
