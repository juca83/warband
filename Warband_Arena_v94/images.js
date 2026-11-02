// ===================================================================
// Warband Arena - player content store: custom cards and full-resolution
// images, kept in this browser (IndexedDB, with localStorage as a fallback).
// ===================================================================
(function (root) {
  "use strict";
  const DB = "wa-content", STORE = "kv";
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  const tx = (mode, fn) => db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
    const out = fn(st);
    t.oncomplete = () => res(out && "result" in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  }));
  const LS = "wa-content-fallback";
  let useLS = false;
  // ---------------------------------------------------------------- binary pictures
  // Pictures live in IndexedDB as Blobs and in memory as object URLs: a few bytes of string per picture instead of
  // a base64 copy of the whole file, and the browser decodes them on demand. Older saves (data: URLs) are converted
  // the first time they are read. Everything outside this file keeps seeing URL strings.
  const URL_OF = new WeakMap(), BLOB_OF = new Map();
  function urlOf(v) {
    if (!v) return v;
    if (typeof v === "string") return v;
    let u = URL_OF.get(v);
    if (!u) { u = URL.createObjectURL(v); URL_OF.set(v, u); BLOB_OF.set(u, v); }
    return u;
  }
  function dataToBlob(s) {
    const i = s.indexOf(","), head = s.slice(0, i), b64 = s.slice(i + 1), type = (/^data:([^;,]+)/.exec(head) || [, "image/png"])[1];
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type });
  }
  function toBlob(v) {
    if (!v) return v;
    if (typeof v !== "string") return v;
    if (v.startsWith("blob:")) return BLOB_OF.get(v) || v;
    if (v.startsWith("data:")) return dataToBlob(v);
    return v;
  }
  const blobToData = (b) => (typeof b === "string" ? Promise.resolve(b) : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); }));
  const PIC = ["src", "tok", "card"];
  const packRec = (rec) => { if (!rec) return rec; const o = Object.assign({}, rec); for (const k of PIC) if (o[k]) o[k] = toBlob(o[k]); return o; };
  const openRec = (rec) => { if (!rec) return rec; const o = Object.assign({}, rec); for (const k of PIC) if (o[k]) o[k] = urlOf(o[k]); return o; };
  async function exportRec(rec) { if (!rec) return rec; const o = Object.assign({}, rec); for (const k of PIC) if (o[k]) o[k] = await blobToData(toBlob(o[k])); return o; }
  const isLegacy = (rec) => !!rec && PIC.some((k) => typeof rec[k] === "string" && rec[k].startsWith("data:"));
  const lsAll = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } };
  async function get(k) {
    if (!useLS) try { return await tx("readonly", (s) => s.get(k)); } catch (e) { useLS = true; }
    return lsAll()[k];
  }
  async function put(k, v) {
    if (!useLS) try { return await tx("readwrite", (s) => s.put(v, k)); } catch (e) { useLS = true; }
    // localStorage can only hold text: pictures go back to data URLs there
    if (v && typeof v === "object" && PIC.some((x) => v[x] && typeof v[x] !== "string")) v = await exportRec(v);
    const all = lsAll(); all[k] = v;
    try { localStorage.setItem(LS, JSON.stringify(all)); } catch (e) { throw new Error("This browser is out of storage space for images."); }
  }
  async function del(k) {
    if (!useLS) try { return await tx("readwrite", (s) => s.delete(k)); } catch (e) { useLS = true; }
    const all = lsAll(); delete all[k]; try { localStorage.setItem(LS, JSON.stringify(all)); } catch (e) {}
  }

  // ---------------------------------------------------------------- images
  // key ("minion id" or "spell:id") -> { tok: HTMLImageElement, card: dataURL, v }
  const IMAGES = {};
  let version = 0;
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read that image.")); i.src = src; });

  // Draw `img` to cover a W x H box, zoomed around the focus point (fx, fy in 0..1).
  // Where the picture sits in a W x H frame: zoom 1 = just covers the frame; (fx, fy) = the point of the
  // picture at the frame's centre. A picture bigger than the frame never shows an edge; a smaller one stays inside.
  function layout(W, H, iw, ih, crop) {
    const z = Math.max(0.2, crop.z || 1), cov = Math.max(W / iw, H / ih), dw = iw * cov * z, dh = ih * cov * z;
    let x = W / 2 - (crop.fx == null ? 0.5 : crop.fx) * dw, y = H / 2 - (crop.fy == null ? 0.5 : crop.fy) * dh;
    x = dw >= W ? Math.min(0, Math.max(W - dw, x)) : Math.max(0, Math.min(W - dw, x));
    y = dh >= H ? Math.min(0, Math.max(H - dh, y)) : Math.max(0, Math.min(H - dh, y));
    return { x, y, dw, dh, cov };
  }
  // Keep the focus point inside the range that actually moves the picture (no dead zone while dragging).
  function clampCrop(W, H, iw, ih, crop) {
    const { dw, dh } = layout(W, H, iw, ih, crop);
    const lim = (F, d, v) => { const a = F / (2 * d), b = 1 - F / (2 * d); return Math.max(Math.min(a, b), Math.min(Math.max(a, b), v)); };
    crop.fx = lim(W, dw, crop.fx == null ? 0.5 : crop.fx); crop.fy = lim(H, dh, crop.fy == null ? 0.5 : crop.fy);
    return crop;
  }
  // Zoom at which the whole picture fits inside a W x H frame.
  const fitZoom = (W, H, iw, ih) => Math.min(W / iw, H / ih) / Math.max(W / iw, H / ih);
  // same as cover() but hands back a Blob (binary, no base64 round trip)
  function coverBlob(img, W, H, crop, type = "image/jpeg") {
    const c = coverCanvas(img, W, H, crop);
    return new Promise((res) => c.toBlob((b) => res(b), type, 0.9));
  }
  function cover(img, W, H, crop, type = "image/jpeg") { return coverCanvas(img, W, H, crop).toDataURL(type, 0.9); }
  function coverCanvas(img, W, H, crop) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const { x, y, dw, dh, cov } = layout(W, H, iw, ih, crop);
    ctx.fillStyle = "#1a1d3a"; ctx.fillRect(0, 0, W, H);
    if (dw < W || dh < H) {
      // zoomed out: fill the gaps with a soft, darkened blur of the same picture
      ctx.save(); ctx.filter = "blur(14px) brightness(.6) saturate(1.2)";
      ctx.drawImage(img, (W - iw * cov * 1.15) / 2, (H - ih * cov * 1.15) / 2, iw * cov * 1.15, ih * cov * 1.15);
      ctx.restore();
    }
    ctx.drawImage(img, x, y, dw, dh);
    return c;
  }
  // Shrink an uploaded file to at most `max` px on its long side.
  async function fromFile(file, max = 1024) {
    if (!/^image\//.test(file.type)) throw new Error("That file is not an image.");
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const png = /png|gif|webp|svg/.test(file.type);
      const blob = await new Promise((res) => c.toBlob((b) => res(b), png ? "image/png" : "image/jpeg", 0.92));
      return urlOf(blob);
    } finally { URL.revokeObjectURL(url); }
  }
  // Rendered versions: token portrait (oval, 28:36) and card window (4:3).
  // Card window (6:5) and board token (about 3:4) are framed separately.
  const CARD_W = 480, CARD_H = 472, TOK_W = 270, TOK_H = 354;
  async function renderVersions(src, crop, tcrop) {
    const img = await loadImg(urlOf(src));
    const [card, tok] = await Promise.all([coverBlob(img, CARD_W, CARD_H, crop), coverBlob(img, TOK_W, TOK_H, tcrop || crop)]);
    return { card: urlOf(card), tok: urlOf(tok) };
  }
  async function install(key, rec) {
    if (!rec) { delete IMAGES[key]; version++; return; }
    IMAGES[key] = { tokURL: urlOf(rec.tok), card: urlOf(rec.card), v: ++version };
  }

  // ---------------------------------------------------------------- metas
  // A meta is a separate card set. "classic" holds the built-in cards plus your edits;
  // a blank meta starts with no cards at all. Each meta keeps its own cards and pictures.
  let activeRead = false;
  let metas = [], active = "classic", cards = [], tribes = null, heroes = null, anomalies = null, tableDesign = null, tables = null, affinities = null, keywords = null, style = null; // null = the built-in tribes / heroes; style: the meta's look (theme, effects, sounds, screens, texts, frames)
  // ---- the skin library: every painted asset lives once, in "lib"; each meta equips one per kind ("equip:<meta>")
  const SKIN_KINDS = ["table", "card", "token", "endturn", "bartender"];
  const GEM_F = ["gemAtk", "gemHp", "gemTier", "artMask"], PIC_F = ["src", "normal", "golden", "spell", "gemAtk", "gemHp", "gemTier", "artMask"]; // card skins can bring their three gems as separate pictures
  let lib = [], equip = {}; const libData = {}; // lib: [{ id, kind, name }], libData[id]: the record with Blobs
  const entry = (id) => lib.find((e) => e.id === id) || null;
  const libUrl = (id) => { const e = entry(id), d = libData[id]; if (!e || !d) return null; const o = { id: e.id, kind: e.kind, name: e.name };
    if (e.kind === "table") { o.src = urlOf(d.src); o.dim = d.dim == null ? 0.35 : d.dim; }
    else if (e.kind === "bartender") o.src = urlOf(d.src);
    else { o.normal = urlOf(d.normal); o.golden = d.golden ? urlOf(d.golden) : null; o.spell = d.spell ? urlOf(d.spell) : null; for (const g of GEM_F) o[g] = d[g] ? urlOf(d[g]) : null; if (d.natW) o.natW = d.natW; o.w = d.w || 0; o.h = d.h || 0; o.layout = d.layout || null; }
    return o; };
  const packSkin = (kind, data) => kind === "table" ? { src: toBlob(data.src), dim: data.dim == null ? 0.35 : data.dim } : kind === "bartender" ? { src: toBlob(data.src) }
    : { normal: toBlob(data.normal), golden: data.golden ? toBlob(data.golden) : null, spell: data.spell ? toBlob(data.spell) : null, gemAtk: data.gemAtk ? toBlob(data.gemAtk) : null, gemHp: data.gemHp ? toBlob(data.gemHp) : null, gemTier: data.gemTier ? toBlob(data.gemTier) : null, artMask: data.artMask ? toBlob(data.artMask) : null, natW: data.natW || 0, w: data.w || 0, h: data.h || 0, layout: data.layout || null };
  async function loadLib() {
    lib = await get("skinlib");
    if (!lib) { lib = []; await migrateSkins(); }
    for (const e of lib) if (!libData[e.id]) { const d = await get("lib:" + e.id); if (d) libData[e.id] = d; }
    lib = lib.filter((e) => libData[e.id]);
    equip = (await get("equip:" + active)) || {};
    for (const k of SKIN_KINDS.concat(["made"])) if (equip[k] && equip[k] !== "random" && !entry(equip[k])) equip[k] = null;
  }
  // one-time: the old per-meta records (table background, card skin, token/button skins, bartender skins) become library entries
  async function migrateSkins() {
    const ms = metas.length ? metas : [{ id: "classic", name: "Classic" }];
    for (const m of ms) {
      const eq = {};
      const addE = async (kind, name, data) => { const id = "sk" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); lib.push({ id, kind, name }); libData[id] = data; await put("lib:" + id, data); return id; };
      const tb = await get("tablebg:" + m.id); if (tb && tb.src) { eq.table = await addE("table", m.name + " · table", { src: toBlob(tb.src), dim: tb.dim }); await del("tablebg:" + m.id); }
      const cs = await get("cardskin:" + m.id); if (cs && cs.normal) { eq.card = await addE("card", m.name + " · cards", cs); await del("cardskin:" + m.id); }
      for (const k of ["token", "endturn"]) { const r = await get("skin:" + k + ":" + m.id); if (r && r.normal) { eq[k] = await addE(k, m.name + (k === "token" ? " · tokens" : " · button"), r); await del("skin:" + k + ":" + m.id); } }
      const bt = await get("bartender:" + m.id);
      if (bt && bt.skins && bt.skins.length) { const map = {}; for (const x of bt.skins) map[x.id] = await addE("bartender", x.name || "Bartender", { src: toBlob(x.src) }); eq.bartender = bt.active === "random" ? "random" : map[bt.active] || null; await del("bartender:" + m.id); }
      if (Object.keys(eq).length) await put("equip:" + m.id, eq);
    }
    await put("skinlib", lib);
  }
  async function addSkin(kind, name, data, origin) {
    const id = "sk" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), rec = packSkin(kind, data);
    lib = lib.concat([Object.assign({ id, kind, name: (name || kind).trim().slice(0, 32) }, origin ? { origin } : {})]); libData[id] = rec;
    await put("lib:" + id, rec); await put("skinlib", lib);
    return id;
  }
  async function updateSkin(id, patch) {
    const e = entry(id); if (!e) return;
    const cur = libUrl(id), rec = packSkin(e.kind, Object.assign({}, cur, patch));
    libData[id] = rec; await put("lib:" + id, rec);
  }
  async function renameSkin(id, name) { lib = lib.map((e) => (e.id === id ? Object.assign({}, e, { name: (name || e.name).trim().slice(0, 32) }) : e)); await put("skinlib", lib); }
  async function deleteSkin(id) {
    const e = entry(id); if (!e) return;
    lib = lib.filter((x) => x.id !== id); delete libData[id]; await del("lib:" + id); await put("skinlib", lib);
    for (const m of metas) { const eq = (await get("equip:" + m.id)) || null; if (eq && eq[e.kind] === id) { eq[e.kind] = null; await put("equip:" + m.id, eq); if (m.id === active) equip = eq; } }
  }
  // the player's own choice: remembered apart, so a newer copy of a friend's meta never takes it back
  async function equipSkin(kind, id) { equip = Object.assign({}, equip, { [kind]: id || null }); await put("equip:" + active, equip);
    const own = (await get("equipOwn:" + active)) || {}; own[kind] = 1; await put("equipOwn:" + active, own); }
  // "made" (the frame of tokens, minions made by effects) picks among the board skins ("token")
  const skinList = (kind) => lib.filter((e) => !kind || e.kind === (kind === "made" ? "token" : kind)).map((e) => libUrl(e.id));
  // for sharing: where a skin came from ("<friend>:<their id>", or null when it is ours), lookup by that, and its data as data URLs
  const skinOrigin = (id) => { const e = entry(id); return e ? e.origin || null : null; };
  const findSkinByOrigin = (origin) => { const e = lib.find((x) => x.origin === origin); return e ? e.id : null; };
  async function skinData(id) { const e = entry(id), d = libData[id]; if (!e || !d) return null; const o = { kind: e.kind, name: e.name }; for (const f of PIC_F) if (d[f]) o[f] = await blobToData(toBlob(d[f])); for (const f of ["dim", "w", "h", "natW", "layout"]) if (d[f] != null) o[f] = d[f]; return o; }
  async function imageData(key) { const r = await get(ik(key)); return r ? exportRec(r) : null; }
  const opts = () => ({ blank: !!meta().blank, tribes: tribes || undefined, heroes: heroes || undefined, anomalies: anomalies || undefined, affinities: affinities || undefined, keywords: keywords || undefined });
  const meta = () => metas.find((m) => m.id === active) || metas[0];
  const ik = (k) => `img:${active}/${k}`;
  async function migrate() {
    metas = (await get("metas")) || null;
    if (metas && metas.length) return;
    metas = [{ id: "classic", name: "Classic", blank: false }];
    const old = (await get("cards")) || [];
    const keys = (await get("imageKeys")) || [];
    for (const k of keys) { const r = await get("img:" + k); if (r) await put(`img:classic/${k}`, r); }
    await put("cards:classic", old);
    await put("imageKeys:classic", keys);
    await put("metas", metas);
  }
  async function load() {
    for (const k in IMAGES) delete IMAGES[k];
    version++;
    try {
      await migrate();
      if (!activeRead) { active = (await get("activeMeta")) || "classic"; activeRead = true; } // later loads keep this tab's meta (another window of the same browser may have switched)
      if (!metas.some((m) => m.id === active)) active = metas[0].id;
      cards = (await get("cards:" + active)) || [];
      tribes = (await get("tribes:" + active)) || null;
      heroes = (await get("heroes:" + active)) || null;
      anomalies = (await get("anomalies:" + active)) || null;
      affinities = (await get("affinities:" + active)) || null;
      keywords = (await get("keywords:" + active)) || null;
      style = (await get("style:" + active)) || null;
      tables = (await get("tables:" + active)) || null;
      if (!tables) { // one-time: the single design of v39/v40 becomes the first saved table, offered to players
        const old = await get("tabledesign:" + active);
        if (old) { tables = { list: [{ id: "t1", name: "Table 1", offered: true, layout: old.layout || {}, props: old.props || [], slots: old.slots || [] }], objects: old.objects || [], pick: "t1" }; await put("tables:" + active, tables); await del("tabledesign:" + active); }
      }
      tableDesign = composeTable();
      await loadLib();
      const keys = (await get("imageKeys:" + active)) || [];
      await Promise.all(keys.map(async (k) => { try {
        let r = await get(ik(k));
        if (isLegacy(r)) { r = packRec(r); put(ik(k), r).catch(() => {}); } // one-time: base64 -> Blob
        await install(k, r);
      } catch (e) {} }));
    } catch (e) { if (!metas.length) metas = [{ id: "classic", name: "Classic", blank: false }]; cards = []; }
    root.WA.registerCustom(cards, opts());
    applyTribeStyles();
    if (root.WA_STYLE) root.WA_STYLE.apply(borrowed ? borrowed.style : style);
    return cards;
  }
  // colours for player-made tribes (built-in ones are in the stylesheet unless recoloured)
  function applyTribeStyles() {
    if (typeof document === "undefined") return;
    let st = document.getElementById("tribeStyles");
    if (!st) { st = document.createElement("style"); st.id = "tribeStyles"; document.head.appendChild(st); }
    const css = [];
    for (const id of root.WA.TRIBES) { const c = root.WA.TRIBE_INFO[id] && root.WA.TRIBE_INFO[id].color; if (c) css.push(`[data-tribe="${id.replace(/"/g, "")}"][data-tribe] { --tribe: ${c}; }`); }
    st.textContent = css.join("\n");
  }
  async function saveHeroes(list) {
    heroes = list;
    await put("heroes:" + active, list);
    root.WA.registerCustom(cards, opts());
  }
  // the table design of this meta: moved / resized table elements and clickable sprites (images kept as Blobs)
  // slots = placeholders a player fills from the Collection; objects = the sprites a player can put in them
  const blobs = (l) => (l || []).map((pr) => Object.assign({}, pr, { img: toBlob(pr.img) }));
  // tables: several designs per meta (each one: layout, sprites, placeholders), the ones marked "offered" can be picked by players in the Collection;
  // objects are shared by all the tables of the meta; pick = the player's table ("" = the plain built-in table)
  const T0 = () => tables || { list: [], objects: [], pick: undefined };
  function pickedTable() { const T = T0(); if (T.pick === "") return null; const off = T.list.filter((x) => x.offered); return off.find((x) => x.id === T.pick) || off[0] || null; }
  function composeTable() { const t = pickedTable(), T = T0(); if (!t && !T.objects.length) return null; return { id: t ? t.id : "", name: t ? t.name : "", layout: (t && t.layout) || {}, props: (t && t.props) || [], slots: (t && t.slots) || [], objects: T.objects || [], ambience: (t && t.ambience) || null }; }
  // a table's ambience: particles, light, background motion, music (a Blob in storage, a data URL when shared)
  const ambBlob = (a) => (a ? Object.assign({}, a, { music: a.music ? toBlob(a.music) : null }) : null);
  const ambData = async (a) => (a ? Object.assign({}, a, { music: a.music ? await blobToData(toBlob(a.music)) : null }) : null);
  const cleanTable = (x) => ({ id: x.id, name: String(x.name || "Table").slice(0, 40), offered: !!x.offered, layout: x.layout || {}, props: blobs(x.props), slots: (x.slots || []).map((y) => Object.assign({}, y)), ambience: ambBlob(x.ambience) });
  async function putTables(T) { tables = T.list.length || T.objects.length ? T : null; if (tables) await put("tables:" + active, tables); else await del("tables:" + active); tableDesign = composeTable(); }
  async function saveTable(x) { const T = T0(), c = cleanTable(x); const list = T.list.some((y) => y.id === c.id) ? T.list.map((y) => (y.id === c.id ? c : y)) : T.list.concat([c]); await putTables(Object.assign({}, T, { list })); return c; }
  async function deleteTable(id) { const T = T0(); await putTables(Object.assign({}, T, { list: T.list.filter((y) => y.id !== id), pick: T.pick === id ? undefined : T.pick })); }
  async function saveTableObjects(l) { await putTables(Object.assign({}, T0(), { objects: blobs(l) })); }
  async function pickTable(id) { await putTables(Object.assign({}, T0(), { pick: id })); if (!tables) tableDesign = null; }
  // older callers: save one design as the table being shown (or a new one)
  async function saveTableDesign(d) {
    if (!d) return;
    const cur = d.id ? T0().list.find((y) => y.id === d.id) : pickedTable();
    await saveTable(Object.assign({ id: "t" + Date.now().toString(36), name: "Table " + (T0().list.length + 1), offered: true }, cur || {}, d, { id: (cur && cur.id) || d.id || "t" + Date.now().toString(36) }));
    if (d.objects) await saveTableObjects(d.objects);
  }
  const datas = (l) => Promise.all((l || []).map(async (pr) => Object.assign({}, pr, { img: pr.img ? await blobToData(toBlob(pr.img)) : null })));
  async function packTables(T) { if (!T) return null; return { list: await Promise.all(T.list.map(async (x) => Object.assign({}, x, { props: await datas(x.props), ambience: await ambData(x.ambience) }))), objects: await datas(T.objects), pick: T.pick }; }
  const unpackTables = (T) => (T ? { list: (T.list || []).map((x) => Object.assign({}, x, { props: blobs(x.props), ambience: ambBlob(x.ambience) })), objects: blobs(T.objects), pick: T.pick } : null);
  async function packTableDesign(d) { if (!d) return null; return { layout: d.layout || {}, props: await datas(d.props), slots: d.slots || [], objects: await datas(d.objects), ambience: await ambData(d.ambience) }; }
  const unpackTableDesign = (d) => (d ? { layout: d.layout || {}, props: blobs(d.props), slots: d.slots || [], objects: blobs(d.objects), ambience: ambBlob(d.ambience) } : null);
  async function saveAnomalies(list) {
    anomalies = list;
    await put("anomalies:" + active, list);
    root.WA.registerCustom(cards, opts());
  }
  // affinity thresholds and values of this meta ({ coral: { t1, t2, v1, v2 }, ... }); null = the defaults
  async function saveAffinities(cfg) {
    affinities = cfg && Object.keys(cfg).length ? cfg : null;
    if (affinities) await put("affinities:" + active, affinities); else await del("affinities:" + active);
    root.WA.registerCustom(cards, opts());
  }
  // the meta's look: theme, visual effects, sounds and music, screens, texts, frames (one object, media as data URLs)
  async function saveStyle(cfg) {
    style = cfg && Object.keys(cfg).length ? cfg : null;
    if (style) await put("style:" + active, style); else await del("style:" + active);
    if (root.WA_STYLE) root.WA_STYLE.apply(borrowed ? borrowed.style : style);
  }
  // the custom keywords of this meta: [{ id, name, color, icon, tip, abilities }]
  async function saveKeywords(list) {
    keywords = list && list.length ? list : null;
    if (keywords) await put("keywords:" + active, keywords); else await del("keywords:" + active);
    root.WA.registerCustom(cards, opts());
  }
  async function saveTribes(list) {
    tribes = list;
    await put("tribes:" + active, list);
    root.WA.registerCustom(cards, opts());
    applyTribeStyles();
  }
  async function saveCards(list) {
    cards = list;
    await put("cards:" + active, list);
    root.WA.registerCustom(list, opts());
  }
  async function saveImage(key, rec) {
    const keys = new Set((await get("imageKeys:" + active)) || []);
    const packed = packRec(rec);
    if (packed) { await put(ik(key), packed); keys.add(key); } else { await del(ik(key)); keys.delete(key); }
    await put("imageKeys:" + active, [...keys]);
    await install(key, packed);
  }
  // records handed out carry URL strings; exports carry data URLs so they can be pasted anywhere
  const getImage = async (key) => openRec(await get(ik(key)));
  async function allImages() {
    const keys = (await get("imageKeys:" + active)) || [], out = {};
    for (const k of keys) { const r = await get(ik(k)); if (r) out[k] = await exportRec(r); }
    return out;
  }
  async function setActive(id) { active = id; await put("activeMeta", id); return load(); }
  // mode: "blank" (no cards) or "copy" (duplicate the active meta, cards and pictures)
  async function createMeta(name, mode) {
    const id = "m" + Date.now().toString(36);
    const src = meta();
    const m = { id, name: name || "New meta", blank: mode === "blank" || mode === "empty" ? true : !!src.blank };
    if (mode === "copy") {
      const imgs = {}; for (const k of (await get("imageKeys:" + active)) || []) { const r = await get(ik(k)); if (r) imgs[k] = packRec(r); }
      await put("cards:" + id, cards);
      if (tribes) await put("tribes:" + id, tribes);
      if (heroes) await put("heroes:" + id, heroes);
      if (anomalies) await put("anomalies:" + id, anomalies);
      if (affinities) await put("affinities:" + id, affinities);
      if (keywords) await put("keywords:" + id, keywords);
      if (style) await put("style:" + id, style);
      if (tables) await put("tables:" + id, tables);
      await put("equip:" + id, Object.assign({}, equip));
      for (const [k, r] of Object.entries(imgs)) await put(`img:${id}/${k}`, r);
      await put("imageKeys:" + id, Object.keys(imgs));
    } else { await put("cards:" + id, []); await put("imageKeys:" + id, []); if (mode === "empty") { await put("tribes:" + id, []); await put("heroes:" + id, []); await put("anomalies:" + id, []); } }
    metas = metas.concat([m]);
    await put("metas", metas);
    await setActive(id);
    return m;
  }
  // ---- a whole meta as one portable object (cards, tribes, heroes, anomalies, pictures, equipped skins), for a friend's game
  async function packMeta() {
    const m = meta(), skins = {};
    for (const k of SKIN_KINDS) { const id = equip[k]; if (!id || id === "random") continue; const e = entry(id), d = libData[id]; if (!e || !d) continue;
      const o = { id, name: e.name }; for (const f of PIC_F) if (d[f]) o[f] = await blobToData(toBlob(d[f])); for (const f of ["dim", "w", "h", "natW", "layout"]) if (d[f] != null) o[f] = d[f]; skins[k] = o; }
    return { format: "warband-arena-meta", version: 1, id: m.id, name: m.name, blank: !!m.blank, cards, tribes: tribes || null, heroes: heroes || null, anomalies: anomalies || null, affinities: affinities || null, keywords: keywords || null, style: style || null, tableDesign: await packTableDesign(tableDesign), tables: await packTables(tables), images: await allImages(), skins, bartenderRandom: equip.bartender === "random" };
  }
  // ---- a meta in pieces, each with a short fingerprint: the rules and cards ("core"), the look and sounds ("style"),
  // every picture, every equipped skin. Two games compare the lists and only the pieces that differ travel.
  function hs(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0") + str.length.toString(36);
  }
  const NOT_CORE = ["images", "skins", "style", "stamp", "from"];
  const coreOf = (pack) => { const c = {}; for (const k of Object.keys(pack)) if (!NOT_CORE.includes(k)) c[k] = pack[k]; return c; };
  function manifestOf(pack) {
    const imgs = {}, skins = {};
    for (const [k, r] of Object.entries(pack.images || {})) imgs[k] = hs(JSON.stringify(r));
    for (const [k, o] of Object.entries(pack.skins || {})) if (o) skins[k] = hs(JSON.stringify(o));
    return { id: pack.id, core: hs(JSON.stringify(coreOf(pack))), style: hs(JSON.stringify(pack.style || null)), imgs, skins };
  }
  // the active meta, packed, with its list of pieces
  async function metaPrint() { const pack = await packMeta(); return { pack, man: manifestOf(pack) }; }
  // this game's copy of a friend's meta (by the friend's meta id) and the pieces it holds
  async function localCopy(packId) {
    const cands = metas.filter((m) => m.origin && m.origin.endsWith(":" + packId)).reverse();
    if (!cands.length) return null;
    for (const m of cands) { const parts = await get("parts:" + m.id); if (parts) return { id: m.id, parts }; }
    // a copy kept before v76: its pictures can be checked, the rest is sent again once
    const m = cands[0], imgs = {};
    for (const k of (await get("imageKeys:" + m.id)) || []) { const r = await get(`img:${m.id}/${k}`); if (r) imgs[k] = hs(JSON.stringify(await exportRec(r))); }
    return { id: m.id, parts: { id: packId, core: "?", style: "?", imgs, skins: {} } };
  }
  // what is missing here compared with the host's list
  function missing(man, parts) {
    const p = parts || { imgs: {}, skins: {} };
    return { core: p.core !== man.core, style: p.style !== man.style, imgs: Object.keys(man.imgs).filter((k) => p.imgs[k] !== man.imgs[k]), skins: Object.keys(man.skins).filter((k) => (p.skins || {})[k] !== man.skins[k]) };
  }
  const nothingMissing = (n) => !n.core && !n.style && !n.imgs.length && !n.skins.length;
  // a meta shipped next to the game (ma-meta.js, made with "For a friend"): installed and picked the first time,
  // and again whenever a newer one replaces the file. Returns { name, from } when it installed something.
  async function installBundled() {
    const pack = root.WA_BUNDLED_META;
    if (!pack || pack.format !== "warband-arena-meta") return null;
    const stamp = String(pack.stamp || pack.id || ""), seen = await get("bundledStamp:" + (pack.from || "") + ":" + pack.id);
    const have = metas.find((m) => m.origin === (pack.from || "Pack") + ":" + pack.id);
    if (seen === stamp && have) { if (!(await get("parts:" + have.id))) await put("parts:" + have.id, manifestOf(pack)); return null; } // copies installed before v76 get their list
    const id = await importMeta(pack, pack.from || "Pack");
    await put("bundledStamp:" + (pack.from || "") + ":" + pack.id, stamp);
    await setActive(id);
    return { name: pack.name || "", from: pack.from || "", updated: !!seen };
  }
  // keep a friend's meta: a new meta (or the one already kept from the same source, updated), pictures and skins included. Returns its id.
  async function importMeta(pack, fromName, sentMan) {
    if (!pack || pack.format !== "warband-arena-meta") throw new Error("not a meta pack");
    const origin = (fromName || "friend") + ":" + pack.id;
    let m = metas.find((x) => x.origin === origin);
    if (!m) { m = { id: "m" + Date.now().toString(36), name: (pack.name || "Shared meta").slice(0, 40), blank: !!pack.blank, origin, from: fromName || "" }; metas = metas.concat([m]); }
    const man = sentMan || manifestOf(pack);
    return patchMeta(m.id, { core: coreOf(pack), style: pack.style || null, images: pack.images || {}, skins: pack.skins || {} }, man, missing(man, null));
  }
  // write into a kept copy only the pieces that changed (part holds them; man is the sender's full list)
  async function patchMeta(id, part, man, need) {
    let m = metas.find((x) => x.id === id); if (!m) throw new Error("no such meta");
    const fromName = m.from || "", origin = m.origin;
    if (need.core) {
      const c = part.core;
      m = Object.assign({}, m, { name: ((c.name || "Shared meta") + (fromName ? " · " + fromName : "")).slice(0, 40), blank: !!c.blank });
      metas = metas.map((x) => (x.id === id ? m : x));
      const oldTables = await get("tables:" + id);
      await put("cards:" + id, c.cards || []);
      for (const k of ["tribes", "heroes", "anomalies", "affinities", "keywords"]) { if (c[k]) await put(k + ":" + id, c[k]); else await del(k + ":" + id); }
      await del("expedition:" + id); await del("tabledesign:" + id);
      if (c.tables) { const T = unpackTables(c.tables); if (oldTables && oldTables.pick && T.list.some((t) => t.id === oldTables.pick && t.offered)) T.pick = oldTables.pick; await put("tables:" + id, T); } // the board the player picked stays picked
      else if (c.tableDesign) { const d = unpackTableDesign(c.tableDesign); await put("tables:" + id, { list: [{ id: "t1", name: "Table 1", offered: true, layout: d.layout, props: d.props, slots: d.slots }], objects: d.objects, pick: "t1" }); }
      else await del("tables:" + id);
    }
    if (need.style) { if (part.style) await put("style:" + id, part.style); else await del("style:" + id); }
    // pictures: the changed ones written, the ones the sender dropped removed
    const keep = Object.keys(man.imgs);
    for (const k of (await get("imageKeys:" + id)) || []) if (!(k in man.imgs)) await del(`img:${id}/${k}`);
    for (const k of need.imgs) { const r = (part.images || {})[k]; if (r) await put(`img:${id}/${k}`, packRec(r)); }
    await put("imageKeys:" + id, keep);
    // skins: one library entry per (friend, their skin id), updated in place when it comes again
    const oldEquip = (await get("equip:" + id)) || {}, own = (await get("equipOwn:" + id)) || {}, eq = {};
    for (const kind of Object.keys(man.skins)) {
      const o = (part.skins || {})[kind];
      if (o) {
        const sOrigin = origin + ":" + o.id; let e = lib.find((x) => x.origin === sOrigin);
        const data = packSkin(kind, o);
        if (!e) { const sid = "sk" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); e = { id: sid, kind, name: (o.name || kind).slice(0, 32), origin: sOrigin }; lib = lib.concat([e]); }
        else lib = lib.map((x) => (x.id === e.id ? Object.assign({}, x, { name: (o.name || x.name).slice(0, 32) }) : x));
        libData[e.id] = data; await put("lib:" + e.id, data); eq[kind] = e.id;
      } else if (oldEquip[kind] && oldEquip[kind] !== "random") eq[kind] = oldEquip[kind]; // unchanged: the same entry as before
    }
    const bRandom = need.core ? !!(part.core && part.core.bartenderRandom) : oldEquip.bartender === "random";
    if (bRandom) eq.bartender = "random";
    for (const k of Object.keys(own)) if (k in oldEquip && (!oldEquip[k] || oldEquip[k] === "random" || lib.some((x) => x.id === oldEquip[k]))) eq[k] = oldEquip[k]; // the player's own skin choices stay
    await put("skinlib", lib); await put("equip:" + id, eq);
    await put("parts:" + id, man);
    await put("metas", metas);
    if (id === active) await load();
    return id;
  }
  async function renameMeta(id, name) {
    metas = metas.map((m) => (m.id === id ? { ...m, name: name || m.name } : m));
    await put("metas", metas);
  }
  async function deleteMeta(id) {
    if (id === "classic" || metas.length < 2) return false;
    const keys = (await get("imageKeys:" + id)) || [];
    for (const k of keys) await del(`img:${id}/${k}`);
    await del("imageKeys:" + id); await del("cards:" + id); await del("tribes:" + id); await del("heroes:" + id); await del("anomalies:" + id); await del("expedition:" + id); await del("affinities:" + id); await del("keywords:" + id); await del("style:" + id); await del("tabledesign:" + id); await del("tables:" + id); await del("equip:" + id); await del("equipOwn:" + id); await del("parts:" + id);
    metas = metas.filter((m) => m.id !== id);
    await put("metas", metas);
    if (active === id) await setActive("classic"); else await load();
    return true;
  }
  // Is the active meta playable? Returns a reason, or "" when it is.
  function playable() {
    const W = root.WA, ids = Object.keys(W.CARDS).filter((id) => W.CARDS[id].inPool !== false);
    if (!ids.some((id) => W.CARDS[id].tier === 1)) return `The meta "${meta().name}" has no tier 1 minion that can appear in the tavern.`;
    if (ids.length < 3) return `The meta "${meta().name}" needs at least 3 minions that can appear in the tavern.`;
    return "";
  }

  // a friend's game: their skins and table are shown for the length of the game, nothing is saved
  let borrowed = null;
  function borrow(pack) {
    const sk = {};
    for (const [kind, o] of Object.entries((pack && pack.skins) || {})) {
      if (!o) continue;
      if (kind === "table") sk.table = { id: o.id, kind, name: o.name, src: o.src, dim: o.dim == null ? 0.35 : o.dim };
      else if (kind === "bartender") sk.bartender = { id: o.id, kind, name: o.name, src: o.src };
      else sk[kind] = { id: o.id, kind, name: o.name, normal: o.normal, golden: o.golden || null, spell: o.spell || null, gemAtk: o.gemAtk || null, gemHp: o.gemHp || null, gemTier: o.gemTier || null, artMask: o.artMask || null, w: o.w || 0, h: o.h || 0, layout: o.layout || null };
    }
    let td = null;
    if (pack && pack.tables) { const T = unpackTables(pack.tables), off = T.list.filter((x) => x.offered), t = off.find((x) => x.id === T.pick) || off[0] || null; if (t || T.objects.length) td = { id: t ? t.id : "", name: t ? t.name : "", layout: (t && t.layout) || {}, props: (t && t.props) || [], slots: (t && t.slots) || [], objects: T.objects || [], ambience: (t && t.ambience) || null }; }
    else if (pack && pack.tableDesign) td = unpackTableDesign(pack.tableDesign);
    borrowed = { skins: sk, table: td, style: (pack && pack.style) || null };
    if (root.WA_STYLE) root.WA_STYLE.apply(borrowed.style);
  }
  function unborrow() { borrowed = null; if (root.WA_STYLE) root.WA_STYLE.apply(style); }
  root.WA_STORE = { layout, clampCrop, fitZoom, CARD_ASPECT: CARD_W / CARD_H, TOK_ASPECT: TOK_W / TOK_H, preview: install, load, saveCards, saveImage, getImage, allImages, fromFile, renderVersions, cover, IMAGES,
    installBundled, metaPrint, localCopy, missing, nothingMissing, patchMeta, get storageMode() { return useLS ? "fallback" : "indexeddb"; }, setActive, createMeta, renameMeta, deleteMeta, playable, saveTribes, applyTribeStyles, get tribes() { return tribes; }, saveHeroes, get heroes() { return heroes; }, saveAnomalies, get anomalies() { return anomalies; },   saveAffinities, get affinities() { return affinities; }, saveKeywords, get keywords() { return keywords; }, saveStyle, get style() { return borrowed ? borrowed.style : style; }, get ownStyle() { return style; }, saveTableDesign, get tableDesign() { return borrowed ? borrowed.table : tableDesign; }, borrow, unborrow, get borrowing() { return !!borrowed; }, saveTable, deleteTable, saveTableObjects, pickTable, get tables() { return T0().list; }, get tableObjects() { return T0().objects; }, get tablePick() { const t = pickedTable(); return t ? t.id : ""; }, SKIN_KINDS, urlOf, toBlob, regOpts: opts, packMeta, importMeta, skinOrigin, findSkinByOrigin, skinData, imageData, addSkin, updateSkin, renameSkin, deleteSkin, equipSkin, skinList, skinOf: (kind) => (borrowed ? borrowed.skins[kind] || null : equip[kind] && equip[kind] !== "random" ? libUrl(equip[kind]) : null), get equipped() { return Object.assign({}, equip); },
    get tableBg() { if (borrowed) return borrowed.skins.table || null; return equip.table ? libUrl(equip.table) : null; }, get cardSkin() { if (borrowed) return borrowed.skins.card || null; return equip.card ? libUrl(equip.card) : null; },
    get bartender() { if (borrowed) { const b = borrowed.skins.bartender; return b ? { skins: [b], active: b.id } : null; } const skins = lib.filter((e) => e.kind === "bartender").map((e) => libUrl(e.id)); return skins.length ? { skins, active: equip.bartender || "default" } : null; },
    get metas() { return metas; }, get active() { return active; }, get meta() { return meta(); },
    get cards() { return cards; }, get version() { return version; } };
})(typeof window !== "undefined" ? window : globalThis);
