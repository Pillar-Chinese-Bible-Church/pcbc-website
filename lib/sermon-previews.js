import { dateNumber, dateString, sundayWindow, paginatePastSermons } from "./sermons.js";
import { locales } from "./locales.js";

const text = (zh, en) => ({ zh, en });
export function sermonPreviewScenarios(now = Date.now()) {
  const window = sundayWindow(now);
  const make = (weeksAgo, title, passage, recording) => ({
    date: dateString(dateNumber(window.sunday) - weeksAgo * 7 * 86400000), published: true, sample: true,
    title: text(...title), passage: text(...passage), speaker: text("示例讲员", "Sample speaker"), recording,
    // No real video/channel is attributed to the church in mock content.
    ...(recording === "ready" ? { youtube_id: "sample00001" } : {}),
    bulletin: {
      program: [
        { label: text("宣召", "Call to worship"), detail: text("诗篇 100:1–5", "Psalm 100:1–5") },
        { label: text("诗歌敬拜", "Worship in song") },
        { label: text("公祷", "Congregational prayer") },
        { label: text("读经", "Scripture reading"), detail: text(...passage) },
        { label: text("证道", "Sermon"), detail: text(...title) },
        { label: text("回应诗歌与祝祷", "Response song and benediction") }
      ],
      announcements: [
        { heading: text("欢迎新朋友", "Welcome, newcomers"), text: text("欢迎在聚会后留下来，与我们彼此认识。", "Please stay after the service so we can get to know one another.") },
        { heading: text("同心祷告", "Pray together"), text: text("让我们为教会、家人和正在认识福音的朋友同心祷告。", "Please pray for our church, families and friends exploring the gospel.") }
      ]
    }
  });
  const current = make(0, ["凡事谢恩", "Give thanks in everything"], ["帖撒罗尼迦前书 5:16–18", "1 Thessalonians 5:16–18"], "pending");
  const past = [make(1, ["信靠祂的引领", "Trust His leading"], ["箴言 3:5–6", "Proverbs 3:5–6"], "ready"), make(2, ["在爱中彼此建立", "Build one another up in love"], ["以弗所书 4:15–16", "Ephesians 4:15–16"], "unavailable")];
  past.push(...Array.from({ length: 11 }, (_, index) => make(index + 3,
    [`主日信息示例 ${index + 3}`, `Sample Sunday message ${index + 3}`],
    ["诗篇 100:1–5", "Psalm 100:1–5"], "ready")));
  const data = (items, selected) => {
    const recent = items.filter(item => item !== selected);
    return { ...window, items, current: selected, recent, latestBulletin: recent.find(item => item.bulletin) || null, hasContent: items.length > 0, preview: true };
  };
  const ready = { ...current, recording: "ready", youtube_id: "sample00001" };
  return [
    { id: "empty", data: data([], null) },
    { id: "bulletin", data: data([current, ...past], current) },
    { id: "recorded", data: data([ready, ...past], ready) },
    { id: "past-only", data: data(past, null) }
  ];
}
export function sermonPreviewPages(now = Date.now()) {
  return sermonPreviewScenarios(now).flatMap(scenario => locales.flatMap(language => {
    const prefix = `/_preview/sermons/${scenario.id}`;
    const pages = [
      { view: "home", path: "/home/" },
      { view: "bulletin", path: "/bulletin/", entry: scenario.data.current }
    ];
    pages.push(...paginatePastSermons(scenario.data.recent).map(archivePage => ({ view: "archive", path: archivePage.path, archivePage })));
    for (const [index, entry] of scenario.data.items.entries()) {
      const neighbors = { newer: scenario.data.items[index - 1], older: scenario.data.items[index + 1] };
      pages.push({ view: "sermon", path: `/sermons/${entry.date}/`, entry, ...neighbors });
      if (entry.bulletin) pages.push({ view: "bulletin", path: `/sermons/${entry.date}/bulletin/`, entry, ...neighbors });
    }
    return pages.map(page => ({ ...scenario, ...page, language, prefix, pagePath: prefix + page.path }));
  }));
}
