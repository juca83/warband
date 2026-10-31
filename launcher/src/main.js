// Warband Launcher - keeps Warband Arena up to date from the GitHub releases of the person who publishes it, and starts it.
// A release = a tag (v74…), a description (shown as the news), the game's zip and, optionally, ma-meta.js (the publisher's
// meta: the game installs it by itself). Everything is kept in the launcher's own data folder; the game runs in its own window,
// so it keeps its saves whatever the browser of the computer.
"use strict";
const { app, BrowserWindow, ipcMain, shell, net, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

// ---------------------------------------------------------------- settings
// launcher-config.json sits next to the launcher (the publisher fills "repo" before sending it); a copy saved from the
// launcher's own settings lives in its data folder and wins.
const EXE_DIR = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const DATA = () => app.getPath("userData");
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); };
function config() {
  const shipped = readJSON(path.join(EXE_DIR, "launcher-config.json"), {});
  const own = readJSON(path.join(DATA(), "launcher-config.json"), {});
  const c = Object.assign({ repo: "", apiBase: "https://api.github.com", title: "Warband Arena" }, shipped, own);
  if (process.env.WA_LAUNCHER_API) c.apiBase = process.env.WA_LAUNCHER_API; // tests
  c.repo = String(c.repo || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "").replace(/\.git$/, "");
  return c;
}
const STATE = () => path.join(DATA(), "state.json");
const state = () => readJSON(STATE(), { installed: "", index: "", notes: "", name: "", publishedAt: "" });
const VERSIONS = () => path.join(DATA(), "versions");

// ---------------------------------------------------------------- GitHub
async function getJSON(url) {
  const r = await net.fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "WarbandLauncher" } });
  if (r.status === 404) throw Object.assign(new Error("not found"), { code: "notfound" });
  if (r.status === 403 || r.status === 429) throw Object.assign(new Error("rate limited"), { code: "limit" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function latestRelease() {
  const c = config();
  if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) throw Object.assign(new Error("no source"), { code: "nosource" });
  const rel = await getJSON(`${c.apiBase}/repos/${c.repo}/releases/latest`);
  const assets = rel.assets || [];
  const zip = assets.find((a) => /\.zip$/i.test(a.name));
  const meta = assets.find((a) => /^ma-meta\.js$/i.test(a.name)) || assets.find((a) => /\.js$/i.test(a.name));
  return { tag: rel.tag_name, name: rel.name || rel.tag_name, notes: rel.body || "", publishedAt: rel.published_at || "", zip: zip && { url: zip.browser_download_url, size: zip.size, name: zip.name }, meta: meta && { url: meta.browser_download_url, size: meta.size } };
}
// a download with progress (GitHub sends assets through a redirect: net.fetch follows it)
async function download(url, dest, onProgress) {
  const r = await net.fetch(url, { headers: { "User-Agent": "WarbandLauncher", Accept: "application/octet-stream" } });
  if (!r.ok || !r.body) throw new Error("download HTTP " + r.status);
  const total = +r.headers.get("content-length") || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(dest), reader = r.body.getReader(); let got = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    got += value.length; if (!out.write(Buffer.from(value))) await new Promise((res) => out.once("drain", res));
    onProgress(got, total);
  }
  await new Promise((res, rej) => { out.end(res); out.on("error", rej); });
  return got;
}
// where index.html is inside an extracted release (the zip usually holds one folder)
function findIndex(dir, depth = 0) {
  if (fs.existsSync(path.join(dir, "index.html"))) return path.join(dir, "index.html");
  if (depth > 3) return "";
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) { const f = findIndex(path.join(dir, e.name), depth + 1); if (f) return f; }
  return "";
}
const safeTag = (t) => String(t || "latest").replace(/[^\w.-]/g, "_");

