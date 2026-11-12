# NEWHUB implementation notes

## Repository
- Static mobile-first homepage: `index.html`
- Initial database schema proposal: `supabase/schema.sql`

## Important status
The landing page is published in GitHub, but the live app is **not yet a functioning rewards platform**. Authentication, tap awards, referrals, wallet balances, withdrawals and admin actions require a dedicated Supabase project plus server-side functions and verified deployment.

## Supabase
Create a **separate project just for NEWHUB**. Do not reuse the Student Loan, Celebrity Chat, or other existing project because their data and access rules are unrelated. Review `supabase/schema.sql` before applying it. The schema intentionally does not allow browsers to write points or tap claims directly.

Use only the Supabase publishable key in browser code. Never put a service-role/secret key in GitHub or Vercel client-side variables.

## Vercel
Import https://github.com/saeedrib/Newhub. Framework preset: Other. Build command: leave blank. Output directory: `.`. Install command: leave blank.

## Product rules to confirm before launch
Draft settings discussed: 2 points per eligible tap; 50 qualified referrals for a 1,000-point inviter bonus; new referred user receives 15 points; withdrawal minimum 4,000 points. These are proposed rules, not live rewards. Define tap cooldown/daily cap, what qualifies a referral, point-to-cash conversion, payout provider, fees and fraud review before enabling withdrawals.

## Admin safety
Never trust a role stored in user-editable metadata or local storage. Assign admin in the database and enforce every admin action on the server. Do not ship a public admin signup.
