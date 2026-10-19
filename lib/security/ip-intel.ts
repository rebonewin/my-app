import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ipIntel } from "@/lib/db/schema";

/**
 * IP intelligence for threat detection.
 *
 * Providers (in order):
 *   1. ipinfo.io   — needs IPINFO_TOKEN
 *   2. ip-api.com  — free, no key, HTTP only, 45 req/min
 *   3. none        — returns nulls; detection degrades gracefully
 *
 * Results are cached in `ip_intel` for 24h so a login storm cannot burn the
 * provider quota.
 */

export interface IpInfo {
  ip: string;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  asn: string | null;
  org: string | null;
  isVpn: boolean;
  isTor: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  riskScore: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** RFC1918 / loopback / link-local / CGNAT — never worth a lookup. */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const value = ip.trim();

  if (value === "::1" || value === "127.0.0.1" || value === "localhost") {
    return true;
  }
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // ULA
  if (value.startsWith("fe80")) return true; // link-local v6

  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;

  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function emptyIntel(ip: string): IpInfo {
  return {
    ip,
    country: null,
    region: null,
    city: null,
    latitude: null,
    longitude: null,
    asn: null,
    org: null,
    isVpn: false,
    isTor: false,
    isProxy: false,
    isDatacenter: false,
    riskScore: 0,
  };
}

interface IpinfoResponse {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  bogon?: boolean;
  privacy?: {
    vpn?: boolean;
    tor?: boolean;
    proxy?: boolean;
    hosting?: boolean;
  };
  error?: { title?: string; message?: string };
}

async function lookupIpinfo(ip: string): Promise<IpInfo | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as IpinfoResponse;
    if (data.error || data.bogon) return emptyIntel(ip);

    const [latitude, longitude] = (data.loc ?? "").split(",");
    const isVpn = data.privacy?.vpn ?? false;
    const isTor = data.privacy?.tor ?? false;
    const isProxy = data.privacy?.proxy ?? false;
    const isDatacenter = data.privacy?.hosting ?? false;

    let riskScore = 0;
    if (isTor) riskScore += 60;
    if (isVpn) riskScore += 40;
    if (isProxy) riskScore += 35;
    if (isDatacenter) riskScore += 20;

    return {
      ip,
      country: data.country ?? null,
      region: data.region ?? null,
      city: data.city ?? null,
      latitude: latitude || null,
      longitude: longitude || null,
      asn: data.org?.split(" ")[0] ?? null,
      org: data.org ?? null,
      isVpn,
      isTor,
      isProxy,
      isDatacenter,
      riskScore,
    };
  } catch {
    return null;
  }
}

interface IpApiResponse {
  status?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  as?: string;
  org?: string;
  isp?: string;
  proxy?: boolean;
  hosting?: boolean;
  message?: string;
}

async function lookupIpApi(ip: string): Promise<IpInfo | null> {
  try {
    const fields =
      "status,message,countryCode,regionName,city,lat,lon,as,org,isp,proxy,hosting";
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as IpApiResponse;
    if (data.status !== "success") return null;

    const isProxy = data.proxy ?? false;
    const isDatacenter = data.hosting ?? false;
    const asn = data.as?.split(" ")[0] ?? null;

    // ip-api does not label Tor separately; the Tor Project publishes the list.
    const isTor = await isTorExitNode(ip).catch(() => false);

    let riskScore = 0;
    if (isTor) riskScore += 60;
    if (isProxy) riskScore += 35;
    if (isDatacenter) riskScore += 20;

    return {
      ip,
      country: data.countryCode ?? null,
      region: data.regionName ?? null,
      city: data.city ?? null,
      latitude: data.lat != null ? String(data.lat) : null,
      longitude: data.lon != null ? String(data.lon) : null,
      asn,
      org: data.org ?? data.isp ?? null,
      isVpn: isProxy && isDatacenter,
      isTor,
      isProxy,
      isDatacenter,
      riskScore,
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                             Tor exit node list                             */
/* -------------------------------------------------------------------------- */

let torCache: { nodes: Set<string>; fetchedAt: number } | null = null;
const TOR_TTL_MS = 60 * 60 * 1000;

/**
 * Fetches the authoritative Tor exit list. Cached for an hour in module scope.
 * Never throws: if the list is unavailable we report "not Tor" rather than
 * blocking legitimate users.
 */
export async function isTorExitNode(ip: string): Promise<boolean> {
  if (!ip) return false;
  const now = Date.now();

  if (!torCache || now - torCache.fetchedAt > TOR_TTL_MS) {
    try {
      const response = await fetch("https://check.torproject.org/torbulkexitlist", {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (response.ok) {
        const text = await response.text();
        const nodes = new Set(
          text
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#")),
        );
        torCache = { nodes, fetchedAt: now };
      }
    } catch {
      // keep the previous cache if we have one
      if (!torCache) return false;
    }
  }

  return torCache?.nodes.has(ip) ?? false;
}

/* -------------------------------------------------------------------------- */
/*                                 Public API                                 */
/* -------------------------------------------------------------------------- */

export async function getIpIntel(ip: string | null | undefined): Promise<IpInfo | null> {
  if (!ip || isPrivateIp(ip)) return null;

  // 1. cache
  try {
    const [cached] = await db
      .select()
      .from(ipIntel)
      .where(eq(ipIntel.ip, ip))
      .limit(1);

    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return {
        ip: cached.ip,
        country: cached.country,
        region: cached.region,
        city: cached.city,
        latitude: cached.latitude,
        longitude: cached.longitude,
        asn: cached.asn,
        org: cached.org,
        isVpn: cached.isVpn,
        isTor: cached.isTor,
        isProxy: cached.isProxy,
        isDatacenter: cached.isDatacenter,
        riskScore: cached.riskScore,
      };
    }
  } catch {
    // cache is best-effort
  }

  // 2. provider
  const info = (await lookupIpinfo(ip)) ?? (await lookupIpApi(ip));
  if (!info) return null;

  if (!info.isTor && (await isTorExitNode(ip).catch(() => false))) {
    info.isTor = true;
    info.riskScore = Math.min(100, info.riskScore + 60);
  }

  // 3. persist
  try {
    await db
      .insert(ipIntel)
      .values({
        ip: info.ip,
        country: info.country,
        region: info.region,
        city: info.city,
        latitude: info.latitude,
        longitude: info.longitude,
        asn: info.asn,
        org: info.org,
        isVpn: info.isVpn,
        isTor: info.isTor,
        isProxy: info.isProxy,
        isDatacenter: info.isDatacenter,
        riskScore: info.riskScore,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: ipIntel.ip,
        set: {
          country: info.country,
          region: info.region,
          city: info.city,
          latitude: info.latitude,
          longitude: info.longitude,
          asn: info.asn,
          org: info.org,
          isVpn: info.isVpn,
          isTor: info.isTor,
          isProxy: info.isProxy,
          isDatacenter: info.isDatacenter,
          riskScore: info.riskScore,
          fetchedAt: new Date(),
        },
      });
  } catch {
    // persistence is best-effort
  }

  return info;
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function locationLabel(info: IpInfo | null): string | null {
  if (!info) return null;
  const parts = [info.city, info.region, info.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function providerConfigured(): boolean {
  return Boolean(process.env.IPINFO_TOKEN || process.env.ABUSEIPDB_API_KEY);
}