// ---------------------------------------------------------------- windows
let win = null, game = null;
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }
function createLauncher() {
  win = new BrowserWindow({ width: 1060, height: 640, minWidth: 860, minHeight: 540, backgroundColor: "#0b0c1d", icon: path.join(__dirname, "icon.png"), title: config().title + " · Launcher", autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, "launcher.html"));
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; if (!game) app.quit(); });
}
function openGame() {
  const st = state();
  if (!st.index || !fs.existsSync(st.index)) return { error: "notinstalled" };
  if (game && !game.isDestroyed()) { game.focus(); return { ok: true }; }
  game = new BrowserWindow({ width: 1500, height: 900, minWidth: 960, minHeight: 600, backgroundColor: "#0b0c1d", icon: path.join(__dirname, "icon.png"), title: config().title + " " + st.installed, autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } });
  game.loadFile(st.index);
  game.once("ready-to-show", () => { game.maximize(); game.show(); });
  // links go to the real browser; F11 toggles full screen
  game.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: "deny" }; });
  game.webContents.on("before-input-event", (e, input) => { if (input.type === "keyDown" && input.key === "F11") { game.setFullScreen(!game.isFullScreen()); e.preventDefault(); } });
  game.on("closed", () => { game = null; if (win && !win.isDestroyed()) { win.show(); win.focus(); } else app.quit(); });
  if (win && !win.isDestroyed()) win.hide();
  return { ok: true };
}

// ---------------------------------------------------------------- what the launcher window asks
ipcMain.handle("state", () => { const c = config(), st = state(); return { repo: c.repo, title: c.title, installed: st.installed, name: st.name, notes: st.notes, publishedAt: st.publishedAt, hasGame: !!(st.index && fs.existsSync(st.index)), launcherVersion: app.getVersion() }; });
ipcMain.handle("check", async () => {
  try { const r = await latestRelease(); const st = state(); return { ok: true, latest: r, upToDate: !!st.installed && st.installed === r.tag && fs.existsSync(st.index || "") }; }
  catch (e) { return { ok: false, code: e.code || "network", message: String(e.message || e) }; }
});
let busy = false;
ipcMain.handle("update", async () => {
  if (busy) return { ok: false, code: "busy" };
  busy = true;
  try {
    const r = await latestRelease();
    if (!r.zip) return { ok: false, code: "nozip" };
    const tmp = path.join(DATA(), "download", safeTag(r.tag) + ".zip");
    send("progress", { step: "download", got: 0, total: r.zip.size || 0 });
    await download(r.zip.url, tmp, (got, total) => send("progress", { step: "download", got, total: total || r.zip.size || 0 }));
    send("progress", { step: "extract" });
    const dir = path.join(VERSIONS(), safeTag(r.tag));
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    new AdmZip(tmp).extractAllTo(dir, true);
    const index = findIndex(dir);
    if (!index) throw Object.assign(new Error("index.html not found in the zip"), { code: "badzip" });
    // the publisher's meta: next to index.html, the game installs it by itself
    if (r.meta) { send("progress", { step: "meta" }); await download(r.meta.url, path.join(path.dirname(index), "ma-meta.js"), () => {}); }
    writeJSON(STATE(), { installed: r.tag, index, notes: r.notes, name: r.name, publishedAt: r.publishedAt });
    // keep the new version only (and the download cache clean)
    for (const e of fs.readdirSync(VERSIONS())) if (e !== safeTag(r.tag)) fs.rmSync(path.join(VERSIONS(), e), { recursive: true, force: true });
    fs.rmSync(path.join(DATA(), "download"), { recursive: true, force: true });
    send("progress", { step: "done" });
    return { ok: true, installed: r.tag };
  } catch (e) { return { ok: false, code: e.code || "network", message: String(e.message || e) }; }
  finally { busy = false; }
});
ipcMain.handle("play", () => openGame());
ipcMain.handle("setRepo", (e, repo) => { const own = readJSON(path.join(DATA(), "launcher-config.json"), {}); own.repo = String(repo || "").trim(); writeJSON(path.join(DATA(), "launcher-config.json"), own); return config().repo; });
ipcMain.handle("openFolder", () => shell.openPath(DATA()));
ipcMain.handle("openPage", () => { const c = config(); if (c.repo) shell.openExternal(`https://github.com/${c.repo}/releases`); });

app.whenReady().then(() => { Menu.setApplicationMenu(null); createLauncher(); });
app.on("window-all-closed", () => app.quit());
// a second launch brings the open launcher forward
if (!app.requestSingleInstanceLock()) app.quit();
else app.on("second-instance", () => { const w = game && !game.isDestroyed() ? game : win; if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
