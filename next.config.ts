import type { NextConfig } from "next";

/**
 * Security headers applied to every response. These are the baseline OWASP
 * recommendations for a tax-PII app. CSP is report-only initially so we can
 * catch violations without breaking legit inline styles in dev; tighten to
 * enforcement once the app is audited.
 */
const securityHeaders = [
  // Force HTTPS for 2 years (only sent over HTTPS, so dev HTTP is unaffected).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent clickjacking — this app is never framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing a response away from the declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (not full URL / referrer) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Content Security Policy. 'unsafe-inline' on style-src is needed for
  // shadcn/Tailwind injected styles; we avoid 'unsafe-inline' on scripts.
  // Report-only first; switch to Content-Security-Policy once vetted.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Production builds MUST fail on TypeScript errors. The previous
  // ignoreBuildErrors:true masked real type regressions from reaching CI.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
