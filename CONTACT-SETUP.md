# Contact form delivery

The contact form sends through **Resend**, with Cloudflare Pages hosting its
`/api/contact` endpoint. Google Workspace continues to handle incoming church mail.
No Workers Paid subscription or Cloudflare Email Routing is required.

- From: `website@pillarcbc.org`
- To: `info@pillarcbc.org` (fixed on the server)
- Reply-To: the visitor's validated email address

The verified Resend domain authorizes this sender; it does not require creating a
Google mailbox for `website@pillarcbc.org`. Resend processes email contents for
delivery. The application does not log or store message contents or email addresses.

## Account setup

The following were observed in the dashboard during setup:

- `pillarcbc.org` is Verified in Resend, with Sending enabled and Receiving disabled.
- Resend's `resend._domainkey` TXT and `rsend`/`send` CNAME records are verified and
  present in Cloudflare. Use the actual records Resend provides, not generic examples.
- Google MX (`smtp.google.com`), SPF and DKIM records remain present.
- `RESEND_API_KEY` is saved as a Secret in the `pillarcbc` Pages Production settings.
  Its value has not been read back or used in a deployed delivery test.

Keep Google's existing email DNS records. Do not enable Cloudflare routing on the
root domain. Use a Resend key with Sending access restricted to `pillarcbc.org`.

## Remaining Cloudflare configuration

### Turnstile

Create a Managed widget named `Church contact form` with hostnames `pillarcbc.org`
and `www.pillarcbc.org`. Save the public site key and secret key in the Pages
Production settings below. The server verifies hostname and the `contact` action.
Never put either API credentials or Turnstile secret keys in source code or chat.

### Submission throttling

Create a Workers KV namespace named `pillarcbc-contact-abuse`. In **Workers &
Pages → pillarcbc → Settings → Bindings**, add a KV namespace binding whose
variable name is **CONTACT_ABUSE**, pointing to that namespace.

KV stores daily-salted IP hashes with short-lived counters (120-second expiry),
not names, raw IPs, email addresses or messages. The coarse limit is five attempts
per minute per IP. KV is eventually consistent: this is not an atomic global
quota and does not guarantee exactly-once delivery. Turnstile is always required.

### Production variables and secrets

Under **Workers & Pages → pillarcbc → Settings → Variables and Secrets**, select
**Production** and configure:

| Name | Type | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Already saved; Resend Sending access key |
| `TURNSTILE_SITE_KEY` | Text | Production widget's public site key |
| `TURNSTILE_SECRET_KEY` | Secret | Production widget's secret key |
| `CONTACT_ALLOWED_HOSTNAMES` | Text | `pillarcbc.org,www.pillarcbc.org` |
| `CONTACT_FORM_ENABLED` | Text | `true` only when setup and publication are ready |

`CONTACT_ABUSE` is a KV binding, not a text variable. No `CF_ACCOUNT_ID` or
`CF_EMAIL_API_TOKEN` is used by this endpoint. Missing settings leave the form
unavailable with direct-email links in all three languages. Disable submissions
by setting `CONTACT_FORM_ENABLED=false` and redeploying.

Bindings and secrets take effect on a subsequent deployment. Keep the production
branch set to `live`, build command `npm run build`, output directory `_site`.
Pages discovers the root `functions/` directory. `_routes.json` limits Function
invocations to `/api/contact`; other pages remain static.

## Preview and publication

Production secrets are separate from Preview. Leave previews disabled by default.
For a deliberately enabled feature preview, configure its exact hostname, a
separate Turnstile widget and KV namespace, and a separate domain-scoped Resend
key in Preview. Preview settings may be shared across branches; authorize only
the exact preview hostname being tested. Do not use production Turnstile test
keys to bypass verification. Enabled previews send real notifications to the fixed
church inbox, so coordinate the test with its administrator.

1. Run `npm run check`: tests, content validation, production/preview builds and
   generated-site checks. API tests mock all delivery calls; they send no email.
2. Review the feature preview in all three languages, including mobile layout,
   unavailable states and failed submissions. With enabled preview configuration,
   have an administrator submit a clearly labeled test message and verify the
   actual inbox, spam folder and Reply-To behavior.
3. Merge the reviewed PR to `main`. Publish the exact reviewed commit using the
   existing **Publish website** workflow; never push directly to `live`.
4. Confirm the Cloudflare deployment succeeded, `/api/contact` returns `ready`
   without revealing secrets, and an administrator test reaches the Google inbox.
   A Resend message ID means accepted for delivery, not confirmed inbox arrival.

Failed sends preserve the entered fields. Sends are not automatically retried:
a timed-out request may already have been accepted. The browser blocks duplicate
clicks during sending and after acceptance. Repeated intentional submissions or
a manual retry after an ambiguous timeout can still produce duplicate emails.

## References

- [Resend send API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Cloudflare DNS guide](https://resend.com/docs/guides/dns/cloudflare)
- [Cloudflare Pages secrets and bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
