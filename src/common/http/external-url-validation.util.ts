import { isIP } from 'node:net';

interface ExternalUrlValidationOptions {
  requireHttps?: boolean;
  allowedHosts?: string[];
  allowSubdomains?: boolean;
  blockPrivateNetwork?: boolean;
}

export function parseAndValidateExternalUrl(
  rawUrl: string,
  options: ExternalUrlValidationOptions = {},
): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (!isAllowedExternalUrl(parsed, options)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(
  url: URL,
  options: ExternalUrlValidationOptions = {},
): boolean {
  const {
    requireHttps = true,
    allowedHosts,
    allowSubdomains = true,
    blockPrivateNetwork = true,
  } = options;

  if (requireHttps && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    return false;
  }

  if (blockPrivateNetwork && isPrivateNetworkHost(hostname)) {
    return false;
  }

  if (allowedHosts && allowedHosts.length > 0) {
    return allowedHosts.some((allowedHostRaw) => {
      const allowedHost = allowedHostRaw.trim().toLowerCase();
      if (!allowedHost) {
        return false;
      }

      if (hostname === allowedHost) {
        return true;
      }

      return allowSubdomains && hostname.endsWith(`.${allowedHost}`);
    });
  }

  return true;
}

function isPrivateNetworkHost(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  const ipType = isIP(hostname);
  if (ipType === 4) {
    return isPrivateIpv4(hostname);
  }

  if (ipType === 6) {
    return isPrivateIpv6(hostname);
  }

  return false;
}

function isPrivateIpv4(ip: string): boolean {
  const octets = ip
    .split('.')
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  if (octets.length !== 4) {
    return true;
  }

  const a = octets[0];
  const b = octets[1];
  if (a === undefined || b === undefined) return true;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') {
    return true;
  }

  if (normalized.startsWith('fe80:')) {
    return true;
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  const mappedV4Prefix = '::ffff:';
  if (normalized.startsWith(mappedV4Prefix)) {
    return isPrivateIpv4(normalized.slice(mappedV4Prefix.length));
  }

  return false;
}
