export type SportId = 'football' | 'racing'

export const DEFAULT_SPORT: SportId = 'football'
export const SPORT_COOKIE = 'ps_sport'
const APEX_HOSTS = new Set([
  'playstat.space',
  'www.playstat.space',
  'localhost',
  'playstat.localhost',
  'www.playstat.localhost',
])

const SPORT_BY_SUBDOMAIN: Record<string, SportId> = {
  football: 'football',
  racing: 'racing',
}

function getSubdomainFromHost(hostname: string): string | null {
  const lower = hostname.toLowerCase()
  const parts = lower.split('.')
  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    return parts.length >= 2 ? parts[0] : null
  }

  return parts.length >= 3 ? parts[0] : null
}

export function getSportFromHost(host?: string | null): SportId {
  if (!host) return DEFAULT_SPORT

  const hostname = host.split(':')[0]
  const subdomain = getSubdomainFromHost(hostname)
  if (!subdomain) return DEFAULT_SPORT

  return SPORT_BY_SUBDOMAIN[subdomain] ?? DEFAULT_SPORT
}

export function getSportFromCookie(value?: string | null): SportId {
  if (value === 'racing') return 'racing'
  return DEFAULT_SPORT
}

export function isApexHost(host?: string | null): boolean {
  if (!host) return false
  const hostname = host.split(':')[0].toLowerCase()
  return APEX_HOSTS.has(hostname)
}
