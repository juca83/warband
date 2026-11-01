// ===================================================================
// Warband Arena - playing with a friend. Two browsers run the same game
// (same seed, same card set) and only exchange actions. Two transports:
//   "peer"  - a direct WebRTC link between the two browsers. PeerJS's free public
//             broker is used only to find each other; the game data never touches a server.
//   "relay" - when the two homes can't link directly (a router says no), the same messages go through a
//             free public MQTT broker over a secure websocket instead. Nothing to set up: both sides try both
//             ways at once and keep the direct link when it opens, the relay otherwise.
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

  // ---- getting through home routers and firewalls
  // Two homes often can't open a direct link (the router or a firewall says no): then the connection goes through a
  // relay (TURN). PeerJS's own relays are often down, so the free Open Relay (Metered) is added on ports 80 and 443,
  // which nearly every network lets through. Its "static auth" uses a shared secret: the time-limited user name and
  // password are computed here (TURN REST: user = expiry:name, password = base64(HMAC-SHA1(secret, user))).
  const RELAY = { host: "staticauth.openrelay.metered.ca", secret: "openrelayprojectsecret" };
  function sha1(bytes) {
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0], l = bytes.length, n = ((l + 8) >> 6) + 1, w = new Uint32Array(n * 16);
    for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[n * 16 - 1] = l * 8;
    const W = new Uint32Array(80), rol = (x, c) => (x << c) | (x >>> (32 - c));
    for (let b = 0; b < n * 16; b += 16) {
      for (let t = 0; t < 80; t++) W[t] = t < 16 ? w[b + t] : rol(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
      let [a, bb, c, d, e] = H;
      for (let t = 0; t < 80; t++) {
        const f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
        const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        const tmp = (rol(a, 5) + f + e + k + W[t]) >>> 0; e = d; d = c; c = rol(bb, 30) >>> 0; bb = a; a = tmp;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0;
    }
    const out = new Uint8Array(20); H.forEach((h, i) => { out[i * 4] = h >>> 24; out[i * 4 + 1] = (h >>> 16) & 255; out[i * 4 + 2] = (h >>> 8) & 255; out[i * 4 + 3] = h & 255; });
    return out;
  }
  function hmacSha1(key, msg) {
    const te = new TextEncoder(); let k = te.encode(key); const m = te.encode(msg);
    if (k.length > 64) k = sha1(k);
    const kp = new Uint8Array(64); kp.set(k);
    const ip = new Uint8Array(64 + m.length), op = new Uint8Array(84);
    for (let i = 0; i < 64; i++) { ip[i] = kp[i] ^ 0x36; op[i] = kp[i] ^ 0x5c; }
    ip.set(m, 64); op.set(sha1(ip), 64);
    return sha1(op);
  }
  const b64 = (u8) => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
  function relayCredentials() {
    const user = Math.floor(Date.now() / 1000) + 24 * 3600 + ":warband";
    return { username: user, credential: b64(hmacSha1(RELAY.secret, user)) };
  }
  function iceServers() {
    const c = relayCredentials(), h = RELAY.host;
    let extra = []; try { extra = JSON.parse(localStorage.getItem("wa_turn") || "[]"); if (!Array.isArray(extra)) extra = [extra]; } catch (e) { extra = []; } // a relay of your own, if ever needed
    return extra.concat([
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
      { urls: [`turn:${h}:80`, `turn:${h}:80?transport=tcp`, `turn:${h}:443`, `turns:${h}:443?transport=tcp`], username: c.username, credential: c.credential },
      { urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"], username: "peerjs", credential: "peerjsp" },
    ]);
  }
  // A relay of our own (free Metered account): relais.js next to index.html sets window.WA_RELAY = { app, key }, or the ICE servers array itself.
  // Its credentials are fetched before each room; they are put first, ahead of the shared relays.
  let relayCache = null;
  async function ownRelay() {
    const R = root.WA_RELAY;
    if (Array.isArray(R)) return R; // the "ICE servers array" copied as it is from the Metered dashboard
    if (!R || !R.app || !R.key) return [];
    if (relayCache && relayCache.until > Date.now()) return relayCache.list;
    try {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null; const tm = ctl && setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(`https://${R.app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(R.key)}`, ctl ? { signal: ctl.signal } : {});
      if (tm) clearTimeout(tm);
      const list = await r.json();
      if (!Array.isArray(list) || !list.length) return [];
      relayCache = { list, until: Date.now() + 30 * 60 * 1000 }; return list;
    } catch (e) { return []; }
  }
  const peerOpts = async () => ({ ...(root.WA_PEER_SERVER || {}), debug: 0, config: { iceServers: (await ownRelay()).concat(iceServers()), sdpSemantics: "unified-plan" } });

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

  // ---- the relay: a tiny MQTT 3.1.1 client over a websocket (connect, subscribe, publish, ping)
  // Public brokers that need no account. Several, in case one is down; the host listens on all that answer.
  const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"];
  const brokers = () => (Array.isArray(root.WA_BROKERS) && root.WA_BROKERS.length ? root.WA_BROKERS : BROKERS);
  const TOPIC = (c) => "warband-arena/v1/" + c;
  const u8 = (str) => new TextEncoder().encode(str);
  const mstr = (str) => { const b = u8(str); const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; };
  function packet(head, ...parts) {
    let len = 0; for (const p of parts) len += p.length;
    const rl = []; let x = len; do { let d = x % 128; x = Math.floor(x / 128); if (x > 0) d |= 128; rl.push(d); } while (x > 0);
    const o = new Uint8Array(1 + rl.length + len); o[0] = head; o.set(rl, 1); let at = 1 + rl.length; for (const p of parts) { o.set(p, at); at += p.length; }
    return o;
  }
  function mqtt(url) {
    return new Promise((res, rej) => {
      let ws; try { ws = new WebSocket(url, ["mqtt"]); } catch (e) { rej(e); return; }
      ws.binaryType = "arraybuffer";
      const M = { subs: {}, closers: [], open: false, ws, url };
      let buf = new Uint8Array(0), ping = null, pid = 1;
      const fail = setTimeout(() => { try { ws.close(); } catch (e) {} rej(new Error("relay timeout")); }, 8000);
      M.sub = (topic, fn) => { M.subs[topic] = fn; const id = pid++; ws.send(packet(0x82, new Uint8Array([id >> 8, id & 255]), mstr(topic), new Uint8Array([0]))); };
      M.unsub = (topic) => { delete M.subs[topic]; const id = pid++; try { ws.send(packet(0xa2, new Uint8Array([id >> 8, id & 255]), mstr(topic))); } catch (e) {} };
      M.pub = (topic, obj) => { if (ws.readyState !== 1) return false; ws.send(packet(0x30, mstr(topic), u8(JSON.stringify(obj)))); return true; };
      M.buffered = () => ws.bufferedAmount || 0;
      M.close = () => { try { ws.send(new Uint8Array([0xe0, 0])); ws.close(); } catch (e) {} };
      ws.onopen = () => {
        const id = "wa" + Math.random().toString(36).slice(2, 12);
        ws.send(packet(0x10, mstr("MQTT"), new Uint8Array([4, 2, 0, 60]), mstr(id)));
      };
      ws.onmessage = (e) => {
        const add = new Uint8Array(e.data), nb = new Uint8Array(buf.length + add.length); nb.set(buf); nb.set(add, buf.length); buf = nb;
        for (;;) {
          if (buf.length < 2) return;
          let len = 0, mul = 1, i = 1, d;
          do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
          if (buf.length < i + len) return;
          const type = buf[0] >> 4, body = buf.subarray(i, i + len); buf = buf.slice(i + len);
          if (type === 2) { clearTimeout(fail); if (body[1] === 0) { M.open = true; ping = setInterval(() => { try { ws.send(new Uint8Array([0xc0, 0])); } catch (e) {} }, 25000); res(M); } else { rej(new Error("relay refused")); ws.close(); } }
          else if (type === 3) {
            const tl = (body[0] << 8) | body[1], topic = new TextDecoder().decode(body.subarray(2, 2 + tl));
            const fn = M.subs[topic]; if (fn) { try { fn(JSON.parse(new TextDecoder().decode(body.subarray(2 + tl)))); } catch (err) {} }
          }
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => { clearTimeout(fail); clearInterval(ping); const was = M.open; M.open = false; if (!was) rej(new Error("relay closed")); else for (const c of M.closers) c(); };
    });
  }
  // a link over one broker: the host listens on TOPIC/h, this guest on TOPIC/g/<gid>
  function relayLink(M, sendTopic, recvTopic, gid) {
    const L = { handlers: [], closers: [], open: true, kind: "relay", M };
    let nextId = 1; const parts = {};
    const raw = (o) => M.pub(sendTopic, gid ? { g: gid, o } : { o });
    L.send = (o) => {
      let text; try { text = JSON.stringify(o); } catch (e) { return false; }
      if (bytes(text) < LIMIT) return raw(o);
      const id = nextId++, list = slices(text, id);
      list.forEach((d, i) => raw({ __s: id, i, n: list.length, d }));
      return true;
    };
    L.buffered = () => M.buffered();
    L.onMessage = (fn) => L.handlers.push(fn);
    L.onClose = (fn) => L.closers.push(fn);
    const shut = () => { if (!L.open) return; L.open = false; for (const c of L.closers) c(); };
    L.close = () => { raw({ t: "__bye" }); setTimeout(() => M.close(), 150); L.open = false; };
    L.recv = (d) => {
      if (!L.open) return;
      if (d && d.t === "__bye") { shut(); M.close(); return; }
      if (d && d.__s != null) {
        const p = parts[d.__s] || (parts[d.__s] = { got: 0, n: d.n, s: [] });
        if (p.s[d.i] == null) { p.s[d.i] = d.d; p.got++; }
        if (p.got === p.n) { delete parts[d.__s]; try { const v = JSON.parse(p.s.join("")); for (const h of L.handlers) h(v); } catch (e) {} }
        return;
      }
      for (const h of L.handlers) h(d);
    };
    M.recv = L.recv;
    M.closers.push(() => { if (root.console) console.warn("Warband net: relay closed"); shut(); });
    return L;
  }
  // host side: listen on every broker that answers; a guest knocks, gets a welcome, then picks this way or the direct one
  async function relayHost(c, offer) {
    const conns = [];
    await Promise.all(brokers().map((url) => mqtt(url).then((M) => {
      conns.push(M);
      const links = {};
      M.sub(TOPIC(c) + "/h", (m) => {
        if (!m || !m.g) return;
        if (m.o && m.o.t === "__knock" && !links[m.g]) {
          const L = relayLink(M, TOPIC(c) + "/g/" + m.g, null, null);
          links[m.g] = L; L.dispose = () => M.close();
          M.pub(TOPIC(c) + "/g/" + m.g, { o: { t: "__welcome" } });
          offer(L); return;
        }
        if (links[m.g]) links[m.g].recv(m.o);
      });
    }).catch(() => null)));
    return { count: conns.length, close: () => conns.forEach((M) => M.close()), conns };
  }
  // guest side: knock on every broker at once; the first welcome wins
  function relayJoin(c, gid, onWelcome) {
    const conns = []; let done = false;
    for (const url of brokers()) mqtt(url).then((M) => {
      if (done) { M.close(); return; }
      conns.push(M);
      M.sub(TOPIC(c) + "/g/" + gid, (m) => {
        if (!m) return;
        if (!M.link && m.o && m.o.t === "__welcome" && !done) {
          done = true; for (const o of conns) if (o !== M) o.close();
          M.link = relayLink(M, TOPIC(c) + "/h", null, gid); M.link.dispose = () => M.close(); onWelcome(M.link); return;
        }
        if (M.link) M.link.recv(m.o);
      });
      setTimeout(() => M.pub(TOPIC(c) + "/h", { g: gid, o: { t: "__knock" } }), 150);
    }).catch(() => null);
    return { stop: () => { done = true; for (const o of conns) if (!o.link) o.close(); } };
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
    // Both ways at once: the direct one (PeerJS) and the relay. The guest says which one it keeps ("__pick").
    let chosen = null, peer = null, relay = null;
    const offer = (link) => {
      link.handlers.unshift(function pick(m) {
        if (!m || m.t !== "__pick" || chosen) return;
        chosen = link;
        if (link.kind === "peer") { if (relay) relay.close(); }
        else { if (peer) { try { peer.destroy(); } catch (e) {} } if (relay) relay.conns.forEach((M) => { if (M !== link.M) M.close(); }); }
        root.WA_NET.lastKind = link.kind; onLink(link);
      });
    };
    const direct = (async () => {
      const Peer = await loadPeer();
      peer = new Peer(peerId(c), await peerOpts());
      await new Promise((res, rej) => { peer.on("open", res); peer.on("error", (e) => rej(new Error(e.type === "unavailable-id" ? "That room code is taken, try again." : "Could not reach the connection broker: " + (e.message || e.type)))); });
      peer.on("connection", (conn) => { conn.on("open", () => { if (chosen) { try { conn.close(); } catch (e) {} return; } const link = wrapPeerConn(conn); link.open = true; link.onClose(() => { if (chosen === link) peer.destroy(); }); offer(link); }); });
    })();
    const relayed = relayHost(c, (link) => { if (chosen) { link.close(); return; } link.onClose(() => {}); offer(link); }).then((r) => { relay = r; if (!r.count) throw new Error("no relay"); });
    const res = await Promise.allSettled([direct, relayed]);
    if (res.every((r) => r.status === "rejected")) { if (peer) try { peer.destroy(); } catch (e) {} throw res[0].reason; }
    return { code: c, cancel: () => { if (peer) try { peer.destroy(); } catch (e) {} if (relay) relay.close(); } };
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
    // Both ways at once. The relay usually answers first; the direct link is kept if it opens soon after.
    const gid = Math.random().toString(36).slice(2, 10);
    return await new Promise((resolve, reject) => {
      let peer = null, conn = null, peerLink = null, relayLink_ = null, settled = false, peerDead = false, relayTimer = null, graceTimer = null;
      const finish = (link) => {
        if (settled) return; settled = true; clearTimeout(relayTimer); clearTimeout(graceTimer); clearTimeout(allTimer);
        if (link.kind === "peer") { rj.stop(); if (relayLink_) relayLink_.close(); } else { rj.stop(); if (peer) try { peer.destroy(); } catch (e) {} }
        root.WA_NET.lastKind = link.kind; link.send({ t: "__pick" }); resolve(link);
      };
      const rj = relayJoin(c, gid, (link) => {
        relayLink_ = link;
        if (peerLink) return finish(peerLink);
        if (peerDead) return finish(link);
        graceTimer = setTimeout(() => finish(peerLink || link), 5000); // give the direct link a moment
      });
      const allTimer = setTimeout(() => {
        if (settled) return; settled = true; rj.stop(); if (peer) try { peer.destroy(); } catch (e) {}
        reject(new Error("Nobody answered that room code. Check it, and that your friend is still waiting."));
      }, 25000);
      const peerFailed = () => { peerDead = true; if (relayLink_ && !settled) finish(relayLink_); };
      (async () => {
        try {
          const Peer = await loadPeer();
          peer = new Peer(await peerOpts());
          await new Promise((res, rej) => { peer.on("open", res); peer.on("error", (e) => rej(e)); });
          conn = peer.connect(peerId(c), { reliable: true, serialization: "json" });
          conn.on("open", () => { if (settled) { try { conn.close(); } catch (e) {} return; } peerLink = wrapPeerConn(conn); peerLink.open = true; peerLink.onClose(() => peer.destroy()); if (relayLink_) finish(peerLink); else relayTimer = setTimeout(() => { if (!settled) finish(peerLink); }, 50); });
          peer.on("error", peerFailed);
          setTimeout(() => { if (!peerLink) peerFailed(); }, 15000);
        } catch (e) { peerFailed(); }
      })();
    });
  }
  root.WA_NET = { host, join, norm, iceServers, ownRelay, _hmacSha1: hmacSha1 };
})(typeof window !== "undefined" ? window : globalThis);
