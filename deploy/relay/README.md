# Pink Live optional mainland-access relay (not deployed)
This is a narrow, stateless HTTPS reverse proxy for the existing Supabase authentication and live_records REST APIs. It does not contain a service_role key and does not bypass Supabase RLS.

## Deployment
1. Create a free Cloudflare Workers project and deploy worker.js.
2. Verify its HTTPS endpoint is reachable on the actual mainland mobile network **without VPN**. Cloudflare workers.dev may not be reachable; do not assume it works.
3. Update the `PROXY_URL` constant in the repository root `sync.js` to the verified HTTPS origin (no trailing slash), commit and redeploy the PWA.
4. Test sign-in, one record upload, cloud row count, and second-device download before considering the migration complete.
5. For a stable mainland deployment, evaluate a domestic provider with an ICP-filed custom domain. Tencent EdgeOne Pages default preview domains are not stable permanent mainland URLs.

Security: Only the known Auth routes and live_records table are forwarded. Browser origins are restricted to the production GitHub Pages origin. If deploying the frontend on a new origin, add it to ALLOWED_ORIGINS. Keep Supabase RLS enabled. Never place Supabase service_role/secret keys in the Worker or frontend.
Rollback: Set PROXY_URL back to an empty string to use direct Supabase access.
