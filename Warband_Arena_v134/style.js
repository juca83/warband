// ===================================================================
// Warband Arena - the look of a meta, set in the workshop: interface theme (colours, fonts, buttons),
// visual effects made in the effect editor, texts, screens, frames, sounds and music.
// The store calls apply(cfg) whenever the meta (or a friend's borrowed meta) changes; the game reads
// the parts it needs from WA_STYLE.cfg and listens with onApply().
// ===================================================================
(function (root) {
  "use strict";
  // ---- interface themes
  const THEME_DEF = { bg: "#10122a", surface: "#262b55", surface2: "#373e78", text: "#eef0fa", mist: "#a9b1d6", accent: "#e8b64c", accentHi: "#ffe39a", accentDk: "#93641c", danger: "#ff7a4a",
    tableTop: "#1c2044", tableMid: "#141733", tableBot: "#0f1128", tableGlow: "#ffd68c", fontDisplay: "Fraunces", fontBody: "Manrope", buttons: "solid", corners: "round" };
  const PRESETS = {
    classic: { name: ["Tavern night", "Nuit de taverne"], t: {} },
    frost: { name: ["Frozen keep", "Donjon gelé"], t: { bg: "#0b1626", surface: "#1d3550", surface2: "#2a4b70", text: "#eef7ff", mist: "#a6c4dc", accent: "#8fd3ff", accentHi: "#e3f6ff", accentDk: "#3a7ab0", danger: "#ff8fa6", tableTop: "#1a3550", tableMid: "#10233a", tableBot: "#0a1626", tableGlow: "#bfe6ff", fontDisplay: "Cinzel", fontBody: "Nunito" } },
    forge: { name: ["Dwarven forge", "Forge naine"], t: { bg: "#170c0a", surface: "#3a1d16", surface2: "#56291c", text: "#fff0e6", mist: "#d6ad98", accent: "#ff8a3a", accentHi: "#ffd0a0", accentDk: "#a8401a", danger: "#ff5a3a", tableTop: "#3a1a12", tableMid: "#24100c", tableBot: "#160907", tableGlow: "#ff9a5a", fontDisplay: "Cinzel Decorative", fontBody: "Rubik", corners: "soft" } },
    grove: { name: ["Elven grove", "Bosquet elfique"], t: { bg: "#0b1710", surface: "#1d3a26", surface2: "#2a5236", text: "#f0fbf0", mist: "#a8cdb0", accent: "#c9e06a", accentHi: "#f0ffc0", accentDk: "#6a8a2a", danger: "#ff8a6a", tableTop: "#1e3a24", tableMid: "#132a19", tableBot: "#0b1a0f", tableGlow: "#e8ff9a", fontDisplay: "Almendra", fontBody: "Nunito" } },
    neon: { name: ["Neon arcade", "Arcade néon"], t: { bg: "#0a0518", surface: "#24104a", surface2: "#3a1a6e", text: "#f6f0ff", mist: "#bba6e6", accent: "#ff3df2", accentHi: "#ffc2fb", accentDk: "#8a1ab0", danger: "#ff4a6a", tableTop: "#1e0a40", tableMid: "#120628", tableBot: "#08031a", tableGlow: "#3df2ff", fontDisplay: "Orbitron", fontBody: "Rubik", buttons: "glass", corners: "sharp" } },
    parchment: { name: ["Old map", "Vieille carte"], t: { bg: "#2a1d10", surface: "#4a3420", surface2: "#62462a", text: "#fff6e2", mist: "#d9c29a", accent: "#e0b060", accentHi: "#fff0c8", accentDk: "#8a5a20", danger: "#e0603a", tableTop: "#5a4024", tableMid: "#3e2b18", tableBot: "#2a1d10", tableGlow: "#ffe0a0", fontDisplay: "Pirata One", fontBody: "Lora", corners: "soft" } },
  };
  const FONTS_DISPLAY = ["Fraunces", "Cinzel", "Cinzel Decorative", "Uncial Antiqua", "MedievalSharp", "Pirata One", "Almendra", "Metamorphous", "Playfair Display", "Lora", "Bangers", "Luckiest Guy", "Fredoka", "Orbitron", "Press Start 2P", "Bungee",
    "Grenze Gotisch", "IM Fell English SC", "New Rocker", "Eagle Lake", "Macondo", "Berkshire Swash", "Germania One", "Caesar Dressing", "Irish Grover", "Henny Penny", "Creepster", "Rye", "Marcellus SC", "Spectral SC", "Alegreya SC",
    "Kaushan Script", "Permanent Marker", "Black Ops One", "Russo One", "Audiowide", "Silkscreen", "Righteous", "Lilita One", "Titan One"];
  const FONTS_BODY = ["Manrope", "Nunito", "Rubik", "Lato", "Lora", "Fredoka", "Quicksand", "Source Sans 3", "Exo 2", "Space Grotesk",
    "Alegreya Sans", "EB Garamond", "Crimson Pro", "Josefin Sans", "Barlow", "Comfortaa", "IBM Plex Sans", "Work Sans", "Philosopher", "Signika", "Merriweather Sans", "Atkinson Hyperlegible"];
  // the weights each font really has (Google Fonts refuses a request for a weight a font lacks): "" = regular only
  const FONT_W = { Cinzel: "400..900", "Cinzel Decorative": "400;700;900", Almendra: "400;700", "Playfair Display": "400..900", Lora: "400..700", Fredoka: "300..700", Orbitron: "400..900",
    "Grenze Gotisch": "100..900", "Spectral SC": "400;500;600;700;800", "Alegreya SC": "400;500;700;800;900", Silkscreen: "400;700",
    Nunito: "200..1000", Rubik: "300..900", Lato: "400;700;900", Quicksand: "300..700", "Source Sans 3": "200..900", "Exo 2": "100..900", "Space Grotesk": "300..700",
    "Alegreya Sans": "400;500;700;800;900", "EB Garamond": "400..800", "Crimson Pro": "200..900", "Josefin Sans": "100..700", Barlow: "400;500;600;700;800", Comfortaa: "300..700",
    "IBM Plex Sans": "400;500;600;700", "Work Sans": "100..900", Philosopher: "400;700", Signika: "300..700", "Merriweather Sans": "300..800", "Atkinson Hyperlegible": "400;700" };
  const BUILTIN_FONTS = new Set(["Fraunces", "Manrope", "__upload", "WA Custom Font", ""]);
  // one stylesheet per family, so one odd font never blocks the others
  function ensureFonts(list) {
    for (const f of new Set((list || []).filter((x) => x && !BUILTIN_FONTS.has(x)))) {
      if (!FONTS_DISPLAY.includes(f) && !FONTS_BODY.includes(f)) continue;
      const id = "waFont-" + f.replace(/[^a-z0-9]+/gi, "-"); if (document.getElementById(id)) continue;
      const w = FONT_W[f], link = document.createElement("link"); link.id = id; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(f).replace(/%20/g, "+") + (w ? ":wght@" + w : "") + "&display=swap";
      document.head.appendChild(link);
    }
  }
  const hexOk = (v, d) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => `rgba(${rgb(h).join(",")},${a})`;
  const mix = (h1, h2, k) => { const a = rgb(h1), b = rgb(h2); return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * k).toString(16).padStart(2, "0")).join(""); };
  const fam = (f, fallback) => (f === "__upload" ? `"WA Custom Font", ${fallback}` : `"${String(f).replace(/["<>;{}]/g, "")}", ${fallback}`);
  // a font picked for cards or tokens, falling back on the interface fonts
  const fontStack = (f, body) => (f ? fam(f, body ? "var(--font-body)" : "var(--font-display)") : "");
  function themeOf(cfg) {
    const t = Object.assign({}, THEME_DEF, (PRESETS[cfg && cfg.preset] || PRESETS.classic).t, (cfg && cfg.custom) || {});
    for (const k of Object.keys(THEME_DEF)) if (/^#/.test(THEME_DEF[k])) t[k] = hexOk(t[k], THEME_DEF[k]);
    return t;
  }
  function themeCSS(cfg) {
    if (!cfg || (!cfg.preset || cfg.preset === "classic") && !Object.keys(cfg.custom || {}).length && !cfg.font) return "";
    const t = themeOf(cfg), R = { round: [26, 20, 18, 999], soft: [16, 12, 10, 12], sharp: [6, 4, 3, 4] }[t.corners] || [26, 20, 18, 999];
    const disp = fam(cfg.font && cfg.font.data && cfg.font.use === "display" ? "__upload" : t.fontDisplay, "Georgia, serif"), body = fam(cfg.font && cfg.font.data && cfg.font.use === "body" ? "__upload" : t.fontBody, "system-ui, sans-serif");
    const btn = t.buttons === "glass" ? `background: ${rgba(t.surface, 0.35)}; backdrop-filter: blur(6px); box-shadow: inset 0 0 0 1px ${rgba(t.accent, 0.45)}, 0 4px 12px rgba(0,0,0,.35);`
      : t.buttons === "outline" ? `background: transparent; box-shadow: inset 0 0 0 1.5px ${rgba(t.accent, 0.7)};` : `background: ${rgba(t.surface, 0.9)}; box-shadow: inset 0 0 0 1px ${rgba(t.text, 0.3)}, 0 4px 12px rgba(0,0,0,.35);`;
    return `:root { --night: ${t.bg}; --night-2: ${mix(t.bg, t.surface, 0.4)}; --lacquer: ${t.surface}; --lacquer-2: ${t.surface2}; --line: ${rgba(t.text, 0.16)}; --line-2: ${rgba(t.text, 0.3)};
  --mist: ${t.mist}; --text: ${t.text}; --parchment: ${t.text}; --brass: ${t.accent}; --brass-hi: ${t.accentHi}; --brass-dk: ${t.accentDk}; --ember: ${t.danger};
  --font-display: ${disp}; --font-body: ${body}; --font-num: ${disp}; }
body { background: ${mix(t.bg, "#000000", 0.35)}; }
#stage:not(.has-bg) .table-bg { background: radial-gradient(ellipse 52% 40% at 56% 52%, ${rgba(t.tableGlow, 0.1)}, transparent 70%), radial-gradient(ellipse 90% 80% at 56% 50%, transparent 40%, ${rgba(mix(t.tableBot, "#000000", 0.5), 0.75)}), linear-gradient(180deg, ${t.tableTop}, ${t.tableMid} 55%, ${t.tableBot}); }
.candle { background: radial-gradient(ellipse at 50% 30%, ${rgba(t.tableGlow, 0.09)}, transparent 62%); }
#players { background: linear-gradient(180deg, ${rgba(t.surface, 0.72)}, ${rgba(t.bg, 0.6)}); border-radius: ${R[2]}px; }
#tip { background: linear-gradient(180deg, ${rgba(t.surface, 0.97)}, ${rgba(t.bg, 0.97)}); border-radius: ${R[2]}px; }
.mbox { background: linear-gradient(180deg, ${rgba(t.surface2, 0.98)}, ${rgba(t.bg, 0.98)}); border-radius: ${R[0]}px; }
.mbox p { color: ${mix(t.text, t.mist, 0.4)}; }
#modal .mbox.menu { border-radius: ${R[0] + 4}px; background: radial-gradient(ellipse 80% 60% at 50% -10%, ${rgba(t.accent, 0.16)}, transparent 60%), radial-gradient(ellipse 60% 50% at 50% 110%, ${rgba(t.danger, 0.12)}, transparent 60%), linear-gradient(180deg, ${rgba(t.surface, 0.97)}, ${rgba(t.bg, 0.98)});
  box-shadow: inset 0 0 0 1px ${rgba(t.accent, 0.35)}, inset 0 0 0 4px rgba(10,11,25,.6), inset 0 0 0 5px ${rgba(t.accent, 0.18)}, 0 40px 90px rgba(0,0,0,.75); }
#modal .mbox.menu h2.menu-title { background: linear-gradient(180deg, ${mix(t.accentHi, "#ffffff", 0.5)} 0%, ${t.accentHi} 38%, ${t.accentDk} 62%, ${t.accentHi} 100%); -webkit-background-clip: text; background-clip: text; }
.mm-panel { border-radius: ${R[1]}px; }
.pill { ${btn} border-radius: ${R[3]}px; }
.pill:hover:not(:disabled) { background: ${rgba(t.surface2, 0.95)}; }
.pill.big { background: linear-gradient(180deg, ${t.accentHi}, ${t.accent} 55%, ${t.accentDk}); color: ${mix(t.accentDk, "#000000", 0.7)}; }
.pill.big:hover:not(:disabled) { background: linear-gradient(180deg, ${mix(t.accentHi, "#ffffff", 0.3)}, ${mix(t.accent, "#ffffff", 0.15)} 55%, ${t.accentDk}); }
#cardEditor { background: radial-gradient(ellipse 70% 40% at 50% -5%, ${rgba(t.accent, 0.14)}, transparent 60%), linear-gradient(180deg, ${mix(t.bg, t.surface, 0.5)}, ${t.bg}); }
.ce-sec { background: ${rgba(t.surface, 0.55)}; border-radius: ${R[2]}px; }
${cfg.font && cfg.font.data ? `@font-face { font-family: "WA Custom Font"; src: url("${cfg.font.data}"); font-display: swap; }` : ""}`;
  }
  function loadFonts(cfg) { const t = themeOf(cfg || {}); ensureFonts([t.fontDisplay, t.fontBody]); }
  // ---- apply
  let cfg = {};
  const subs = [];
  function apply(c) {
    cfg = c && typeof c === "object" ? c : {};
    if (typeof document !== "undefined") {
      let st = document.getElementById("waThemeCSS");
      const css = themeCSS(cfg.theme);
      if (!st) { st = document.createElement("style"); st.id = "waThemeCSS"; document.body.appendChild(st); } // after style.css (which sits in the body)
      if (st.textContent !== css) st.textContent = css;
      loadFonts(cfg.theme);
    }
    // visual effects of the meta: compiled into the effect engine, named moments restyled
    const E = root.WA_FXE;
    if (E) {
      for (const id of Object.keys(E.CUSTOM)) if (!(cfg.fx || []).some((f) => f.id === id)) E.define(id, null);
      for (const f of cfg.fx || []) if (f && f.id) E.define(f.id, f);
      E.setMoments(cfg.moments || {});
    }
    // texts the meta rewrote
    if (root.WA_I18N && root.WA_I18N.setOverrides) root.WA_I18N.setOverrides((cfg.texts && cfg.texts.overrides) || {});
    for (const fn of subs) { try { fn(cfg); } catch (e) { try { console.error("[Warband Arena] style", e); } catch (x) {} } }
  }
  function onApply(fn) { subs.push(fn); try { fn(cfg); } catch (e) {} }
  root.WA_STYLE = { apply, onApply, get cfg() { return cfg; }, THEME_DEF, PRESETS, FONTS_DISPLAY, FONTS_BODY, ensureFonts, fontStack, themeOf, themeCSS };
})(typeof window !== "undefined" ? window : globalThis);
