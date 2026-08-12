CORS and redirect guidance for CA Smart Staycation

This document explains recommended server/CDN settings to avoid CORS failures
when browsers request the API and are redirected between non-www and www
hosts.

Problem summary
- Browsers enforce CORS when a page (origin A) requests a resource at origin B.
- If the request to origin B is redirected (3xx) to origin C, the browser may
  block the request unless the final response (or the redirect response when
  applicable) includes appropriate CORS headers.
- Some CDNs or host-level redirects (Cloudflare, Vercel, nginx at the edge)
  may not forward custom CORS headers or may issue redirects before the
  application code executes, which causes the browser to see a response
  without Access-Control-Allow-Origin.

Fast fixes we already applied
- Frontend: prefer same-origin requests (window.CA_SMART_API || '/api'), so
  the browser doesn't perform cross-origin requests from www → non‑www.
- Backend: API functions set Access-Control-Allow-Origin for allowed origins
  and add preflight/cache headers. This helps when requests reach the function.

Recommended hardening steps (server/CDN)
1) Choose a canonical host and enforce it at the CDN or edge
   - Prefer one origin (https://www.casmartstaycation.com or https://casmartstaycation.com)
   - Implement a redirect at the edge so users always see the same origin
     (this reduces accidental cross-origin requests).

2) Preserve/emit CORS headers on redirect responses
   - Ensure that redirects (3xx) include Access-Control-Allow-Origin and related
     headers. Some servers strip custom headers on redirects by default.

   Nginx example (preserve headers on redirects):

   server {
     listen 80;
     server_name casmartstaycation.com;
     return 301 https://www.casmartstaycation.com$request_uri;

     # If you need to emit headers for clients that request the bare host,
     # use 'add_header ... always' in the receiving server block instead.
   }

   location /api/ {
     add_header 'Access-Control-Allow-Origin' 'https://www.casmartstaycation.com' always;
     add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
     add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
     add_header 'Access-Control-Allow-Credentials' 'true' always;
     proxy_pass http://backend_upstream;
   }

3) Cloudflare / Vercel notes
   - Cloudflare: Page Rules or Workers can add headers on redirects. If using
     Cloudflare, make sure the redirect response includes the CORS headers or
     perform the redirect in a Worker which sets them explicitly.
   - Vercel: redirects configured in vercel.json are applied before serverless
     functions execute; if you rely on functions to set CORS headers, consider
     performing redirects at the application level or ensuring both domains are
     allowed by the browser-facing origin and CDN configuration.

4) If you need to allow cross-origin API access from multiple hosts
   - Update backend allowed origins to include those hosts and ensure
     Access-Control-Allow-Credentials and Access-Control-Allow-Origin are set
     correctly. Do NOT use '*' if you require credentials.

5) Testing
   - Use curl to verify responses and preflight handling:
     curl -I -X OPTIONS https://www.casmartstaycation.com/api/rooms \
       -H "Origin: https://www.casmartstaycation.com" \
       -H "Access-Control-Request-Method: GET"

   - Confirm redirect responses include Access-Control-Allow-Origin when the
     initial request hits the non-canonical host.

If you want, I can prepare example nginx or Cloudflare Worker configs tailored to
your hosting provider — tell me where you host the site (Vercel, Render,
Cloudflare, nginx on a VM, etc.) and whether you use server-level redirects or
DNS/CDN rules for www ↔ non‑www.
