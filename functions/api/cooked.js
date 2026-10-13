// Cloudflare Pages Function: POST /api/cooked
// Body: { "slug": "recipe-slug", "cooked": "YYYY-MM-DD" | null }
// Header: X-Cook-Key: <COOK_KEY>
// Env (Pages > Settings > Variables, encrypted):
//   COOK_KEY      passphrase checked against the header
//   GITHUB_TOKEN  fine-grained PAT with Contents: read & write on the repo
//   GITHUB_REPO   e.g. "matthiasvangorp/recipes"
//   GITHUB_BRANCH optional, defaults to "main"

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export async function onRequestPost({ request, env }) {
  if (!env.COOK_KEY || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: "Server not configured" }, 500);
  if (!safeEqual(request.headers.get("X-Cook-Key") || "", env.COOK_KEY)) return json({ error: "Unauthorized" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { slug, cooked } = body || {};
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(slug)) return json({ error: "Invalid slug" }, 400);
  if (cooked !== null && !(typeof cooked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cooked)))
    return json({ error: "Invalid date" }, 400);

  const branch = env.GITHUB_BRANCH || "main";
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/recipes/${slug}.json`;
  const gh = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "recipes-cooked-fn",
  };

  const getRes = await fetch(`${url}?ref=${branch}`, { headers: gh });
  if (getRes.status === 404) return json({ error: "Recipe not found" }, 404);
  if (!getRes.ok) return json({ error: `GitHub read failed (${getRes.status})` }, 502);
  const file = await getRes.json();

  const recipe = JSON.parse(b64decode(file.content));
  if ((recipe.cooked || null) === cooked) return json({ ok: true, unchanged: true });
  recipe.cooked = cooked;

  const putRes = await fetch(url, {
    method: "PUT",
    headers: { ...gh, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: cooked ? `Cooked: ${recipe.title} (${cooked})` : `Unmark cooked: ${recipe.title}`,
      content: b64encode(JSON.stringify(recipe, null, 2) + "\n"),
      sha: file.sha,
      branch,
    }),
  });
  if (!putRes.ok) return json({ error: `GitHub write failed (${putRes.status})` }, 502);
  return json({ ok: true, cooked });
}
