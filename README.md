# NEWHUB

NEWHUB is a mobile-first rewards platform concept: **Tap • Earn • Invite**.

## Current status
- Initial responsive landing page is in `index.html`.
- This is the public-facing starter page only. Signup, point balances, referrals, wallet and withdrawals are **not live yet**.
- No real points or cash rewards are issued by this static page.

## Planned build
1. Secure authentication and user profiles using Supabase Auth.
2. Database tables and server-side rules for points, tap limits and referral tracking.
3. User dashboard, tap activity, referral page and wallet history.
4. Admin dashboard with role-based access.
5. Optional Monetag placements that do not block users or force ad views.
6. Vercel deployment and environment configuration.

## Deployment
This is a static HTML site and can be deployed on Vercel by importing this repository. No build command is required; the project root is the output directory.

## Security notes
- Never put a Supabase service-role key or other secret in browser code.
- Point awards, referral qualification and withdrawals must be validated server-side.
- Admin permissions must be enforced by database policies/server-side checks, not by hiding buttons in the UI.
