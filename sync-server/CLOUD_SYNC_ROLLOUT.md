# Pink Live Cloud Sync — staging rollout

Status: **feature branch only**. Do not merge into main until an end-to-end test on iPhone and Windows has succeeded.

## Architecture

- GitHub Pages PWA keeps the original `pinkLive.douyin.daily.v1` localStorage records. Cloud sync is opt-in; logging out never deletes them.
- Supabase Auth email/password session with a **publishable** browser key. No service-role or database secret in public files.
- `public.live_records` has per-user row-level security. Date is unique per user.
- A successful sync uploads local-only records, downloads remote-only records, and for changed dates compares timestamps. Before remote replacements, the phone stores local snapshots in `pinkLive.sync.premerge.v1` and conflict details in `pinkLive.sync.conflicts.v1`. This is **not** a full conflict-resolution UI.
- Windows `cloud_pull.py` authenticates as the same user, fetches cloud rows, stores a history of replaced records, and creates a daily SQLite snapshot in `D:\PinkLive\backups`. DPAPI encrypts refresh credentials under the current Windows account.

## Required one-time owner setup

1. In Supabase Dashboard > Authentication > URL Configuration, set **Site URL** to `https://my283104.github.io/pink-live-assistant/`, and add the same URL to Redirect URLs. This cannot currently be configured by the connected Supabase tools.
2. In Authentication > Providers > Email, confirm email/password sign-in and signup are enabled. Supabase's default email delivery limits and verification requirements apply.
3. Test signup, confirmation, login and sync on a non-production browser profile before enabling on the iPhone. Avoid sharing passwords or access tokens.
4. After verified tests, merge this PR into `main`. The live PWA should load the new script and new service-worker cache on subsequent reloads.
5. On the Windows 10 computer, launch PowerShell as the normal account, download `sync-server/install-cloud-sync.ps1` from the trusted repository and review/run it. The installer downloads `cloud_pull.py` from `main` after merge, requests the cloud email/password once, runs an initial pull, and creates a 15-minute scheduled task that runs while that Windows account is logged in. No phone app installation is required.

## Important limits

- This is a web PWA. iOS may suspend background activity; offline edits synchronize **when the app is opened/foregrounded and network is available**, not guaranteed while fully closed.
- Cloud data is not yet replicated to Windows until Windows installer/login is run successfully.
- The current sync algorithm keeps conflict snapshots but does not offer manual merge controls; a newer timestamp normally wins. Before production, test simultaneous edits on the same date and recovery from snapshots.
- Never clear Safari website data before verifying cloud backup and Windows restore.
- Password recovery, server-side rate limits, pagination above 10,000 phone records, and a full restore workflow are not implemented.
