// ===================================================================
// Warband Arena - art adapter. Player pictures from the card editor are
// used everywhere; cards without one get a clean tribe emblem portrait.
// ===================================================================
(function (root) {
  "use strict";
  const IMG = () => (root.WA_STORE ? root.WA_STORE.IMAGES : {});
  const TRIBE_HUE = { Beast: "#4fa34a", Construct: "#7c8fa6", Spirit: "#9a6cf0", Corsair: "#3c7be0", Elemental: "#f07a2e", Dragon: "#d8393e", Tidekin: "#1fb5a8", Infernal: "#c2306e", "": "#a08a64" };
  // 24x24 glyphs, drawn as filled shapes.
  const GLYPH = {
    Beast: '<ellipse cx="6" cy="9" rx="2.1" ry="2.8"/><ellipse cx="10.2" cy="5.6" rx="2.1" ry="2.8"/><ellipse cx="14.6" cy="5.6" rx="2.1" ry="2.8"/><ellipse cx="18.6" cy="9" rx="2.1" ry="2.8"/><path d="M12.3 11.2c3.2 0 6.3 3.6 6.3 6.5 0 2.2-1.7 3.2-3.4 3.2-1.3 0-1.9-.7-2.9-.7s-1.6.7-2.9.7c-1.7 0-3.4-1-3.4-3.2 0-2.9 3.1-6.5 6.3-6.5z"/>',
    Construct: '<path d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z" fill-rule="evenodd"/>',
    Spirit: '<path d="M12 2.5c4.4 0 7.5 3.4 7.5 7.8v10.6l-2.5-1.9-2.5 1.9-2.5-1.9-2.5 1.9-2.5-1.9-2.5 1.9V10.3C4.5 5.9 7.6 2.5 12 2.5zM9.2 9a1.4 1.8 0 1 0 0 3.6 1.4 1.8 0 0 0 0-3.6zm5.6 0a1.4 1.8 0 1 0 0 3.6 1.4 1.8 0 0 0 0-3.6z" fill-rule="evenodd"/>',
    Corsair: '<path d="M12 2.2a2.6 2.6 0 0 1 1.2 4.9V9h3.3v2.1h-3.3v8.1c2.6-.4 4.6-2.2 5.2-4.6l-1.9.3 3-3.9 1.5 4.7-1.4-.6c-.9 3.9-4.5 6.7-7.6 6.7s-6.7-2.8-7.6-6.7l-1.4.6 1.5-4.7 3 3.9-1.9-.3c.6 2.4 2.6 4.2 5.2 4.6v-8.1H7.5V9h3.3V7.1A2.6 2.6 0 0 1 12 2.2zm0 1.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z" fill-rule="evenodd"/>',
    Elemental: '<path d="M12.6 1.8c.7 3.6 5.9 6.6 5.9 12.3a6.5 6.5 0 0 1-13 0c0-3.3 1.8-5.2 3.1-6.6.2 1.9.9 3.2 2.1 3.9-.4-3.6.6-7 1.9-9.6zm-.5 11.6c-1.2 1.4-2.4 2.6-2.4 4.4a2.4 2.4 0 0 0 4.8 0c0-1.7-1.1-2.9-2.4-4.4z" fill-rule="evenodd"/>',
    Dragon: '<path d="M2 18.5c3.2-.4 5.6-1.8 7.2-4.2-2.1.3-3.8-.1-5.2-1.2 2.4-.1 4.4-.9 5.8-2.6-1.6-.2-2.8-.8-3.7-1.9 2.3.2 4.3-.2 5.9-1.4C13.6 4.8 16.5 3 21.8 2.2c-1.7 1.9-2.6 4.1-2.8 6.6-.3 4.9-3.3 8.6-8.3 10.2L12 22c-2.3-1.6-5.6-2.8-10-3.5z"/>',
    Tidekin: '<path d="M2 14.2c1.8-4.6 5.3-7.3 9.3-7.3 3.2 0 5.5 1.8 5.5 4.3 0 1.8-1.3 3.1-3 3.1-1.3 0-2.2-.8-2.2-1.9 0-.8.5-1.4 1.2-1.6-.4-.6-1.2-.9-2.1-.9-2.9 0-5.2 2.5-6.1 5.9 2-1.1 3.6-1 5 .1 1.5 1.2 3.2 1.3 5 .2 1.8-1.1 3.6-1.1 5.4 0l.8.5v2.5c-1.6-1-3.2-1-4.8 0-2 1.3-4.4 1.3-6.4-.1-1.6-1.1-3.1-1-4.6.2L2 20z"/>',
    Infernal: '<path d="M3 3c.6 4.2 2.4 7 5.3 8.2C7 12.4 6.3 14 6.3 15.9c0 3.5 2.6 6.1 5.7 6.1s5.7-2.6 5.7-6.1c0-1.9-.7-3.5-2-4.7 2.9-1.2 4.7-4 5.3-8.2-1.9 2.2-4.1 3.4-6.6 3.6-.8-.3-1.6-.4-2.4-.4s-1.6.1-2.4.4C7.1 6.4 4.9 5.2 3 3zm6.3 11.2l2 1v.9l-2.2-.7zm5.4 0l.2 1.2-2.2.7v-.9z" fill-rule="evenodd"/>',
    "": '<path d="M12 2l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.3 6.1 20l1.7-6.7-5.3-4.4 6.9-.5z"/>',
    leaf: '<path d="M20 3C11 3 4 8 4 15c0 2 .5 3.6 1.4 4.8L3 22l1.4 1.4 2.5-2.5C8.2 21.6 9.6 22 11 22c7 0 10-8 9-19zM9 17c2-4 5-7 9-9-3 3-6 6-8 10z"/>',
    bolt: '<path d="M13.5 2L4 13.5h6.5L9 22l11-12.5h-6.8z"/>',
    skull: '<path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.3 3 5.3V19h10v-3.6c1.8-1 3-2.7 3-5.3 0-4.4-3.3-7.6-8-7.6zM8.8 8.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6.4 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 13l1.2 2h-2.4z" fill-rule="evenodd"/>',
    crown: '<path d="M2 7l5 4 5-7 5 7 5-4-2 12H4zM4 20.5h16V22H4z"/>',
    moon: '<path d="M14.5 2.5A9.5 9.5 0 1 0 21.5 17 8 8 0 0 1 14.5 2.5z"/>',
    sword: '<path d="M20.5 2.5L21 7 10.5 17.5l1.5 1.5-1.5 1.5-2-2-3 3L4 20l3-3-2-2L6.5 13.5 8 15 18.5 4.5z"/>',
    eye: '<path d="M12 5C6.5 5 2.5 9.5 1.5 12c1 2.5 5 7 10.5 7s9.5-4.5 10.5-7C21.5 9.5 17.5 5 12 5zm0 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z" fill-rule="evenodd"/>',
    mushroom: '<path d="M12 2C6.5 2 2.5 6 2.5 10.5c0 1 .8 1.5 1.7 1.5h15.6c.9 0 1.7-.5 1.7-1.5C21.5 6 17.5 2 12 2zM9 13.5h6l.8 6.5a2 2 0 0 1-2 2.2h-3.6a2 2 0 0 1-2-2.2z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9zm1.2 6l4.8 9-2.4-9zm9.6 0l-2.4 9 4.8-9z" fill-rule="evenodd"/>',
    feather: '<path d="M21 3c-7 0-13 4.5-14.6 11.5L3 21l1.4.9 3-4.8C14 16 19 10 21 3zM9 15l6-6"/>',
    spell: '<path d="M12 1.5l1.9 6.6 6.6 1.9-6.6 1.9L12 18.5l-1.9-6.6-6.6-1.9 6.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9zM5 15.5l.7 1.8 1.8.7-1.8.7L5 20.5l-.7-1.8-1.8-.7 1.8-.7z"/>',
    tavern: '<path d="M5 6h11v3h1.8A3.2 3.2 0 0 1 21 12.2v2.6a3.2 3.2 0 0 1-3.2 3.2H16V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zm11 5v5h1.6c.7 0 1.4-.6 1.4-1.4v-2.2c0-.8-.7-1.4-1.4-1.4zM5.6 2.5c1.4-.9 3.1-1 4.4-.2 1.3-.8 3.1-.6 4.4.4 1.2.9 1.4 2.3.9 3.3H4.6c-.4-1.2-.1-2.6 1-3.5z"/>',
  };
  const mix = (hex, t) => { // t>0 lighten, t<0 darken
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t)));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  const initials = (name) => (name || "?").split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ0-9]/.test(w) && !/^(of|the|de|la|le)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  const svgURL = (s) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  const cache = new Map();
  // Raster portraits: drawn once on a canvas so the table never re-decodes SVG while animating.
  function drawGlyph(ctx, markup) {
    const re = /<(path|ellipse)\b([^>]*)\/>/g;
    let m;
    while ((m = re.exec(markup))) {
      const at = (n) => { const x = new RegExp(n + '="([^"]*)"').exec(m[2]); return x ? x[1] : null; };
      if (m[1] === "path") ctx.fill(new Path2D(at("d")), at("fill-rule") === "evenodd" ? "evenodd" : "nonzero");
      else { ctx.beginPath(); ctx.ellipse(+at("cx"), +at("cy"), +at("rx"), +at("ry"), 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function rasterPortrait(kind, tribe, name) {
    const S = 192, c = document.createElement("canvas"); c.width = S; c.height = S;
    const x = c.getContext("2d");
    const base = kind === "spell" ? "#6a4bd6" : tinfo(tribe).color || TRIBE_HUE[tribe] || TRIBE_HUE[""];
    const g = x.createRadialGradient(S * .5, S * .3, 0, S * .5, S * .3, S * .8);
    g.addColorStop(0, mix(base, .35)); g.addColorStop(.55, base); g.addColorStop(1, mix(base, -.6));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = "rgba(255,255,255,.09)"; x.lineWidth = 2;
    for (const r of [44, 67, 90, 113]) { x.beginPath(); x.arc(S / 2, S * .46, r, 0, Math.PI * 2); x.stroke(); }
    x.save(); x.translate(S * .23, S * .19); x.scale(S * .0225, S * .0225); x.fillStyle = "rgba(255,255,255,.2)";
    drawGlyph(x, kind === "spell" ? GLYPH.spell : glyphOf(tribe)); x.restore();
    if (kind !== "spell") {
      x.fillStyle = "rgba(255,255,255,.93)"; x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.font = `700 ${S * .2}px Fraunces, Georgia, serif`; x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 6;
      x.fillText(initials(name), S / 2, S * .75); x.shadowBlur = 0;
    }
    const v = x.createLinearGradient(0, 0, 0, S); v.addColorStop(0, "rgba(255,255,255,.18)"); v.addColorStop(.5, "rgba(255,255,255,0)");
    x.fillStyle = v; x.fillRect(0, 0, S, S);
    return c.toDataURL("image/png");
  }
  function portrait(kind, tribe, name) {
    const key = kind + "|" + tribe + "|" + name + "|" + (tinfo(tribe).color || "") + (tinfo(tribe).icon || "");
    if (cache.has(key)) return cache.get(key);
    if (typeof document !== "undefined") { const u = rasterPortrait(kind, tribe, name); cache.set(key, u); return u; }
    const base = kind === "spell" ? "#6a4bd6" : tinfo(tribe).color || TRIBE_HUE[tribe] || TRIBE_HUE[""];
    const glyph = kind === "spell" ? GLYPH.spell : glyphOf(tribe);
    const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs><radialGradient id="g" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${mix(base, 0.35)}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${mix(base, -0.6)}"/></radialGradient>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect width="200" height="200" fill="url(#g)"/>
      <g fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="2"><circle cx="100" cy="92" r="46"/><circle cx="100" cy="92" r="70"/><circle cx="100" cy="92" r="94"/><circle cx="100" cy="92" r="118"/></g>
      <g transform="translate(46 38) scale(4.5)" fill="#fff" fill-opacity=".2">${glyph}</g>
      <text x="100" y="${kind === "spell" ? 0 : 150}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="40" fill="#fff" fill-opacity=".92" letter-spacing="2">${kind === "spell" ? "" : initials(name)}</text>
      <rect width="200" height="200" fill="url(#v)"/></svg>`;
    const url = svgURL(s);
    cache.set(key, url);
    return url;
  }
  const defOf = (id) => { try { return root.WA.def(id); } catch (e) { return { tribe: "", name: id }; } };
  const spellDef = (id) => (root.WA.SPELLS[id] || { name: id });
  const img = (src, cls = "art") => `<img class="${cls}" src="${src}" alt="" draggable="false" loading="lazy" decoding="async">`;
  const minionURL = (id) => { const p = IMG()[id]; if (p) return p.card; const d = defOf(id); return portrait("minion", d.tribe || "", d.name); };
  const tinfo = (t) => (root.WA && root.WA.TRIBE_INFO && root.WA.TRIBE_INFO[t]) || {};
  const art = (id) => img(minionURL(id), IMG()[id] ? "art photo" : "art");
  const spellArt = (id) => { const p = IMG()["spell:" + id]; return img(p ? p.card : portrait("spell", "", spellDef(id).name), p ? "art photo" : "art"); };
  const glyphOf = (t) => { const k = tinfo(t).icon; return (k && GLYPH[k]) || GLYPH[t] || GLYPH[""]; };
  const tribeIcon = (t) => (t ? `<svg class="ticon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${glyphOf(t)}</svg>` : "");
  const glyphIcon = (k) => `<svg class="ticon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GLYPH[k] || GLYPH[""]}</svg>`;
  const ICON_KEYS = Object.keys(GLYPH).filter((k) => k && k !== "spell" && k !== "tavern");
  const token = (d) => { const p = IMG()[d.cardId]; return p ? p.tokURL || p.card : minionURL(d.cardId); };
  const hasPhoto = (id) => !!IMG()[id];
  root.WA_ART = { glyphIcon, ICON_KEYS, art, spellArt, tribeIcon, token, hasPhoto, portrait, TRIBE_HUE, ART_DEFS: "", installTheme() {},
    get INNKEEPER() { return `<svg class="keeper-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GLYPH.tavern}</svg>`; },
    cardFrame: () => "" };
})(typeof window !== "undefined" ? window : globalThis);
