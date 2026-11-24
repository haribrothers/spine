/**
 * US-SITE-02 (D-275) — the home page's motion and its two controls (theme,
 * copy). Everything is progressive: without this script, or with reduced
 * motion, every element shows in its final state and "How it works" is a
 * plain list.
 */

const THEME_KEY = "starlight-theme"; // Starlight's key: the docs and the home page share the reader's choice.
type Theme = "auto" | "light" | "dark";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => Array.from(root.querySelectorAll<T & Element>(selector)) as T[];

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function themeSwitch(root: HTMLElement) {
  const system = matchMedia("(prefers-color-scheme: light)");
  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme === "auto" ? (system.matches ? "light" : "dark") : theme;
    all<HTMLButtonElement>(root, "[data-theme-choice]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme)));
  };
  all<HTMLButtonElement>(root, "[data-theme-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      const theme = (button.dataset.themeChoice as Theme) ?? "auto";
      try {
        localStorage.setItem(THEME_KEY, theme === "auto" ? "" : theme);
      } catch {
        // Private windows can refuse storage; the choice still applies to this page.
      }
      apply(theme);
    }),
  );
  system.addEventListener("change", () => readTheme() === "auto" && apply("auto"));
  apply(readTheme());
}

function copyButtons(root: HTMLElement) {
  all<HTMLButtonElement>(root, "[data-copy]").forEach((button) => {
    const source = document.getElementById(button.dataset.copy ?? "");
    const label = button.querySelector(".lbl");
    const status = button.parentElement?.querySelector("[data-copy-status]");
    if (!source || !label) return;
    const idle = label.textContent ?? "";
    button.addEventListener("click", async () => {
      const text = source.innerText.replace(/^\$ /gm, "");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return; // No clipboard (an insecure page, a refused permission): the commands stay selectable.
      }
      button.dataset.copied = "1";
      label.textContent = button.dataset.copiedText ?? idle;
      if (status) status.textContent = button.dataset.copiedText ?? "";
      setTimeout(() => {
        button.dataset.copied = "0";
        label.textContent = idle;
        if (status) status.textContent = "";
      }, 1600);
    });
  });
}

export function start(root: HTMLElement) {
  themeSwitch(root);
  copyButtons(root);

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = matchMedia("(max-width: 860px)");
  root.dataset.motion = reduce ? "reduce" : "full";

  // Reveal on scroll; count the dashboard's figures up once they're seen.
  const countUp = (el: HTMLElement) => {
    const to = Number(el.dataset.count);
    if (reduce || !Number.isFinite(to)) return;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = clamp((t - t0) / 1400, 0, 1);
      el.textContent = `$${money(to * (1 - Math.pow(1 - k, 3)))}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const seen = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        el.dataset.in = "1";
        if (el.dataset.count) countUp(el);
        seen.unobserve(el);
      }),
    { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
  );
  all(root, "[data-reveal], .tile, [data-count]").forEach((el) => seen.observe(el));
  // The hero comes in on load, however little of the window shows above the fold.
  requestAnimationFrame(() => all(root, ".hero [data-reveal]").forEach((el) => (el.dataset.in = "1")));

  // Looping demos: data-steps cycles data-step while the tile is on screen.
  const visible = new WeakSet<Element>();
  const onScreen = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { threshold: 0.35 });
  all(root, "[data-steps]").forEach((el) => {
    const n = Number(el.dataset.steps);
    const waits = (el.dataset.ms ?? "1800").split(",").map(Number);
    el.dataset.step = String(reduce ? n - 1 : 0);
    if (reduce) return;
    onScreen.observe(el);
    let i = 0;
    const next = () =>
      setTimeout(() => {
        if (visible.has(el)) {
          i = (i + 1) % n;
          el.dataset.step = String(i);
        }
        next();
      }, waits[i % waits.length]);
    next();
  });

  // The hero: the example job's events arrive one after another.
  const toasts = all(root, ".toast");
  let head = 0;
  const place = () => toasts.forEach((toast, i) => (toast.dataset.pos = String(Math.min((head - i + toasts.length) % toasts.length, 3))));
  place();
  if (!reduce && toasts.length) setInterval(() => ((head = (head + 1) % toasts.length), place()), 2600);

  const hdr = root.querySelector<HTMLElement>(".hdr");
  const win = root.querySelector<HTMLElement>(".win");
  const flow = root.querySelector<HTMLElement>(".flow");
  const steps = flow ? all(flow, ".stp") : [];
  const copies = flow ? all(flow, ".copy") : [];
  const docs = flow ? all(flow, ".doc") : [];
  const track = flow?.querySelector<HTMLElement>(".track");
  let current = -1;

  const setStage = (s: number) => {
    if (s === current) return;
    current = s;
    steps.forEach((el, i) => (el.dataset.state = i < s ? "done" : i === s ? "now" : "next"));
    copies.forEach((el, i) => (el.dataset.active = i === s ? "1" : "0"));
    docs.forEach((el, i) => {
      el.dataset.active = i === s ? "1" : "0";
      el.dataset.past = i < s ? "1" : "0";
    });
  };

  // The pinned story needs room: phones, short windows and reduced motion get the list.
  const isStatic = () => reduce || narrow.matches || innerHeight < 680;
  const applyMode = () => {
    if (flow) flow.dataset.static = isStatic() ? "1" : "0";
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      if (hdr) hdr.dataset.scrolled = y > 8 ? "1" : "0";
      if (win && !reduce) {
        const p = clamp(y / 520, 0, 1);
        win.style.setProperty("--tilt", `${(14 * (1 - p)).toFixed(2)}deg`);
        win.style.setProperty("--zoom", (0.94 + 0.06 * p).toFixed(3));
      }
      if (flow && !isStatic()) {
        const r = flow.getBoundingClientRect();
        const f = clamp(-r.top / (r.height - innerHeight), 0, 1);
        track?.style.setProperty("--fill", clamp((f * 6 - 0.5) / 5, 0, 1).toFixed(3));
        setStage(Math.min(5, Math.floor(f * 6)));
      }
    });
  };
  applyMode();
  setStage(0);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => (applyMode(), onScroll()));
  narrow.addEventListener("change", () => (applyMode(), onScroll()));

  // A step's button goes to that step: in the pinned story by scrolling to its share of the section, in the list to its card.
  all<HTMLButtonElement>(root, ".stp button").forEach((button) =>
    button.addEventListener("click", () => {
      if (!flow) return;
      const i = Number(button.dataset.step);
      const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
      if (isStatic()) {
        const target = document.getElementById(`step-${i + 1}`);
        if (target) scrollTo({ top: target.getBoundingClientRect().top + scrollY - 88, behavior });
        return;
      }
      const r = flow.getBoundingClientRect();
      scrollTo({ top: r.top + scrollY + (r.height - innerHeight) * ((i + 0.5) / 6), behavior });
    }),
  );
}
