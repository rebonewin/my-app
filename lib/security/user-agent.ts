/**
 * User-agent parsing.
 *
 * Written by hand rather than pulled from a dependency: the surface we need is
 * small, and this keeps the auth bundle lean. Order matters — Edge and Opera
 * both claim to be Chrome, Chrome claims to be Safari.
 */

export interface ParsedUserAgent {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  isBot: boolean;
}

const BOTS =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|headlesschrome|phantomjs|selenium|puppeteer|playwright|curl\/|wget\/|python-requests|go-http-client|okhttp|postmanruntime|insomnia|axios\/|node-fetch|undici/i;

interface Rule {
  name: string;
  regex: RegExp;
  versionIndex?: number;
}

const BROWSERS: Rule[] = [
  { name: "Edge", regex: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Opera", regex: /(?:OPR|Opera)\/([\d.]+)/ },
  { name: "Samsung Internet", regex: /SamsungBrowser\/([\d.]+)/ },
  { name: "Brave", regex: /Brave\/([\d.]+)/ },
  { name: "Vivaldi", regex: /Vivaldi\/([\d.]+)/ },
  { name: "Firefox", regex: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: "Chrome", regex: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: "Safari", regex: /Version\/([\d.]+).*Safari/ },
  { name: "Internet Explorer", regex: /(?:MSIE |rv:)([\d.]+).*Trident/ },
];

const OSES: Rule[] = [
  { name: "Windows", regex: /Windows NT ([\d.]+)/ },
  { name: "macOS", regex: /Mac OS X ([\d_.]+)/ },
  { name: "iOS", regex: /(?:iPhone|iPad|iPod).*OS ([\d_]+)/ },
  { name: "Android", regex: /Android ([\d.]+)/ },
  { name: "ChromeOS", regex: /CrOS \w+ ([\d.]+)/ },
  { name: "Linux", regex: /Linux/ },
  { name: "FreeBSD", regex: /FreeBSD ([\d.]+)/ },
];

function windowsVersion(nt: string): string {
  switch (nt) {
    case "10.0":
      return "10 / 11";
    case "6.3":
      return "8.1";
    case "6.2":
      return "8";
    case "6.1":
      return "7";
    case "6.0":
      return "Vista";
    case "5.1":
      return "XP";
    default:
      return nt;
  }
}

function major(version: string): string {
  return version.split(".")[0] ?? version;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return {
      browser: "Unknown",
      browserVersion: "",
      os: "Unknown",
      osVersion: "",
      deviceType: "unknown",
      isBot: false,
    };
  }

  if (BOTS.test(ua)) {
    return {
      browser: "Bot",
      browserVersion: "",
      os: "Unknown",
      osVersion: "",
      deviceType: "bot",
      isBot: true,
    };
  }

  let browser = "Unknown";
  let browserVersion = "";
  for (const rule of BROWSERS) {
    const match = ua.match(rule.regex);
    if (match) {
      browser = rule.name;
      browserVersion = major(match[1] ?? "");
      break;
    }
  }

  let os = "Unknown";
  let osVersion = "";
  for (const rule of OSES) {
    const match = ua.match(rule.regex);
    if (match) {
      os = rule.name;
      const raw = (match[1] ?? "").replace(/_/g, ".");
      osVersion = os === "Windows" ? windowsVersion(raw) : major(raw);
      break;
    }
  }

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    deviceType = "tablet";
  } else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) {
    deviceType = "mobile";
  }

  return { browser, browserVersion, os, osVersion, deviceType, isBot: false };
}

export function describeDevice(ua: string | null | undefined): string {
  const parsed = parseUserAgent(ua);
  const parts: string[] = [];
  if (parsed.browser !== "Unknown") {
    parts.push(
      parsed.browserVersion
        ? `${parsed.browser} ${parsed.browserVersion}`
        : parsed.browser,
    );
  }
  if (parsed.os !== "Unknown") {
    parts.push(
      parsed.osVersion ? `${parsed.os} ${parsed.osVersion}` : parsed.os,
    );
  }
  return parts.join(" on ") || "Unknown device";
}
