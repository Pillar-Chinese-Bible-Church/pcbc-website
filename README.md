# Pillar Chinese Bible Church website · 柱石华人圣经教会

The website of Pillar Chinese Bible Church, in Simplified Chinese, Traditional Chinese and English.

| | Address |
| --- | --- |
| Live site | https://pillarcbc.pages.dev |
| Preview of unpublished changes | https://main.pillarcbc.pages.dev |
| Edit content | https://app.pagescms.org |
| Code | https://github.com/Pillar-Chinese-Bible-Church/pcbc-website |

Church volunteers change the text and photos through **Pages CMS**, which shows web forms and needs no coding.
Saved changes appear on the preview first. They reach the live site only when someone presses **Publish website**.

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

---

## What's on the site

Each language has the following pages:

| Page | 简体 | 繁體 | English |
| --- | --- | --- | --- |
| Homepage | `/` | `/zh-hant/` | `/en/` |
| Event detail (enabled entries) | `/events/<slug>/` | `/zh-hant/events/<slug>/` | `/en/events/<slug>/` |
| 信仰告白 / What We Teach | `/teach/` | `/zh-hant/teach/` | `/en/teach/` |

The homepage has the welcome photo, Sunday worship details, the weekly gatherings, church life,
the 1 Timothy 3:15 verse the church is named after, a scrolling photo strip, and the church's values.
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

```
Pages CMS ──save──▶ main branch ──Cloudflare──▶ preview   main.pillarcbc.pages.dev
                        │
               "Publish website" button
                        ▼
                    live branch ──Cloudflare──▶ live site  pillarcbc.pages.dev
```

| Branch | What it is | Address |
| --- | --- | --- |
| `main` | Where Pages CMS saves. Nobody is sent here; it's for checking changes | https://main.pillarcbc.pages.dev |
| `live` | The real site | https://pillarcbc.pages.dev |

**To publish:** on GitHub, open the repository → **Actions** → **Publish website** → **Run workflow** →
**Run workflow**. `live` is moved forward to match `main`, and Cloudflare deploys it in about a minute.

- Only people with write access to the GitHub repository can press the button, so it also works as the
  approval step. Editors invited to Pages CMS by email can't publish.
- Never push to `live` directly. The button only moves `live` forward, and it stops with an error if `live`
  has changes that aren't on `main`.
- Cloudflare marks previews "noindex", so search engines don't list them.

**To undo a published change**, either fix it in Pages CMS and publish again, or in Cloudflare open the
**pillarcbc** project → **Deployments**, choose an earlier Production deployment and click **Rollback**.

## Common tasks

Most of these are done in Pages CMS. Each takes effect on the preview after saving, and on the live site after publishing.

| I want to… | Where |
| --- | --- |
| Change the Sunday time, address, email or social links | Pages CMS → **基本信息 Basics** |
| Add, remove or reorder a weekly gathering | Pages CMS → **首页 Homepage** → 每周聚会 |
| Change the welcome photo or text | Pages CMS → **首页 Homepage** → 顶部大图 |
| Add or remove photos in the scrolling strip | Pages CMS → **照片墙 Photo strip** |
| Edit the statement of faith | Pages CMS → **信仰告白 Statement of faith** (have the pastor or elders review it) |
| Fix a wrong Traditional Chinese character | Type the correct text in that field's **繁體** box (see [Languages](#languages)) |
| Change menu or button wording ("了解更多", "Menu"…) | Code: `src/_data/ui.js` |
| Change colors, fonts or layout | Code: `src/assets/site.css` |
| Add a new page | Code: a new template in `src/` (copy `teach.njk`), plus a menu link in `src/_includes/base.njk` |

Gathering times are entered once. They appear both in the weekly boxes and in the footer.

## How the content files work

Page content lives in YAML files in `src/_data/`. Pages CMS edits them through forms, but they can also be edited by hand.

| File | Contents |
| --- | --- |
| `site.yml` | Church name, address, map link, email, Sunday worship, social links, footer note |
| `homepage.yml` | Welcome section, Sunday section, weekly gatherings, church life, verse, values |
| `photos.yml` | The scrolling photo strip |
| `events.yml` | Upcoming events and their detail-page content |
| `beliefs.yml` | Event detail (enabled entries) | `/events/<slug>/` | `/zh-hant/events/<slug>/` | `/en/events/<slug>/` |
| 信仰告白 / What We Teach |

