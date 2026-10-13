// Client: "Cooked it" button + ingredient checkboxes.
(() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const toast = (msg) => {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 3500);
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const label = (iso) =>
    iso ? `Cooked ${new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · undo` : "Cooked it";

  const getKey = () => {
    let key = store.get("cook-key");
    if (!key) {
      key = prompt("Passphrase to mark recipes as cooked:");
      if (key) store.set("cook-key", key.trim());
    }
    return key && key.trim();
  };

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cook-btn");
    if (!btn) return;
    e.preventDefault();
    const key = getKey();
    if (!key) return;

    const wasCooked = btn.dataset.cooked;
    const next = wasCooked ? null : today();
    if (wasCooked && !confirm("Mark this recipe as not cooked?")) return;

    btn.disabled = true;
    try {
      const res = await fetch("/api/cooked", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cook-Key": key },
        body: JSON.stringify({ slug: btn.dataset.slug, cooked: next }),
      });
      if (res.status === 401) {
        store.del("cook-key");
        toast("Wrong passphrase. Try again.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      btn.dataset.cooked = next || "";
      btn.textContent = label(next);
      toast(next ? "Marked as cooked. The site updates in about a minute." : "Unmarked. The site updates in about a minute.");
    } catch (err) {
      toast("Couldn't save: " + (err.message || "network error"));
    } finally {
      btn.disabled = false;
    }
  });

  // Ingredient checkboxes: remembered per browser while cooking.
  document.querySelectorAll(".ingredients input[data-key]").forEach((cb) => {
    const k = "ing:" + cb.dataset.key;
    cb.checked = store.get(k) === "1";
    cb.addEventListener("change", () => (cb.checked ? store.set(k, "1") : store.del(k)));
  });
})();
