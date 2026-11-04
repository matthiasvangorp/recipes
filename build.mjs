// Zero-dependency static site build: recipes/*.json -> dist/
// Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = new URL(".", import.meta.url).pathname;
const SRC = join(ROOT, "recipes");
const OUT = join(ROOT, "dist");
const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (iso) =>
  iso ? new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

const recipes = readdirSync(SRC)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ slug: basename(f, ".json"), ...JSON.parse(readFileSync(join(SRC, f), "utf8")) }))
;

const toCook = recipes.filter((r) => !r.cooked).sort((a, b) => (b.planned || "").localeCompare(a.planned || ""));
const cooked = recipes.filter((r) => r.cooked).sort((a, b) => b.cooked.localeCompare(a.cooked));

const [p1, p2] = config.people;

const layout = (title, body, { isRecipe = false, slug = "" } = {}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body${isRecipe ? ` data-slug="${esc(slug)}"` : ""}>
<header class="site"><a href="/" class="brand">${esc(config.siteTitle)}</a></header>
<main>${body}</main>
<div id="toast" role="status" aria-live="polite"></div>
<script src="/app.js" defer></script>
</body>
</html>`;

const macroCell = (m) => `<td>${m.kcal}</td><td>${m.protein} g</td><td>${m.carbs} g</td><td>${m.fat} g</td>`;

const cookButton = (r) =>
  `<button class="cook-btn" data-slug="${esc(r.slug)}" data-cooked="${esc(r.cooked || "")}">${
    r.cooked ? `Cooked ${esc(fmtDate(r.cooked))} · undo` : "Cooked it"
  }</button>`;

const recipePage = (r) =>
  layout(
    `${r.title} · ${config.siteTitle}`,
    `<article class="recipe">
  <p class="eyebrow">${r.tags.map(esc).join(" · ")}${r.totalMinutes ? ` · ~${r.totalMinutes} min` : ""}</p>
  <h1>${esc(r.title)}</h1>
  <p class="lede">${esc(r.description)}</p>
  <div class="status-row">${cookButton(r)}</div>

  <table class="macros">
    <thead><tr><th></th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead>
    <tbody>
      <tr><th>${esc(p1.label)}</th>${macroCell(r.macros[p1.key])}</tr>
      <tr><th>${esc(p2.label)}</th>${macroCell(r.macros[p2.key])}</tr>
    </tbody>
  </table>

  <div class="cols">
    <section class="ingredients">
      <h2>Ingredients <span class="muted">for 2</span></h2>
      <ul>${r.ingredients
        .map(
          (i, n) =>
            `<li><label><input type="checkbox" data-key="${esc(r.slug)}:${n}"><span class="amt">${esc(i.amount)}</span> <span>${esc(i.name)}</span></label></li>`
        )
        .join("")}</ul>
    </section>
    <section class="steps">
      <h2>Method</h2>
      <ol>${r.steps
        .map(
          (s) =>
            `<li><h3>${esc(s.title)}${s.minutes ? ` <span class="time">${s.minutes} min</span>` : ""}</h3><p>${esc(s.text)}</p></li>`
        )
        .join("")}</ol>
    </section>
  </div>
  ${r.notes ? `<aside class="notes"><h2>Notes</h2><p>${esc(r.notes)}</p></aside>` : ""}
</article>`,
    { isRecipe: true, slug: r.slug }
  );

const card = (r) => `<li class="card">
  <a href="/r/${esc(r.slug)}/">
    <span class="eyebrow">${r.tags.map(esc).join(" · ")}</span>
    <span class="card-title">${esc(r.title)}</span>
    <span class="card-meta">${r.macros[p1.key].kcal} / ${r.macros[p2.key].kcal} kcal · ${r.macros[p1.key].protein} / ${r.macros[p2.key].protein} g protein${r.totalMinutes ? ` · ~${r.totalMinutes} min` : ""}</span>
  </a>
  ${cookButton(r)}
</li>`;

const archiveRow = (r) =>
  `<li><a href="/r/${esc(r.slug)}/">${esc(r.title)}</a><span class="muted">${esc(fmtDate(r.cooked))}</span></li>`;

const index = layout(
  config.siteTitle,
  `<section>
  <h1 class="page-title">To cook</h1>
  ${toCook.length ? `<ul class="cards">${toCook.map(card).join("")}</ul>` : `<p class="muted">Nothing planned. Time to ask Claude for a new week.</p>`}
</section>
<section class="archive">
  <h2>Cooked</h2>
  ${cooked.length ? `<ul>${cooked.map(archiveRow).join("")}</ul>` : `<p class="muted">Nothing cooked yet.</p>`}
</section>
<p class="legend muted">kcal and protein shown as ${esc(p1.label)} / ${esc(p2.label)}.</p>`
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), index);
for (const r of recipes) {
  mkdirSync(join(OUT, "r", r.slug), { recursive: true });
  writeFileSync(join(OUT, "r", r.slug, "index.html"), recipePage(r));
}
writeFileSync(
  join(OUT, "recipes.json"),
  JSON.stringify(recipes.map(({ slug, title, planned, cooked, tags }) => ({ slug, title, planned, cooked, tags })), null, 2)
);
for (const f of ["style.css", "app.js"]) copyFileSync(join(ROOT, "src", f), join(OUT, f));

console.log(`Built ${recipes.length} recipes (${toCook.length} to cook, ${cooked.length} cooked) -> dist/`);
