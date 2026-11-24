export interface DomainCheckResult {
  authorized: boolean;
  hostname: string;
  reason?: string;
}

const EXACT_ALLOWED_HOSTS = new Set<string>(['localhost', '127.0.0.1', '::1']);

const ALLOWED_SUFFIXES = ['.vercel.app', '.run.app'];

/**
 * Verifies that Shadow Knight Game Zone is running on an authorized origin.
 * Allows local development hosts, official *.vercel.app deployments, and *.run.app preview hosts.
 */
export function checkDomainAuthorization(
  hostnameOverride?: string
): DomainCheckResult {
  if (typeof window === 'undefined' && !hostnameOverride) {
    return { authorized: true, hostname: 'localhost' };
  }

  const hostname = (hostnameOverride ?? window.location.hostname)
    .trim()
    .toLowerCase();

  if (!hostname) {
    return {
      authorized: false,
      hostname: 'unknown',
      reason: 'Missing origin hostname.',
    };
  }

  if (EXACT_ALLOWED_HOSTS.has(hostname)) {
    return { authorized: true, hostname };
  }

  for (const suffix of ALLOWED_SUFFIXES) {
    if (hostname.endsWith(suffix) && hostname.length > suffix.length) {
      return { authorized: true, hostname };
    }
  }

  return {
    authorized: false,
    hostname,
    reason: `Unauthorized mirror domain detected (${hostname}).`,
  };
}
