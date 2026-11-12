# NEWHUB deployment and setup

## Current state
- GitHub: https://github.com/saeedrib/Newhub
- Supabase project: NEWHUB (`gwjajtiagesuzbyxmooq`), active and healthy.
- Database tables, RLS and restricted rewards functions are installed.
- Edge Function `newhub-api` is deployed with JWT verification enabled.
- Frontend files: `index.html`, `app.js`.
- Vercel deployment is not yet completed.

## Vercel
1. Sign in to Vercel and import the GitHub repository.
2. Framework preset: **Other**.
3. Leave Build Command and Install Command blank.
4. Set Output Directory to `.`.
5. Deploy.

## Current reward settings
- Tap reward: 2 points.
- Cooldown: 10 seconds.
- Daily tap cap: 100.
- Referral signup bonus: 15 points (not credited yet).
- Referral milestone: 50 referrals for 1,000 points (not credited yet).
- Minimum withdrawal request: 4,000 points.

Referral bonuses remain disabled until referral qualification and anti-fraud rules are confirmed. Withdrawal requests are not cash payments; confirm the point-to-naira rate and payout process first.

## Admin
There is no public admin registration. Assign the administrator role only after confirming the admin email. Never trust user-editable metadata for admin access.

## Security
The browser uses only the publishable key. The Edge Function validates the signed-in user and uses the server-side secret key. RLS is enabled and points are written through restricted server-side functions.
