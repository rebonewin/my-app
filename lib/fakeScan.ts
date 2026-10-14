export function fakeScan(url: string) {
  return {
    url,
    ip: "192.168.1.10",
    server: "Apache/2.4.57",
    https: true,
    ports: [80, 443],
    vulnerabilities: {
      critical: 2,
      high: 5,
      medium: 8,
      low: 12,
    },
    securityScore: 82,
  };
}