Every piece of text has up to three versions:

```yaml
name:
  zh: 青年团契            # 简体 (required)
  hant: 青年團契          # 繁體 (optional, converted from zh when left out)
  en: Youth Fellowship    # English
```

Text that should break onto a new line (the welcome title and the verse) uses a YAML block with real line breaks.

The forms Pages CMS shows are defined in `.pages.yml`. If you add a field to a YAML file, add it to `.pages.yml`
too, or editors won't see it.

## Languages

**First visit.** `src/assets/lang.js` sends visitors to the language their browser prefers:
zh-TW / zh-HK / zh-MO / zh-Hant → 繁體, any other Chinese → 简体, everything else → English.
Search engine crawlers are never redirected.

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
- During the build, every `<img>` is resized into several sizes and converted to WebP and JPEG
  ([eleventy-img](https://www.11ty.dev/docs/plugins/image/)). Re-encoding also **removes photo metadata,
  including GPS location**, so phone photos can be uploaded as they are.
- Every photo needs a short description (the "照片说明 / alt" field) for people who can't see images.
- Photos show real church members. Get their OK before adding close-up photos of individuals, especially children.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:8080. The page reloads as you edit files. `npm run build` writes the finished site to `_site/`.

## Project layout

```
.pages.yml                    Pages CMS editing screens
.github/workflows/publish.yml The "Publish website" button
eleventy.config.js            Build setup: YAML data, language filters, 繁體 conversion, image resizing
src/
  _data/
    site.yml, homepage.yml,   Content (edited in Pages CMS)
    photos.yml, beliefs.yml
    langs.js                  The three languages and their URL prefixes
    ui.js                     Fixed interface wording per language
  _includes/base.njk          Shared header, language switch, footer
  index.njk                   Homepage (built once per language)
  teach.njk                   信仰告白 page (built once per language)
  assets/
    site.css                  All styles
    lang.js                   First-visit language redirect
    site.js                   Phone menu, remembering the chosen language
  images/                     Photos and the logo (logo-pillar.svg)
EDITING.md                    Chinese guide for content editors
```

Built with [Eleventy](https://www.11ty.dev) 3. There's no server code; the output is plain HTML, CSS and a little JavaScript.

## Accounts and services

All of these are free for a site this size. They should belong to the church, not to one person.

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

Everything below is already done for the current site. It's here in case it has to be rebuilt or moved.

1. **GitHub.** Put this folder in a repository owned by a church account or organization.
2. **Cloudflare Pages.** Workers & Pages → Create → Pages → Connect to Git → choose the repository. Then:
   - Build command `npm run build`, build output directory `_site`, framework preset None.
   - Environment variable `NODE_VERSION` = `22`, for both Production and Preview.
   - Settings → Build → Branch control: production branch `live`, preview branches "All non-Production branches".
   - Create a `live` branch from `main` before switching the production branch.
3. **Pages CMS.** At https://app.pagescms.org sign in with the GitHub account, allow access to the repository and open it.
   Invite editors from the repository's settings in Pages CMS.
4. **Domain.** In the Cloudflare project → **Custom domains**, add the church's domain. If the domain also handles
   church email, keep its existing MX and other email records exactly as they are.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| A change doesn't appear on the live site | It's only on the preview until someone presses **Publish website**. |
| A change doesn't appear on the preview either | Cloudflare → pillarcbc → **Deployments**: is the latest `main` build still running, or did it fail? |
| A Cloudflare build failed | Open the failed deployment and read the build log. Often it's a YAML mistake (wrong indentation or a missing quote) from a hand edit. |
| "Publish website" failed | Someone probably pushed to `live` directly. Make sure everything on `live` is also on `main`, then run it again. |
| A photo shows as missing in Pages CMS | Its path must start with `/images/` and the file must be in `src/images/`. |
| A Traditional Chinese character is wrong | Type the right text in that field's 繁體 box, or add a rule to `HANT_FIXES` in `eleventy.config.js`. |
| The site looks broken after a code change | Run `npm run dev` locally and check the browser console. Use Cloudflare's **Rollback** to restore the live site meanwhile. |

## Still to do

- Replace placeholders: the address and map link, the email, the Sunday time, and the YouTube / WeChat / 小红书 links (`site.yml`).
- Confirm the church-life details (weekend worship practice, in-person small groups, dumplings at Lunar New Year) or replace them with real ones.
- Have the pastor or elders review the 信仰告白. It follows the topics of City Light Bible Church's statement and is written fresh, not copied.
- Connect the church's own domain.
- Get the logo as a vector file (SVG, AI or PDF) from the designer. The current `logo-pillar.svg` was traced by hand from a small image.

## Events and preview examples

The homepage shows up to three upcoming enabled events, ordered by start time,
after Sunday Worship and before weekly gatherings. Each has a shareable detail
page at `/events/<slug>/`, `/zh-hant/events/<slug>/`, and `/en/events/<slug>/`.
The existing homepage sections and 信仰告白 content are retained. The shorter photo
hero leads into a compact Sunday strip with the time, location, and directions.
Open **More Sunday information** to see the original Sunday photo and visitor/video
content. Events, weekly gatherings, and the remaining sections use tighter spacing;
all original page text, photos, verse, and values remain available.

Edit `src/_data/events.yml` in **Pages CMS → 近期活动 Events**. Use a unique URL
slug; Simplified Chinese, optional Traditional overrides, and English follow the
existing text convention. Images are optional. Start/end must be quoted ISO
values with an explicit timezone offset (`-08:00` in winter, `-07:00` in summer).
All display times use America/Los_Angeles. Optional registration/map URLs must
use HTTPS. `published: false` excludes an entry everywhere.

The supplied events are clearly labeled **samples**, not church announcements.
`sample: true` entries appear on Cloudflare feature-branch previews, but are
excluded from `main`, `live`, and ordinary local builds. To preview samples
locally, run `EVENTS_INCLUDE_SAMPLES=1 npm run dev`. `main` and `live` builds exclude samples
even if that override is accidentally set. For a real confirmed event, set
`sample: false`, fill in its real information, and enable it. Never convert a
sample into a real announcement without verifying its details.

Builds omit ended events from the homepage but retain their detail pages.
Browser JavaScript also removes ended cards/registration links when an old
static deployment is visited or left open, and labels ended detail pages.
Without JavaScript, date visibility remains as of the last build; rebuild after
events end if that fallback must be current. This change adds no scheduled job.
An empty upcoming list hides the homepage events section and its navigation link.

Run `npm test` for sample/production isolation, validation, and Pacific-time tests;
run `npm run build` for a normal build or
`CF_PAGES_BRANCH=codex/website-events npm run build` to check the sample preview.
Use Node 22, as specified by `.nvmrc` and the Cloudflare build configuration.

## Contact page (form only)

The contact page is available at `/contact/`, `/zh-hant/contact/`, and `/en/contact/`.
Header/footer Contact links, the statement-of-faith Contact button, and inquiry
links from Sunday, gatherings, and events route there. Inquiry links preselect a
topic and optionally show a public gathering/event title as context. Language
links retain that public inquiry context, but not personal form inputs.

This version intentionally has **no email delivery integration**. The page presents
an ordinary contact form without unfinished-feature notices. **Send message** is
styled as an enabled button, but is intentionally a no-op (`type="button"`): it
sends no request, navigates nowhere, preserves the fields, and shows no success
message. The form script also prevents implicit submission and does not send,
save, or log visitor inputs. There is no backend, account setup, credential, or
Cloudflare configuration required. Direct `mailto:` links still open the visitor's
email app, where the visitor sends their email themselves.

Copy lives in `src/_data/contact.js`, layout in `src/contact.njk`, and presentation
logic in `src/assets/contact.js`. A later email-delivery PR must add server/provider
validation and spam protection, explicit pending/error/success states, and a real
submission handler before replacing the inert Send button with a real submit action.

## Giving page

Giving is available at `/giving/`, `/zh-hant/giving/`, and `/en/giving/`, linked
from the main navigation and footer. The page provides the church's Zelle
recipient (`giving@pillarcbc.org`), check payee (`Pillar Chinese Bible Church`),
stock-transfer contact (`office@pillarcbc.org`), Benevity matching instructions,
and annual-statement information. Giving questions link to the contact page with
its topic preselected. The contact form's Send action remains inert as in PR #2.

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
All payment activity stays in the donor's own banking app. No payment collection,
backend, provider account, or Cloudflare configuration is introduced by this PR.
