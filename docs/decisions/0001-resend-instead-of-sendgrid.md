# 0001 – Send emails with Resend instead of SendGrid

- Status: accepted
- Date: 2026-11-14

## Context

The app sent emails through SendGrid. SendGrid dropped its free plan in 2025; new
accounts get a 60-day trial only. Our trial ended on 2026-01-09, and the November 2026
draw failed on the first email with `401 Maximum credits exceeded`. Continuing would
cost about $19.95/month (Essentials) to send a handful of emails once a year.

## Decision

Use [Resend](https://resend.com) through its REST API (`fetch`, no SDK dependency).
Its free plan is permanent and needs no card: 100 emails/day, 3,000/month, which covers
a family draw many times over. The sender domain is verified in Resend with the DNS
records its dashboard lists (a DKIM TXT record and CNAME records for sending).

## Consequences

- Env vars: `RESEND_API_KEY`, `EMAIL_FROM` replace `SENDGRID_API_KEY`, `SENDGRID_FROM`.
- Inline image still works (`content_id` attachment, `cid:` in HTML).
- A "Sending access" key can't read anything, so the start-up check only confirms the
  key is valid. A "Full access" key also lets the app confirm the sender domain is verified.
- Every send carries an `Idempotency-Key` derived from the draw code and recipient, so a
  retry after a timeout can't deliver the same email twice.
- The old SendGrid DNS records (`emNNNN`, `s1/s2._domainkey` CNAMEs) can be removed.
- If Resend's free plan disappears, check the provider's current pricing first: the
  email code is isolated in `src/services/EmailService.ts`.
