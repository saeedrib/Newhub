# NEWHUB

NEWHUB is a mobile-first rewards app: **Tap • Earn • Invite**.

## Implemented
- Responsive signup and login using Supabase Auth.
- Member dashboard, wallet balance and point ledger.
- Server-side tap rewards: 2 points per tap, 10-second cooldown, 100 taps per day.
- Personal referral link and referral registration tracking.
- Withdrawal requests with 4,000-point minimum and bank transfer details.
- Admin-only withdrawal review API and dashboard interface (admin role must be assigned securely).
- Supabase Edge Function `newhub-api`; secret key stays server-side.
- Row Level Security enabled on all public tables.

## Launch limitations
- Referral signup and milestone bonuses are settings only; crediting is not enabled until qualification and anti-fraud rules are confirmed.
- Withdrawal requests reserve points and enter review; they do not send money. Confirm point-to-naira conversion, payout provider and fees before real payouts.
- Supabase email confirmation may be enabled, so users may need to confirm email before signing in.
- Vercel deployment is not yet completed.

## Deploy
Import https://github.com/saeedrib/Newhub into Vercel. Framework preset: Other; leave build and install commands blank; output directory `.`. Never add a Supabase secret/service-role key to browser code.
