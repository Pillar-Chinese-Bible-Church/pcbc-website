# Pillar Chinese Bible Church website · 柱石华人圣经教会

The website of Pillar Chinese Bible Church, in Simplified Chinese, Traditional Chinese and English.

| | Address |
| --- | --- |
| Live site | https://pillarcbc.org |
| Shared preview after merging to `main` | https://main.pillarcbc.pages.dev |
| Edit content | https://app.pagescms.org |
| Code | https://github.com/Pillar-Chinese-Bible-Church/pcbc-website |

Church volunteers change the text and photos through **Pages CMS**, which shows web forms and needs no coding.
Use an editing branch in Pages CMS and open a PR to `main`; direct saves to protected `main` are blocked.
Changes appear on the branch preview, then the shared main preview after merging. They reach the live site only when someone presses **Publish website**.

Editors who just want to change content can read the Chinese guide in [EDITING.md](EDITING.md).
This README is for whoever looks after the site.

---

## Contents

- [What's on the site](#whats-on-the-site)
- [How changes go live](#how-changes-go-live)
- [Common tasks](#common-tasks)
- [How the content files work](#how-the-content-files-work)
- [Languages](#languages)
- [Photos](#photos)
- [Run it on your computer](#run-it-on-your-computer)
- [Project layout](#project-layout)
- [Accounts and services](#accounts-and-services)
- [Setting it up from scratch](#setting-it-up-from-scratch)
- [Troubleshooting](#troubleshooting)
- [Still to do](#still-to-do)
- [Events and preview examples](#events-and-preview-examples)
- [Contact page](#contact-page-form-only)
- [Giving page](#giving-page)
- [Engineering checks and content contracts](#engineering-checks-and-content-contracts)
- [About Us page](#about-us-page)
- [Removing expired events](#removing-expired-events)

---

## What's on the site

Each language has the following pages:

| Page | 简体 | 繁體 | English |
| --- | --- | --- | --- |
| Homepage | `/` | `/zh-hant/` | `/en/` |
| About Us / 关于我们 | `/about/` | `/zh-hant/about/` | `/en/about/` |
| Event detail (upcoming enabled entries) | `/events/<slug>/` | `/zh-hant/events/<slug>/` | `/en/events/<slug>/` |
| 信仰告白 / What We Teach | `/teach/` | `/zh-hant/teach/` | `/en/teach/` |
| Contact | `/contact/` | `/zh-hant/contact/` | `/en/contact/` |
| Giving | `/giving/` | `/zh-hant/giving/` | `/en/giving/` |

The homepage has the welcome photo, Sunday worship details, the weekly gatherings,
the 1 Timothy 3:15 verse the church is named after, a scrolling photo strip, and the church's values.
The About Us page brings together the church introduction, mission, pastor details, and Church Life photos/text.
The 信仰告白 page lists the statement of faith with Bible references.

The layout follows City Light Bible Church's site, with the friendlier photo sections of Olive Tree
(aaotcc.org). The text is set in a light Song typeface (Noto Serif SC / TC). English pages use Noto Serif.

## How changes go live

### Preview a proposed code change without merging

Create a feature branch from `main`, push it, and open a pull request targeting
`main`. The documented Cloudflare setting **All non-Production branches** builds
the feature branch into its own preview. Find the exact preview URL in the
Cloudflare check on the PR, or under **pillarcbc → Deployments** for that branch.
This does not change either `main.pillarcbc.pages.dev` or the live website.
If no preview appears, check branch controls and the deployment build log.

Review all three languages, mobile navigation, 信仰告白, event details, and images
on that preview. Do not run **Publish website** to generate a feature preview.
Merging a PR changes the shared `main` preview; the separate publish workflow
still controls `live`.

### Content publishing

```text
Pages CMS / Dashboard → editing branch → PR + passing checks → main
                                                              │
                                     Cloudflare → main preview
                                                              │
                               "Publish website" (reviewed SHA)
                                                              ▼
                                                            live
                                                              │
                                      Cloudflare → live website
```

| Branch | What it is | Address |
| --- | --- | --- |
| `main` | Validated code and content PRs merge here; shared preview | https://main.pillarcbc.pages.dev |
| `live` | The real site | https://pillarcbc.org |

**To publish:** review the Cloudflare preview for a commit on `main` and copy its full
40-character commit SHA. On GitHub open **Actions → Publish website → Run workflow**,
select `main`, and paste that SHA into `commit_sha`. The workflow installs with Node 22,
runs tests and checks both production and feature-preview builds, then fast-forwards
`live` to **that exact validated revision**. New changes to `main` do not alter the selected
revision. A failed check stops publication. Check Cloudflare for deployment success; a Git
push alone does not mean the deployment finished. Feature-branch revisions must first be
merged into `main` before they can be published.

- Only people with write access to the GitHub repository can press the button, so it also works as the
  approval step. Editors invited to Pages CMS by email can't publish.
- Never push to `live` directly. The button only moves `live` forward, and it stops with an error if `live`
  has changes that aren't on `main`.
- Cloudflare marks previews "noindex", so search engines don't list them.

**To undo a published change**, either fix it on an editing branch, merge the checked PR, and publish again, or in Cloudflare open the
**pillarcbc** project → **Deployments**, choose an earlier Production deployment and click **Rollback**.

## Common tasks

Most of these are done in Pages CMS. Save to an editing branch and review its preview, then merge the checked PR to update the shared preview. Publish separately to update the live site.

| I want to… | Where |
| --- | --- |
| Change the Sunday time, address, email or social links | Pages CMS → **基本信息 Basics** |
| Add, remove or reorder a weekly gathering | Pages CMS → **首页 Homepage** → 每周聚会 |
| Change the welcome photo or text | Pages CMS → **首页 Homepage** → 顶部大图 |
| Update the pastor or Church Life sections | Pages CMS → **关于我们 About Us** |
| Add or edit an event | Pages CMS → **活动 Events** → `items` |
| Update giving instructions or the QR image | Pages CMS → **奉献 Giving** (verify recipient text and QR together) |
| Add or remove photos in the scrolling strip | Pages CMS → **照片墙 Photo strip** |
| Edit the statement of faith | Pages CMS → **信仰告白 Statement of faith** (have the pastor or elders review it) |
| Fix a wrong Traditional Chinese character | Type the correct text in that field's **繁體** box (see [Languages](#languages)) |
| Change menu or button wording ("了解更多", "Menu"…) | Code: `src/_data/ui.js` |
| Change colors, fonts or layout | Code: `src/_includes/styles/` (combined into one stylesheet) |
| Add a new page | Code: a new template in `src/` (copy `teach.njk`), plus a menu link in `src/_includes/base.njk` and an entry in `src/sitemap.njk` |

Gathering times are entered once. They appear both in the weekly boxes and in the footer.

## How the content files work

Page content lives in YAML files in `src/_data/`. Pages CMS edits them through forms, but they can also be edited by hand.

| File | Contents |
| --- | --- |
| `site.yml` | Church name, address, map link, email, Sunday worship, social links, footer note |
| `homepage.yml` | Welcome section, Sunday section, weekly gatherings, verse, values |
| `about.yml` | Church introduction, mission, pastor details and Church Life |
| `photos.yml` | The scrolling photo strip |
| `events.yml` | Events section heading and introduction |
| `../../content/events.yml` | Canonical events collection, including detail-page content |
| `beliefs.yml` | 信仰告白 / What We Teach |
| `giving.yml` | Giving instructions and recipient details |

Every piece of text has up to three versions:

```yaml
name:
  zh: 青年团契            # 简体 (required)
  hant: 青年團契          # 繁體 (optional, converted from zh when left out)
  en: Youth Fellowship    # English (required for required copy)
```

Text that should break onto a new line (the welcome title and the verse) uses a YAML block with real line breaks.

The forms Pages CMS shows are defined in `.pages.yml`. If you add a field to a YAML file, add it to `.pages.yml`
too, or editors won't see it.

## Languages

**First visit to `/`.** `src/lang.njk` generates `/assets/lang.js`, loaded only on the default homepage. It sends visitors to the language their browser prefers:
zh-TW / zh-HK / zh-MO / zh-Hant → 繁體, any other Chinese → 简体, everything else → English.
User agents matching the script's bot/crawler pattern are not redirected; explicit language URLs are never redirected.

**After that.** The 简 / 繁 / EN links in the menu save the visitor's choice in their browser. Someone who
chose 繁 or EN and types the bare address is taken to that language. A link to a specific page always opens as shared.

**Traditional Chinese.** When a `hant` box is empty, the build converts the `zh` text with
[OpenCC](https://github.com/nk2028/opencc-js) using Taiwan characters (`cn` → `tw`). The phrase-level mode isn't used,
because it changes vocabulary, for example 信息 → 資訊, which is wrong for church writing. A short list in
`eleventy.config.js` (`HANT_FIXES`) corrects characters OpenCC gets wrong, such as 裡, 捨命, 回轉 and 講台.
If a word still comes out wrong, either type the correct 繁體 for that field in Pages CMS, or add a rule to `HANT_FIXES`.

Watch out: once a `hant` box has text, it's used as is. If someone later edits the 简体, they must update or clear the 繁體 too.

**Fixed wording** (menu, labels, buttons) is written by hand for each language in `src/_data/ui.js`.

## Photos

- Photos live in `src/images/`. Content files refer to them as `/images/name.jpg`. Pages CMS uploads new photos to the same folder.
- During the build, ordinary photos are resized into several sizes and converted to WebP and JPEG
  ([eleventy-img](https://www.11ty.dev/docs/plugins/image/)). Re-encoding also **removes photo metadata,
  including GPS location**. The original giving QR (`giving-zelle.webp`) is explicitly copied unchanged and bypasses this processing.
- Every photo needs a short description (the "照片说明 / alt" field) for people who can't see images.
- Photos show real church members. Get their OK before adding close-up photos of individuals, especially children.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.12 or newer (use `.nvmrc` for Node 22).

```bash
npm ci
npm run dev
```

Open http://localhost:8080. The page reloads as you edit files. `npm run build` writes the finished site to `_site/`.

## Project layout

```
.pages.yml                    Pages CMS editing screens
.github/workflows/check.yml   Required website checks
.github/workflows/publish.yml The "Publish website" button
eleventy.config.js            Build setup: YAML data, language filters, 繁體 conversion, image resizing
src/
  _data/
    *.yml                     Page content (edited in Pages CMS)
    contact.js                Fixed contact-form wording
    langs.js                  Re-exports lib/locales.js
    ui.js                     Fixed interface wording per language
  _includes/base.njk          Shared header, language switch, footer
  _includes/styles/          Base, layout and feature CSS modules
  index.njk                   Homepage (built once per language)
  teach.njk                   信仰告白 page (built once per language)
  about.njk, contact.njk,      Other localized pages
  giving.njk
  event.njk                   Upcoming event detail pages
  lang.njk                    Generates /assets/lang.js
  sitemap.njk                 Static pages and upcoming real events
  assets/
    site.js                   Menu, event expiry/carousel, photo viewer, language choice
    contact.js                Contact form presentation (no delivery)
    giving.js                 Copy the public giving email
  images/                     Photos and the logo (logo-pillar.svg)
content/events.yml           Versioned events collection
lib/locales.js                Shared locale, URL prefix and font configuration
schemas/event-v1.schema.json  Versioned event contract for dashboard integration
scripts/check.mjs             Tests plus production/preview build and link checks
EDITING.md                    Chinese guide for content editors
```

Built with [Eleventy](https://www.11ty.dev) 3. Pages are static HTML, CSS and JavaScript; a Cloudflare Pages Function handles contact submissions.

## Accounts and services

Service accounts should belong to the church, with individual access for maintainers.

| Service | Used for | Account |
| --- | --- | --- |
| GitHub | Stores the code and content, runs the Publish button | Organization `Pillar-Chinese-Bible-Church` |
| Cloudflare Pages | Builds and hosts the site | Project **pillarcbc** in the church's Cloudflare account |
| Pages CMS | Editing screens | Sign in with the GitHub account; editors are invited by email |
| Google Fonts | Noto Serif SC / TC / Noto Serif | None needed |

Cloudflare can access only this one repository; that's set in the "Cloudflare Workers and Pages" GitHub app on the
`Pillar-Chinese-Bible-Church` organization (organization Settings → GitHub Apps).

If the repository ever moves to another account or organization, Cloudflare stops building and shows "There is an internal
issue with your … Git installation". To fix it: install the "Cloudflare Workers and Pages" app on the new owner, then in the
Cloudflare project go to Settings → Build → **Disconnect**, then **Connect** and choose the repository at its new location.
Afterwards check **Branch control**: the reconnect resets the production branch to `main`, so set it back to `live`
straight away, and if `main` was deployed as production in the meantime, roll back to the latest `live` deployment.

When someone hands over the site, transfer ownership of the GitHub repository and Cloudflare account,
or add the new person as an admin, rather than sharing passwords.

## Setting it up from scratch

Use this checklist to rebuild or move the site. Domain setup may still need configuration.

1. **GitHub.** Put this folder in a repository owned by the church. Protect `main` with pull requests and the GitHub Actions **check** status, including administrators; disallow force pushes and deletions. A review approval is optional for a sole maintainer.
2. **Cloudflare Pages.** Workers & Pages → Create → Pages → Connect to Git → choose the repository. Then:
   - Build command `npm run build`, build output directory `_site`, framework preset None.
   - Environment variable `NODE_VERSION` = `22`, for both Production and Preview.
   - Settings → Build → Branch control: production branch `live`, preview branches "All non-Production branches".
   - Create a `live` branch from `main` before switching the production branch.
3. **Pages CMS.** At https://app.pagescms.org sign in with the GitHub account, allow access to the repository and open it.
   Invite editors from the repository's settings in Pages CMS. Create/select an editing branch, save there, and open a PR to `main`. Direct saves to protected `main` will fail.
4. **Domain.** In the Cloudflare project → **Custom domains**, add the church's domain. If the domain also handles
   church email, keep its existing MX and other email records exactly as they are.

### The pillarcbc.org domain today

- **Registration:** Hostinger, in a Hostinger account shared with the site maintainer; paid until 12 August 2029.
  The transfer to Cloudflare Registrar is still to do: turn off the transfer lock and get the EPP code in Hostinger, then
  Cloudflare → **Domain Registration → Transfer Domains**.
- **DNS:** Cloudflare (nameservers `michael.ns.cloudflare.com` and `sara.ns.cloudflare.com`), zone **pillarcbc.org**.
- **Website:** `pillarcbc.org` and `www.pillarcbc.org` are custom domains on the **pillarcbc** Pages project. A redirect
  rule (**Rules → Redirect Rules → "www to pillarcbc.org"**) sends `www` to `https://pillarcbc.org`, keeping path and query.
- **Email:** Google Workspace. Keep these DNS records exactly as they are, all **DNS only**: MX `smtp.google.com` (priority 1),
  TXT `v=spf1 include:_spf.google.com ~all`, TXT `google._domainkey` (DKIM) and TXT `_dmarc`.
- Records left over from Hostinger (`ftp`, `autoconfig`, `autodiscover`, `hostingermail-a/b/c._domainkey`) are unused and can be deleted.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| A change doesn't appear on the live site | It's only on the preview until someone presses **Publish website**. |
| A change doesn't appear on the preview either | Check the editing branch deployment; the shared `main` preview changes only after merging the PR. Inspect Cloudflare build logs. |
| Pages CMS cannot save to main | Select an editing branch and open a PR; main requires passing checks. |
| A Cloudflare build failed | Open the failed deployment and read the build log. Often it's a YAML mistake (wrong indentation or a missing quote) from a hand edit. |
| "Publish website" failed | Check the full commit SHA, test/build logs, and that the commit is on `main`. A non-fast-forward `live` update is intentionally rejected. |
| A photo shows as missing in Pages CMS | Its path must start with `/images/` and the file must be in `src/images/`. |
| A Traditional Chinese character is wrong | Type the right text in that field's 繁體 box, or add a rule to `HANT_FIXES` in `eleventy.config.js`. |
| The site looks broken after a code change | Run `npm run dev` locally and check the browser console. Use Cloudflare's **Rollback** to restore the live site meanwhile. |

## Still to do

- Confirm the configured address, map, `info@pillarcbc.org`, and Sunday 9:30AM service details with the church. Social links are empty and hidden; fill them in when available.
- Build the planned message-delivery feature; the current Send button is intentionally inactive.
- Confirm the church-life details (weekend worship practice, in-person small groups, dumplings at Lunar New Year) or replace them with real ones.
- Have the pastor or elders review the 信仰告白. It follows the topics of City Light Bible Church's statement and is written fresh, not copied.
- Get the logo as a vector file (SVG, AI or PDF) from the designer. The current `logo-pillar.svg` was traced by hand from a small image.

## Events and preview examples

The homepage carousel includes every upcoming enabled event, ordered by start time,
after Sunday Worship and before weekly gatherings. Each has a shareable detail
page at `/events/<slug>/`, `/zh-hant/events/<slug>/`, and `/en/events/<slug>/`.
The existing homepage sections and 信仰告白 content are retained. The shorter photo
hero leads into a compact Sunday strip with the time, location, and directions.
Open **More Sunday information** to see the original Sunday photo and visitor/video
content. Events, weekly gatherings, and the remaining sections use tighter spacing;
all original page text, photos, verse, and values remain available.

Edit `items` in `content/events.yml` in **Pages CMS → 活动 Events**.
The section heading/intro remain in `src/_data/events.yml` under **活动栏目 Events section**. Use a unique URL
slug; Simplified Chinese, optional Traditional overrides, and English follow the
existing text convention. Images are optional. Start/end must be quoted ISO
values with an explicit timezone offset (`-08:00` in winter, `-07:00` in summer).
All display times use America/Los_Angeles. Optional registration/map URLs must
use HTTPS. `published: false` excludes an entry everywhere.

Events marked `sample: true` are clearly labeled **samples**, not church announcements. Real records use `sample: false`.
`sample: true` entries appear on Cloudflare feature-branch previews, but are
excluded from `main`, `live`, and ordinary local builds. To preview samples
locally, run `EVENTS_INCLUDE_SAMPLES=1 npm run dev`. `main` and `live` builds exclude samples
even if that override is accidentally set. For a real confirmed event, set
`sample: false`, fill in its real information, and enable it. Never convert a
sample into a real announcement without verifying its details.

Builds omit ended events from the homepage, detail pages, and sitemap. Expired URLs are removed on the next deployment.
All upcoming events are rendered, including those beyond the first three. The carousel
shows three cards on desktop, overlays a month/day badge on every header (with or without
a photo), and supports touch scrolling, keyboard navigation and
previous/next buttons. It does not auto-rotate and respects reduced-motion preferences.
Browser JavaScript also removes ended cards/registration links when an old
static deployment is visited or left open, and labels ended detail pages in older deployments.
Without JavaScript, date visibility remains as of the last build; rebuild after
events end if that fallback must be current. Delete expired records manually through the dashboard; publication remains manual.
An empty upcoming list hides the homepage events section and its navigation link.

Run `npm test` for sample/production isolation, validation, and Pacific-time tests;
run `npm run build` for a normal build or
`CF_PAGES_BRANCH=codex/website-events npm run build` to check the sample preview.
Use Node 22, as specified by `.nvmrc` and the Cloudflare build configuration.

## Contact form delivery

The contact page is available at `/contact/`, `/zh-hant/contact/`, and `/en/contact/`.
Header/footer Contact links, the statement-of-faith Contact button, and inquiry
links from Sunday, gatherings, and events route there. Inquiry links preselect a
topic and optionally show a public gathering/event title as context. Language
links retain that public inquiry context, but not personal form inputs.

The contact form posts to `/api/contact`, a Cloudflare Pages Function. It validates
fields and Turnstile before sending plain-text email through Resend to the fixed
recipient `info@pillarcbc.org`. The sender is `website@pillarcbc.org`; the visitor's
email is Reply-To. Google Workspace continues to handle the church inbox.

The standard Cloudflare Turnstile widget initializes when the contact page opens,
with its configuration and script loading in parallel. Cloudflare controls whether
verification is automatic or needs its checkbox; Send remains disabled until a
valid result arrives. There is no extra Start verification button or application
challenge deadline. The native widget handles retry and token refresh. A 15-second
resource-loading timeout offers a reload control if initialization fails. Late
callbacks from previous widgets are ignored; failed sends preserve fields and
initialize a fresh verification. No Cloudflare dashboard change is required.

The form stays disabled unless its runtime settings, Resend secret, Turnstile
keys and KV abuse-counter binding are configured. Sending, accepted, verification,
rate-limit and error messages are available in all three languages. Failed sends
preserve the typed message; repeated clicks are blocked while sending and after
acceptance. No automatic send retry is made because a timed-out request may already
have been accepted. Provider acceptance does not prove inbox delivery.

See [CONTACT-SETUP.md](CONTACT-SETUP.md) for Production and Preview configuration,
manual delivery verification and the existing Publish website workflow. Message
content is not logged or stored by the application; Resend processes the content
to deliver email. KV stores only daily-salted IP hashes and temporary counters.
The KV throttle is eventually consistent, not an atomic global quota.

Copy lives in `src/_data/contact.js`, layout in `src/contact.njk`, browser behavior
in `src/assets/contact.js`, and the endpoint in `functions/api/contact.js`.

## Giving page

Giving is available at `/giving/`, `/zh-hant/giving/`, and `/en/giving/`, linked
from the main navigation and footer. The page provides the church's Zelle
recipient (`giving@pillarcbc.org`), check payee (`Pillar Chinese Bible Church`),
stock-transfer contact (`office@pillarcbc.org`), Benevity matching instructions,
and annual-statement information. Giving questions link to the contact page with
its topic preselected. The contact form's Send action remains intentionally inactive.

Content in `src/_data/giving.yml` was adapted from the church's public giving
pages, reviewed on November 16, 2026:

- https://pillarcbc.org/奉献/
- https://pillarcbc.org/en/giving/

The original QR asset was acquired from the rendered source page's
`https://pillarcbc.org/wp-content/uploads/2026/10/Offering-edited.jpg` image.
The server returned WebP bytes, retained as `src/images/giving-zelle.webp`.
Eleventy copies this file unchanged and excludes it from photo optimization, so
the giving page and full-size link use the source QR without recompression or
redrawing. If the church changes its Zelle details, update the recipient text
and original QR asset together and check them against the church's instructions.

The copy-email action only copies the public Zelle recipient; it does not start
a payment. If clipboard access is unavailable, the address remains selectable.
All payment activity stays in the donor's own banking app. The giving page uses no payment-collection backend or provider account.


## Engineering checks and content contracts

Run `npm run check` before opening a PR. It validates required copy, essential lists, localized YAML and interface-key
parity, event types/dates/URLs, image files and CMS fields; runs regression tests; builds
both `live` and a feature preview; and checks internal links, anchors, metadata, sitemap
entries, nonempty primary headings and email links, homepage-only language-script placement,
and exclusion of samples/drafts/expired events from production. GitHub runs the same command
on PRs and pushes to `main`. Require the **check** status
from GitHub Actions on `main`, with pull requests, no force pushes, and no deletions.
Pages CMS direct saves must use a branch and PR under this policy; the dashboard already
opens content PRs. Branch protection is a repository setting and is not applied by merging code.

`schemas/event-v1.schema.json` is the shared v1 event contract. Dashboard integrations should
validate its output against it and also enforce end-after-start and unique slugs,
as `lib/content.js` and `lib/events.js` do. `published` and
`sample` are actual booleans; zh/en event copy is required; Traditional Chinese overrides
remain optional. Empty optional URLs are accepted, but nonempty links must be complete
HTTPS URLs. Keep event slugs stable: they identify each public URL.
The canonical `content/events.yml` contains `version: 1` and an `items` list. The dashboard reads the collection in one request and checks a hash of the individual event before updating the latest collection, preserving unrelated events. Publish website remains a separate manual action.

Optional `image_position: { x: 50, y: 50 }` stores event-card framing as percentages
from 0–100. Omit it for a centered crop. It requires an image; event detail pages
show the full original ratio. Dashboard integrations must preserve this optional field; production publishing remains manual.

`lib/locales.js` supplies language codes, prefixes, content-field names, fonts and time zone.
`src/lang.njk` generates the language script from that configuration. Only the bare `/`
entry point follows browser/saved language preferences; explicit deep links always stay
in their selected language, including with blocked storage.

Every page exposes `<main id="main">`. CSS source modules in `src/_includes/styles/`
are combined by `src/styles.njk` into one `/assets/site.css`. The font request includes
only the current page's font family. The mobile hamburger button has a localized accessible
name and switches to a close icon when expanded; navigation remains usable without JS.

Metadata and the sitemap use the production origin in `SITE_URL`, defaulting to
`https://pillarcbc.org` (also set in both Cloudflare build environments). When the production domain changes, set `SITE_URL` to
its HTTPS origin in both Cloudflare build environments and rebuild. Do not set it to a
feature-preview address. Each page supplies its own description, canonical URL and
Open Graph metadata. Sample event pages are noindex and omitted from the sitemap;
Cloudflare separately marks preview deployments noindex.


## About Us page

About Us is available at `/about/`, `/zh-hant/about/`, and `/en/about/`. The header
About Us link and homepage About Us button route there. It includes the existing
Church Life photos and text, moved without rewriting from `homepage.life` to
`src/_data/about.yml` under `life`. Pages CMS owns these fields under **关于我们 About Us**.
The homepage retains Sunday information, events, recurring gatherings, verse, photo strip
and values; 信仰告白 remains a separate page linked from navigation and About Us.

The church introduction, mission statement and pastor information were checked against
https://pillarcbc.org/關於我們/ and https://pillarcbc.org/en/about-us/ on November 16, 2026.
The supplied details are Pastor Bill Yang / 杨东牧师 / 楊東牧師 and
`bill.yang@pillarcbc.org`. No unsourced biography, qualifications or ministry dates are added.
The portrait comes from `https://pillarcbc.org/wp-content/uploads/2026/10/Pastor-Yang.png`
and is stored as `src/images/pastor-yang.png`; the responsive image pipeline processes it.
The pastor email opens the visitor's mail app and does not submit the contact form.

### Events collection migration

The collection replaces the former `content/events/<slug>.yml` files. All edits must target `content/events.yml`; do not recreate per-event files as a second source of truth. Use a dashboard version with collection support. Expired entries and their URLs are removed according to the removal policy below.


## Removing expired events

Delete expired event records manually through the dashboard, then merge the checked content
PR and publish normally. The website does not run a scheduled cleanup or delete source records
automatically. Builds exclude expired events from the homepage, detail pages, and sitemap,
even when their source records have not yet been deleted. Existing deployments change only
after rebuilding and publishing; browser JavaScript hides ended cards in the meantime.
Shared image files are not automatically deleted because other content may use them.

Giving content is editable under **Pages CMS → 奉献 Giving**. When changing the Zelle
recipient, update and verify the original QR image together with the email text.


Shared CSS and JavaScript URLs include a content-derived version. Updating source
assets or stylesheet modules changes that version so browsers fetch the matching
files after publication, even when older assets are still cached. The contact
honeypot is also hidden in HTML, and a stalled Turnstile load shows the direct-email
fallback after 15 seconds instead of leaving the form on Preparing indefinitely.


## Sunday sermons and text bulletins

The real collection starts empty in `content/sermons.yml`. Each Sunday has one stable
`YYYY-MM-DD` identifier shared by its sermon and bulletin. Keep that date stable.

- `/sermons/` is the archive; `/sermons/YYYY-MM-DD/` is a sermon page.
- Past sermons are paginated six per page. Page one stays at `/sermons/`;
  later pages use `/sermons/page/2/`, `/sermons/page/3/`, and so on. The current
  Sunday section stays above the archive. Previous/next and numbered links work
  without JavaScript and jump to the past-sermons section. Small/empty archives
  have no pagination controls. Language switches retain the page number.
- `/sermons/YYYY-MM-DD/bulletin/` is the dated bulletin.
- `/bulletin/` always works, including before the first bulletin is published.
  A small Cloudflare Pages Function checks the date on each request using
  `America/Los_Angeles`. Monday–Saturday targets the coming Sunday; Sunday
  targets that day through 11:59 p.m. It redirects to that exact published
  bulletin, or shows “not published yet.” It never falls back to a past Sunday.
  Point the reusable QR at the final production domain's `/bulletin/` URL.
  Responses use `no-store`; weekly rollover needs no rebuild.
- All routes have `/zh-hant/` and `/en/` equivalents. Traditional Chinese uses the
  existing OpenCC fallback. Website language does not change the recorded audio.
- The always-visible Sermons navigation replaces the previous Sunday anchor
  tab. It opens the archive's empty state before the first entry is published.
  The homepage keeps the service time, full address, directions, visitor contact
  link and entrance photo visible without expanding anything. Its secondary
  resources group sits directly below the visit actions, before the photo on
  mobile. It always links to the sermon archive and links to the YouTube
  channel when configured. The weekly bulletin link appears only when the
  current bulletin is published. Dated bulletins and unpublished-week notices
  remain available in the sermon archive.

A weekly entry has localized title and speaker, `published`, and a
`recording` status of `pending`, `ready`, or `unavailable`. `ready` requires an
11-character `youtube_id`; omit that field for other statuses. `bulletin` is
optional; when supplied it has an ordered `program` and `announcements` list.
Announcement headings, paragraphs/line breaks and optional labeled HTTPS links
are formatted by the templates. Arbitrary HTML is escaped. No PDF, image upload,
video upload, new database or storage bucket is needed. A print stylesheet is included.

Publish an entry with its Sunday date and bulletin before the service through the
normal reviewed workflow. Later change `recording` to `ready`, add the YouTube ID,
preview and publish again. Recording availability is independent of bulletin
publication; no manual current-bulletin selector is needed. Published future
bulletin pages are prebuilt so the weekly route can reach them when their week
arrives. The detailed dashboard editing experience is a separate follow-up;
Pages CMS fields are provided meanwhile.

The weekly function reads a generated date-only `/assets/bulletins.json` manifest;
it contains no drafts, samples, or bulletin text. Only the three localized weekly
bulletin routes invoke the new function. Archives, dated pages and other assets
remain static. Missing/invalid manifests return an unavailable response with the
safe empty page. The static weekly page is also always empty, preventing stale
bulletin content if function execution is unavailable. See Cloudflare's
[Pages routing](https://developers.cloudflare.com/pages/functions/routing/) and
[static asset binding](https://developers.cloudflare.com/pages/functions/api-reference/#envassetsfetch).

### Retention

Builds include at most 52 published Sundays, newest first, within the latest
52 Pacific calendar weeks (current Sunday and previous 51 Sundays), plus
published future Sundays, still capped at 52 records overall. Future dated
pages are public when explicitly published, but stay out of the archive until
their week. Drafts and samples are excluded. Age filtering works even with gaps.

Run `npm run sermons:prune` when preparing an update to remove expired/overflow
published source records. It preserves
unpublished drafts and later future entries. Review that diff and generate the
normal preview before publishing. Validation rejects more than 52 published
source records, prompting pruning before the next weekly update can merge.
Builds never silently rewrite the reviewed commit or alter the publish workflow.

Archive ordering and retention are evaluated on rebuild/publication; there is no
scheduler or database. The weekly QR route alone evaluates the current week at
request time; homepage/archive snapshots stay as built until replaced. Historical text remains in Git
history, but there are no accumulated PDF/video binaries. Older recordings remain on YouTube; the
archive links to the channel when `site.links.youtube` has been supplied.

### Preview scenarios

Run `npm run dev:sermons` and visit `http://localhost:8088/_preview/sermons/bulletin/home/`.
The preview bar switches between **no content**, **this Sunday only (no past sermons)**, **bulletin published**,
**recording published** and **this week not published**, using the actual homepage,
archive, detail and bulletin templates in all three languages. Dates are generated
relative to this week’s Sunday in Pacific time. The sample speaker, program and titles
are illustrative, and sample videos never request a real recording or thumbnail.
The current-only scenario keeps the bulletin and recording placeholder available while
showing a distinct empty history with no pagination or older-recording links.
The remaining nonempty scenarios include 13 past Sundays so the first, middle and final
pagination pages can be reviewed.

The state picker also appears on the regular feature-preview homepage and all
other feature pages, so reviewers do not need to discover the special routes.
To force a fixed state in a shareable URL, append `?sermon_state=empty`,
`?sermon_state=current-only`, `?sermon_state=bulletin`, `?sermon_state=recorded`, or
`?sermon_state=past-only`. The preview redirects to that scenario for the current
page type (home, sermon archive, or bulletin). `?sermon_state=actual` returns to
the unmodified real collection. Unknown values are ignored. Neither the picker
nor the override script is referenced by `main` or `live` builds.

Feature-branch builds generate these review routes automatically. Ordinary local
builds omit them unless `SERMONS_PREVIEW=1` is set. `main` and `live` always omit them,
even with that override. They are noindex, excluded from the sitemap, and never
mixed into the empty canonical collection. `npm run check` checks real/preview
links and production isolation, alongside the existing website checks.
