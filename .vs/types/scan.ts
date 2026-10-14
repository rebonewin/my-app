export interface SecurityHeaders {
  hsts: string | null;
  csp: string | null;
  xfo: string | null;
  xcto: string | null;
  referrer: string | null;
  permissions: string | null;
}


export interface CookieAnalysis {
  present: boolean;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}


export interface CorsAnalysis {
  origin: string | null;
  credentials: string | null;
  methods: string | null;
  headers: string | null;
  risk: string;
}


export interface RobotsAnalysis {
  found: boolean;
  url: string;
  size: number;
  disallowCount: number;
  sitemap: boolean;
}


export interface ClickjackingAnalysis {
  protected: boolean;
  severity: "None" | "Medium";
  reason: string;
}


export interface SSLAnalysis {
  enabled: boolean;
  valid: boolean;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  protocol: string;
}


// ===============================
// Port Scanner Interface
// ===============================

export interface PortAnalysis {
  port: number;
  service: string;
  status: string;
  risk: string;
}




export interface ScanResult {

  url: string;

  status: number;

  responseTime: number;

  https: boolean;


  server: string;

  contentType: string;

  poweredBy: string;

  cacheControl: string;

  contentLength: string;



  securityHeaders: SecurityHeaders;


  missingHeaders: string[];


  securityScore: number;



  cookieAnalysis: CookieAnalysis;


  cors: CorsAnalysis;


  robots: RobotsAnalysis;


  clickjacking: ClickjackingAnalysis;


  ssl: SSLAnalysis;



  // New Feature
  // Port & Service Detection

  ports: PortAnalysis[];

}