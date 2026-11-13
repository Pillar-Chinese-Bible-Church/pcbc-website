# 柱石华人圣经教会 Pillar Chinese Bible Church — website

A small static site in three languages: 简体 at `/`, 繁體 at `/zh-hant/`, English at `/en/`,
each with a homepage and a 信仰告白 / What We Teach page (`/teach/`).

Church volunteers edit it through **Pages CMS** (web forms, no code). Every save goes to GitHub,
and **Cloudflare Pages** rebuilds and publishes the site in about a minute.

Editors: see [EDITING.md](EDITING.md).

## How it fits together

| Where | What |
| --- | --- |
| `src/_data/site.yml` | Basics: name, address, email, Sunday time, links |
| `src/_data/homepage.yml` | Homepage text and photos, weekly gatherings, values |
| `src/_data/photos.yml` | The scrolling photo strip |
| `src/_data/beliefs.yml` | 信仰告白 |
| `src/_data/ui.js` | Fixed menu and button wording in all three languages |
| `src/index.njk`, `src/teach.njk`, `src/_includes/base.njk` | Page templates |
| `src/assets/` | Styles and scripts (language switch, phone menu) |
| `src/images/` | Photos; Pages CMS uploads new ones here too |
| `.pages.yml` | The editing screens Pages CMS shows |

Each text in the YAML files has `zh` (简体), `en` (English) and an optional `hant` (繁體).
When `hant` is empty, the build converts the 简体 with OpenCC plus a few fixes for church terms
(see `eleventy.config.js`). The build also resizes every photo and strips its metadata, including GPS location.

On someone's first visit, `src/assets/lang.js` sends them to the language their browser prefers
(zh-TW / zh-HK / zh-Hant → 繁, other Chinese → 简, everything else → English). The 简 / 繁 / EN links save their choice.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:8080. `npm run build` writes the finished site to `_site/`.

## One-time setup

### 1. GitHub

Create a repository under a **church-owned GitHub account or organization** (not a personal one), then push this folder to it.

### 2. Cloudflare Pages (hosting)

1. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git, and pick the repository.
2. Build command: `npm run build`. Build output directory: `_site`.
3. Add the environment variable `NODE_VERSION` = `22`.
4. Save. Every push to the main branch now publishes the site. Add the church's domain under Custom domains.

### 3. Pages CMS (editing)

1. Go to https://app.pagescms.org, sign in with GitHub and give Pages CMS access to the repository.
2. Open the repository. Pages CMS reads `.pages.yml` and shows the editing screens.
3. Invite editors from the repository's settings in Pages CMS. Editors who can't use an email invite can be added as GitHub collaborators instead.

### Optional: review before publishing

If changes (for example to 信仰告白) should be approved first, have editors work on a `draft` branch in Pages CMS
and protect `main` on GitHub so changes reach it only through a reviewed pull request.

## Placeholders still to replace

Address, map link, email, the Sunday time, YouTube / WeChat / 小红书 links, and the church-life details
(worship practice, small groups, Lunar New Year). The 信仰告白 follows City Light Bible Church's topics
and needs review by the pastor or elders.
