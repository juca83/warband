// ===================================================================
// Warband Arena - playing with a friend. Two browsers run the same game
// (same seed, same card set) and only exchange actions. Two transports:
//   "peer"  - a direct WebRTC link between the two browsers. PeerJS's free public
//             broker is used only to find each other; the game data never touches a server.
//   "local" - a BroadcastChannel, for two tabs in the same browser (testing, or two people
//             sharing one computer with two windows).
// ===================================================================
(function (root) {
  "use strict";
  const PEERJS = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
  const norm = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const peerId = (c) => "warband-arena-" + c;

  let peerLib = null;
  function loadPeer() {
    if (root.Peer) return Promise.resolve(root.Peer);
    if (peerLib) return peerLib;
    peerLib = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = PEERJS; s.async = true;
      s.onload = () => (root.Peer ? res(root.Peer) : rej(new Error("PeerJS did not load")));
      s.onerror = () => rej(new Error("Could not load the connection library (no internet, or the script is blocked)."));
      document.head.appendChild(s);
    });
    return peerLib;
  }

  // A link: send(obj), onMessage(fn), onClose(fn), close(), buffered() (bytes still waiting to leave)
  // Big messages are cut into slices here and put back together on the other side: PeerJS refuses any
  // single message of 16 KB or more ("message-too-big") and then drops the whole connection.
  const LIMIT = 15000, enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const bytes = (str) => (enc ? enc.encode(str).length : str.length * 3);
  function slices(text, id) {
    const out = []; let at = 0, step = 6000;
    while (at < text.length) {
      let len = Math.min(step, text.length - at), piece;
      for (;;) { piece = text.slice(at, at + len); if (bytes(JSON.stringify({ __s: id, i: 99999, n: 99999, d: piece })) < LIMIT || len < 64) break; len = Math.floor(len / 2); }
      out.push(piece); at += len;
    }
    return out;
  }
  function wrapPeerConn(conn) {
    const L = { handlers: [], closers: [], open: false, kind: "peer", failed: 0 };
    let nextId = 1; const parts = {};
    const raw = (o) => { try { conn.send(o); return true; } catch (e) { L.failed++; if (root.console) console.warn("Warband net: send failed", e); return false; } };
    L.send = (o) => {
      let text; try { text = JSON.stringify(o); } catch (e) { return false; }
      if (bytes(text) < LIMIT) return raw(o);
      const id = nextId++, list = slices(text, id);
      list.forEach((d, i) => raw({ __s: id, i, n: list.length, d }));
      return true;
    };
    L.buffered = () => { try { return ((conn.dataChannel && conn.dataChannel.bufferedAmount) || 0) + ((conn.bufferSize || 0) * LIMIT); } catch (e) { return 0; } };
    L.onMessage = (fn) => L.handlers.push(fn);
    L.onClose = (fn) => L.closers.push(fn);
    L.close = () => { try { conn.close(); } catch (e) {} };
    const deliver = (d) => { for (const h of L.handlers) h(d); };
    conn.on("data", (d) => {
      if (d && d.__s != null) {
        const p = parts[d.__s] || (parts[d.__s] = { got: 0, n: d.n, s: [] });
        if (p.s[d.i] == null) { p.s[d.i] = d.d; p.got++; }
        if (p.got === p.n) { delete parts[d.__s]; try { deliver(JSON.parse(p.s.join(""))); } catch (e) {} }
        return;
      }
      deliver(d);
    });
    conn.on("close", () => { if (root.console) console.warn("Warband net: connection closed"); L.open = false; for (const c of L.closers) c(); });
    conn.on("error", (e) => { if (root.console) console.warn("Warband net: connection error", e && (e.type || e.message || e)); L.open = false; for (const c of L.closers) c(); });
    return L;
  }
  function localLink(room, me) {
    const ch = new BroadcastChannel("warband-arena-" + room);
    const L = { handlers: [], closers: [], open: true, kind: "local", buffered: () => 0 };
    L.send = (o) => { ch.postMessage({ from: me, o }); return true; };
    L.onMessage = (fn) => L.handlers.push(fn);
    L.onClose = (fn) => L.closers.push(fn);
    L.close = () => { ch.postMessage({ from: me, bye: true }); ch.close(); L.open = false; };
    ch.onmessage = (e) => { const d = e.data; if (!d || d.from === me) return; if (d.bye) { L.open = false; for (const c of L.closers) c(); return; } for (const h of L.handlers) h(d.o); };
    return L;
  }

  // host(transport, onLink) -> { code, cancel() }. onLink(link) fires when the friend arrives.
  async function host(transport, onLink) {
    const c = code();
    if (transport === "local") {
      const link = localLink(c, "host");
      // the guest announces itself; answer so it knows the host is here
      link.onMessage((m) => { if (m && m.t === "knock") { link.send({ t: "welcome" }); onLink(link); } });
      return { code: c, cancel: () => link.close() };
    }
    const Peer = await loadPeer();
    const peer = new Peer(peerId(c), { debug: 0 });
    await new Promise((res, rej) => { peer.on("open", res); peer.on("error", (e) => rej(new Error(e.type === "unavailable-id" ? "That room code is taken, try again." : "Could not reach the connection broker: " + (e.message || e.type)))); });
    peer.on("connection", (conn) => { conn.on("open", () => { const link = wrapPeerConn(conn); link.open = true; link.onClose(() => peer.destroy()); onLink(link); }); });
    return { code: c, cancel: () => peer.destroy() };
  }
  // join(transport, code) -> link
  async function join(transport, rawCode) {
    const c = norm(rawCode);
    if (c.length < 5) throw new Error("Enter the 5-character room code.");
    if (transport === "local") {
      const link = localLink(c, "guest");
      await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("No host answered in this browser. Is the host tab open?")), 4000); const h = (m) => { if (m && m.t === "welcome") { clearTimeout(t); res(); } }; link.onMessage(h); link.send({ t: "knock" }); });
      return link;
    }
    const Peer = await loadPeer();
    const peer = new Peer({ debug: 0 });
    await new Promise((res, rej) => { peer.on("open", res); peer.on("error", (e) => rej(new Error("Could not reach the connection broker: " + (e.message || e.type)))); });
    const conn = peer.connect(peerId(c), { reliable: true, serialization: "json" });
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("Nobody answered that room code. Check it, and that your friend is still waiting.")), 12000);
      conn.on("open", () => { clearTimeout(t); res(); });
      peer.on("error", (e) => { clearTimeout(t); rej(new Error(e.type === "peer-unavailable" ? "No room with that code." : "Connection failed: " + (e.message || e.type))); });
    });
    const link = wrapPeerConn(conn); link.open = true; link.onClose(() => peer.destroy());
    return link;
  }
  root.WA_NET = { host, join, norm };
})(typeof window !== "undefined" ? window : globalThis);
