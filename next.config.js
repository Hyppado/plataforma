/** @type {import('next').NextConfig} */
const nextConfig = {
  // ---------------------------------------------------------------------------
  // Server external packages — not bundled by webpack (resolved at runtime)
  // ---------------------------------------------------------------------------
  experimental: {
    serverComponentsExternalPackages: ["@vercel/blob"],
  },
  // ---------------------------------------------------------------------------
  // Security headers
  // Applied to all routes. Routes matched by middleware.ts (/, /dashboard/*,
  // /api/admin/*) receive a nonce-based CSP from middleware that overrides
  // the static one below. The static CSP here is a fallback for unmatched
  // routes (/login, /recuperar, /api/*, etc.).
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            // Fallback CSP for routes not covered by middleware.
            // Middleware-matched routes override this with a nonce-based policy
            // (no unsafe-inline for scripts).
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://*.public.blob.vercel-storage.com",
              "media-src 'self' https://*.public.blob.vercel-storage.com",
              "connect-src 'self' https://fonts.googleapis.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Specific hostnames kept for explicitness alongside wildcard patterns
      { protocol: "https", hostname: "p16-sign-sg.tiktokcdn.com" },
      { protocol: "https", hostname: "p16-sign-va.tiktokcdn.com" },
      { protocol: "https", hostname: "p77-sign-sg.tiktokcdn.com" },
      { protocol: "https", hostname: "p19-sign.tiktokcdn-us.com" },
      { protocol: "https", hostname: "*.tiktokcdn.com" },
      { protocol: "https", hostname: "*.tiktokcdn-us.com" },
    ],
  },
  // ---------------------------------------------------------------------------
  // Public environment variables — accessible in client components
  // ---------------------------------------------------------------------------
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },
};

module.exports = nextConfig;
