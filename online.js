"use strict";
/* ============================================================
   الأونلاين بالإنترنت — مين المحتال؟
   - زوج سيرفرات MQTT عامة في نفس الوقت: إذا واحد طاح، الآخر يكمّل
   - كل شي مشفّر (AES-GCM): اللي يتسمّع على السيرفر ما يفهم والو
   - الغرفة: نفس منطق الواي فاي (القائد يقرر كلش)، غير الطريق يتبدل
   - الأصحاب: كود لكل واحد، طلبات صداقة، وطلبات دخول للغرفة
   ============================================================ */
const RELAY_URLS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
const NSP = "mhtl1";
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ONLINE_OK = !!(window.mqtt && window.crypto && crypto.subtle && window.isSecureContext !== false);

function randCode(n){ let s = ""; for(const x of crypto.getRandomValues(new Uint8Array(n))) s += CODE_ABC[x % 32]; return s; }
const cleanCode = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isRoomCode = s => /^[A-Z2-9]{8}$/.test(cleanCode(s)) && /[A-Z]/.test(cleanCode(s));
const fmtCode = c => c && c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : c;

// ---------- تشفير ----------
const _te = new TextEncoder(), _td = new TextDecoder();
function toB64(u8){ let s = ""; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(s){ try{ const b = atob(String(s)); const u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }catch(e){ return null; } }
async function sha(str){ return new Uint8Array(await crypto.subtle.digest("SHA-256", _te.encode(str))); }
const hexOf = u8 => Array.from(u8, b => b.toString(16).padStart(2, "0")).join("");
const aesKey = raw => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
async function seal(key, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, _te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return toB64(out);
}
async function unseal(key, b64){
  const u = fromB64(b64); if(!u || u.length < 29) return null;
  try{ return JSON.parse(_td.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.subarray(0, 12) }, key, u.subarray(12)))); }
  catch(e){ return null; }
}
// رمز الغرفة هو المفتاح: اسم الطريق (topic) والمفتاح يتحسبو منو، والسيرفر ما يشوف حتى واحد فيهم
async function roomCrypto(code){
  code = cleanCode(code);
  return { code, id: hexOf(await sha("mhtl-room:" + code)).slice(0, 24), key: await aesKey(await sha("mhtl-key:" + code)) };
}

// ---------- الاتصال بالسيرفرات ----------
class Relay {
  constructor(){ this.clients = []; this.subs = new Map(); this.seen = new Map(); this.listeners = new Set(); this.lastUp = false; }
  start(will){
    if(this.clients.length) return;
    RELAY_URLS.forEach(url => {
      const c = mqtt.connect(url, {
        clientId: "mh" + randCode(12), keepalive: 20, reconnectPeriod: 1500, connectTimeout: 9000, clean: true,
        resubscribe: false, queueQoSZero: false,
        will: will ? { topic: will.topic, payload: will.payload, qos: 1, retain: true } : undefined
      });
      c.on("connect", () => { const t = [...this.subs.keys()]; if(t.length) c.subscribe(t, { qos: 1 }); this.emit(); this.onConnect && this.onConnect(); });
      ["close", "offline", "end"].forEach(ev => c.on(ev, () => this.emit()));
      c.on("error", () => {});
      c.on("message", (topic, payload) => this.route(topic, payload));
      this.clients.push(c);
    });
    // رجعت للتطبيق (من واتساب، الشاشة طفات…): نعاودو نتصلو فوراً
    const kick = () => { if(document.hidden) return; this.clients.forEach(c => { if(!c.connected && !c.disconnecting && !c.reconnecting){ try{ c.reconnect(); }catch(e){} } }); };
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("online", kick);
    setInterval(() => this.emit(), 2000);
  }
  get up(){ return this.clients.some(c => c.connected); }
  onStatus(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(){ const up = this.up; if(up !== this.lastUp){ this.lastUp = up; this.listeners.forEach(f => { try{ f(up); }catch(e){} }); } }
  sub(topic, fn){ this.subs.set(topic, fn); this.clients.forEach(c => { if(c.connected) c.subscribe(topic, { qos: 1 }); }); }
  unsub(topic){ if(!this.subs.delete(topic)) return; this.clients.forEach(c => { if(c.connected) c.unsubscribe(topic); }); }
  pub(topic, payload, retain){ this.clients.forEach(c => { try{ c.publish(topic, payload, { qos: 1, retain: !!retain }); }catch(e){} }); }
  route(topic, p){
    const str = p ? p.toString() : "";
    // نفس الرسالة تجي من الزوج سيرفرات: ناخذو الأولى برك
    if(str){
      const k = topic + "|" + str.length + "|" + str.slice(-40), now = Date.now();   // آخر الرسالة = بصمة التشفير (ما تتعاودش)
      if(now - (this.seen.get(k) || 0) < 90000) return;
      this.seen.set(k, now);
      if(this.seen.size > 4000) for(const [kk, t] of this.seen) if(now - t > 90000) this.seen.delete(kk);
    }
    let fn = this.subs.get(topic);
    if(!fn) for(const [pat, f] of this.subs) if(pat.endsWith("/#") && topic.startsWith(pat.slice(0, -1))){ fn = f; break; }
    if(fn) fn(topic, str);
  }
}
const relay = new Relay();

// ============================================================
//   الغرفة أونلاين: نفس واجهة Link تاع الواي فاي
// ============================================================
// القائد: يستقبل رسائل اللاعبين ويحس شكون دخل وشكون خرج (بالنبضات)
class OnlineHostLink {
  constructor(rc, onMsg, onStatus){
    this.rc = rc; this.onMsg = onMsg; this.onStatus = onStatus; this.closed = false;
    this.key = "on:" + rc.id; this.base = `${NSP}/r/${rc.id}`;
    this.last = new Map(); this.gone = new Set(); this.kicked = new Map(); this.q = Promise.resolve();
    relay.sub(this.base + "/h", (t, p) => this.rx(p));
    this.offStatus = relay.onStatus(up => { if(!this.closed) this.onStatus(up ? "up" : "down", this); });
    this.timer = setInterval(() => this.tick(), 3000);
    this.n = 0;
    // رجع للتطبيق: نبضة فوراً باش اللاعبين يعرفو بلي راه هنا
    this.onVis = () => { if(!document.hidden && !this.closed){ this.tick(); this.post(this.base + "/a", { t: "hhb" }); } };
    document.addEventListener("visibilitychange", this.onVis);
    setTimeout(() => { if(!this.closed) this.onStatus(relay.up ? "up" : "down", this); }, 0);
  }
  isOpen(){ return relay.up; }
  async rx(p){
    const m = await unseal(this.rc.key, p);
    if(!m || !m.id || this.closed) return;
    if(this.kicked.has(m.id) && Date.now() - this.kicked.get(m.id) < 60000) return;
    const known = this.last.has(m.id) && !this.gone.has(m.id);
    this.last.set(m.id, Date.now());
    if(!known || m.t === "hello"){ this.gone.delete(m.id); this.onMsg({ t: "join", id: m.id, name: m.name }); }
    if(m.t === "msg") this.onMsg({ t: "msg", from: m.id, d: m.d });
  }
  tick(){
    const now = Date.now();
    // التطبيق تاع القائد كان واقف (خلفية): نعطيو للاعبين مهلة باش ما يبانوش "خرجو" الكل مرة وحدة
    if(this.lastTick && now - this.lastTick > 9000) for(const id of this.last.keys()) this.last.set(id, now);
    this.lastTick = now;
    for(const [id, t] of this.last) if(!this.gone.has(id) && now - t > 16000){ this.gone.add(id); this.onMsg({ t: "leave", id }); }
    if(++this.n % 2 === 0) this.post(this.base + "/a", { t: "hhb" });     // نبضة القائد: "راني هنا"
  }
  post(topic, obj){ this.q = this.q.then(async () => relay.pub(topic, await seal(this.rc.key, obj))).catch(() => {}); }
  send(obj){
    if(this.closed) return;
    if(obj.t === "kick"){ this.kicked.set(obj.id, Date.now()); this.gone.add(obj.id); this.post(`${this.base}/p/${obj.id}`, { t: "kicked" }); return; }
    if(obj.to) this.post(`${this.base}/p/${obj.to}`, { t: "msg", d: obj.d });
  }
  close(){
    if(this.closed) return;
    this.post(this.base + "/a", { t: "hostgone" });
    this.closed = true; clearInterval(this.timer); this.offStatus();
    document.removeEventListener("visibilitychange", this.onVis);
    setTimeout(() => relay.unsub(this.base + "/h"), 500);
  }
}

// اللاعب: يبعث نبضة كل 4 ثواني، ويعرف إذا القائد غاب
class OnlinePlayerLink {
  constructor(rc, onMsg, onStatus, opts = {}){
    this.rc = rc; this.onMsg = onMsg; this.onStatus = onStatus; this.closed = false;
    // firstMs: قداش نستناو القائد أول مرة • downMs: قداش نحاولو نرجعو إذا غاب
    this.firstMs = opts.firstMs || 20000; this.downMs = opts.downMs || 600000;
    this.key = "on:" + rc.id; this.base = `${NSP}/r/${rc.id}`;
    this.created = Date.now(); this.lastHost = 0; this.wasUp = null; this.downSince = 0; this.q = Promise.resolve();
    relay.sub(`${this.base}/p/${myId}`, (t, p) => this.rx(p));
    relay.sub(`${this.base}/a`, (t, p) => this.rx(p));
    this.offStatus = relay.onStatus(() => this.check());
    this.hb = setInterval(() => { this.post({ t: "hb" }); this.check(); }, 4000);
    // رجع للتطبيق: نقولو للقائد "راني هنا" فوراً
    this.onVis = () => { if(!document.hidden && !this.closed){ this.post({ t: "hb" }); this.check(); } };
    document.addEventListener("visibilitychange", this.onVis);
    this.post({ t: "hello" });
    this.check();
  }
  isOpen(){ return relay.up && Date.now() - this.lastHost < 20000; }
  async rx(p){
    const m = await unseal(this.rc.key, p);
    if(!m || this.closed) return;
    this.lastHost = Date.now();
    if(m.t === "msg") this.onMsg({ t: "msg", d: m.d });
    else if(m.t === "kicked") this.onMsg({ t: "kicked" });
    else if(m.t === "hostgone") this.onMsg({ t: "hostgone" });
    this.check();
  }
  check(){
    if(this.closed) return;
    const up = this.isOpen(), now = Date.now();
    if(up !== this.wasUp){
      this.wasUp = up;
      if(up) this.downSince = 0; else if(!this.downSince) this.downSince = now;
      this.onStatus(up ? "up" : "down", this);
    }
    // أول دخول: إذا القائد ما جاوبش (20 ثانية، ولا 5 دقايق إذا راهو يرجع لغرفة كان فيها)، الرمز غالط ولا الغرفة مسكّرة
    // ما نحسبوش الوقت اللي الإنترنت تاعنا طايح فيه
    if(!relay.up && !this.lastHost && this.lastCheck) this.created += now - this.lastCheck;
    this.lastCheck = now;
    if(!this.lastHost && now - this.created > this.firstMs){ this.close(); this.onStatus("dead", this); return; }
    if(this.downSince && this.lastHost && now - this.downSince > this.downMs){ this.close(); this.onStatus("dead", this); }
  }
  post(obj){
    if(this.closed) return;
    obj.id = myId; obj.name = dispName();
    this.q = this.q.then(async () => relay.pub(this.base + "/h", await seal(this.rc.key, obj))).catch(() => {});
  }
  send(obj){ if(obj && obj.d) this.post({ t: "msg", d: obj.d }); }
  close(){
    if(this.closed) return;
    this.closed = true; clearInterval(this.hb); this.offStatus();
    document.removeEventListener("visibilitychange", this.onVis);
    relay.unsub(`${this.base}/p/${myId}`); relay.unsub(`${this.base}/a`);
  }
}

// ============================================================
//   الهوية والأصحاب
// ============================================================
const OK = k => (typeof TEST_AS === "string" && TEST_AS ? "t_" + TEST_AS + "_" : "") + k;   // للتجربة: كل نافذة هاتف
const ON = {
  ready: false, code: "", priv: null, pub: null, presKeyB64: "", presKey: null,
  friends: [], fin: {}, fout: {}, jin: {}, jout: null, pres: {}, pairs: new Map(), keyWait: new Map(), hosting: null
};
function myFriendCode(){ return ON.code || store.get(OK("fcode"), ""); }
function saveFriends(){ store.set(OK("friends"), ON.friends); store.set(OK("fin"), ON.fin); store.set(OK("fout"), ON.fout); }
const friendOf = code => ON.friends.find(f => f.code === code);

let onlineStarting = null;
function onlineInit(){
  if(!ONLINE_OK) return Promise.resolve(false);
  return onlineStarting || (onlineStarting = (async () => {
    ON.code = store.get(OK("fcode"), "") || randCode(8); store.set(OK("fcode"), ON.code);
    let id = store.get(OK("idkey"), null);
    try{
      if(!id){
        const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
        id = { priv: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: await crypto.subtle.exportKey("jwk", kp.publicKey) };
        store.set(OK("idkey"), id);
      }
      ON.priv = await crypto.subtle.importKey("jwk", id.priv, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
      ON.pub = { x: id.pub.x, y: id.pub.y };
      ON.presKeyB64 = store.get(OK("preskey"), "") || toB64(crypto.getRandomValues(new Uint8Array(16)));
      store.set(OK("preskey"), ON.presKeyB64);
      ON.presKey = await aesKey(fromB64(ON.presKeyB64));
    }catch(e){ return false; }
    ON.friends = store.get(OK("friends"), []); ON.fin = store.get(OK("fin"), {}); ON.fout = store.get(OK("fout"), {});
    // كي ينقطع الاتصال، السيرفر يعلن عليّ "غير متصل"
    const will = { topic: `${NSP}/p/${ON.code}`, payload: await seal(ON.presKey, { n: dispName(), on: false, t: Date.now() }) };
    relay.onConnect = () => { publishKey(); publishPresence(); };
    relay.start(will);
    relay.sub(`${NSP}/i/${ON.code}/#`, (t, p) => onInbox(t, p));
    ON.friends.forEach(f => watchFriend(f));
    relay.onStatus(() => { renderOnlineBits(); });
    setInterval(() => { if(relay.up) publishPresence(); }, 60000);
    setInterval(() => renderOnlineBits(), 15000);
    ON.ready = true;
    renderOnlineBits();
    return true;
  })());
}
function publishKey(){ relay.pub(`${NSP}/k/${ON.code}`, JSON.stringify(ON.pub), true); }
let presT = null;
function publishPresence(){
  clearTimeout(presT);
  presT = setTimeout(async () => {
    if(!ON.presKey) return;
    relay.pub(`${NSP}/p/${ON.code}`, await seal(ON.presKey, { n: dispName(), on: true, t: Date.now(), room: ON.hosting }), true);
  }, 300);
}
function onlineProfileChanged(){ if(ON.ready) publishPresence(); }
// القائد يعلن لصحابو على غرفتو (عدد اللاعبين…)
function setHosting(info){
  const before = JSON.stringify(ON.hosting); ON.hosting = info || null;
  if(JSON.stringify(ON.hosting) !== before) publishPresence();
}

// مفتاح مشترك بيني وبين لاعب آخر (ECDH)
async function pairKey(pub){
  const k = pub.x + "." + pub.y;
  if(ON.pairs.has(k)) return ON.pairs.get(k);
  const theirs = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: pub.x, y: pub.y, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const key = await crypto.subtle.deriveKey({ name: "ECDH", public: theirs }, ON.priv, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  ON.pairs.set(k, key); return key;
}
// المفتاح العام تاع واحد بالكود تاعو (محفوظ في السيرفر)
function fetchPub(code){
  const f = friendOf(code); if(f && f.pub) return Promise.resolve(f.pub);
  return new Promise(res => {
    const topic = `${NSP}/k/${code}`;
    const done = v => { clearTimeout(t); relay.unsub(topic); res(v); };
    const t = setTimeout(() => done(null), 7000);
    relay.sub(topic, (tp, p) => { try{ const o = JSON.parse(p); if(o && o.x && o.y) done({ x: o.x, y: o.y }); }catch(e){} });
  });
}
// رسالة خاصة لواحد: تبقى محفوظة في السيرفر حتى يقراها (طلب واحد لكل نوع)
async function sendTo(code, slot, obj, pubHint){
  const pub = pubHint || await fetchPub(code); if(!pub) return false;
  const c = await seal(await pairKey(pub), { ...obj, f: ON.code, at: Date.now() });
  relay.pub(`${NSP}/i/${code}/${ON.code}/${slot}`, JSON.stringify({ x: ON.pub.x, y: ON.pub.y, c }), true);
  return true;
}
function clearInbox(from, slot){ relay.pub(`${NSP}/i/${ON.code}/${from}/${slot}`, "", true); }

async function onInbox(topic, p){
  if(!p) return;
  const parts = topic.split("/"), from = parts[3], slot = parts[4];
  let env; try{ env = JSON.parse(p); }catch(e){ return; }
  if(!env || !env.x || !env.c || from === ON.code) return;
  const pub = { x: env.x, y: env.y };
  const m = await unseal(await pairKey(pub).catch(() => null), env.c).catch(() => null);
  if(!m || m.f !== from) return;
  const f = friendOf(from);
  if(slot === "f"){
    if(m.type === "fr"){
      if(f || ON.fout[from]){ await acceptFriendData(from, m.n, pub, m.pk); await sendTo(from, "f", { type: "fa", n: dispName(), pk: ON.presKeyB64 }, pub); clearInbox(from, "f"); return; }
      if(!ON.fin[from]){ toast("👥 " + (m.n || "واحد") + " بعثلك طلب صداقة"); vibe([20, 40, 20]); }
      ON.fin[from] = { n: String(m.n || "؟").slice(0, 20), pub, pk: m.pk, t: m.at || Date.now() };
      saveFriends();
    } else if(m.type === "fa"){
      const isNew = !f;
      await acceptFriendData(from, m.n, pub, m.pk);
      clearInbox(from, "f");
      if(isNew){ toast("✅ " + (m.n || "صاحبك") + " قبل الصداقة"); vibe(20); }
    } else if(m.type === "fd"){
      if(ON.fout[from]){ ON.fout[from].st = "declined"; saveFriends(); toast("❌ " + (ON.fout[from].n || from) + " ما قبلش الطلب"); }
      clearInbox(from, "f");
    } else if(m.type === "fx"){
      ON.friends = ON.friends.filter(x => x.code !== from); delete ON.pres[from];
      relay.unsub(`${NSP}/p/${from}`); saveFriends(); clearInbox(from, "f");
    }
  } else if(slot === "j"){
    if(m.type === "jr"){
      // طلب دخول لغرفتي: لازم يكون للغرفة اللي راني فاتحها دروك
      const myRoom = isHost && room && room.mode === "online" && ON.hosting && ON.hosting.id;
      if(!myRoom || m.room !== myRoom){ await sendTo(from, "j", { type: "jd", room: m.room, why: "closed" }, pub); clearInbox(from, "j"); return; }
      if(!ON.jin[from]){ toast("📨 " + (m.n || "واحد") + " يحب يدخل لغرفتك"); vibe([30, 40, 30]); }
      ON.jin[from] = { n: String(m.n || "؟").slice(0, 20), pub, t: m.at || Date.now() };
    } else if(m.type === "ja"){
      clearInbox(from, "j");
      const jo = ON.jout; ON.jout = null;
      if(!m.code || (jo && jo.host !== from)) return;
      toast("✅ " + (m.nm || "القائد") + " قبلك! ندخلو…"); vibe([20, 40, 20]);
      const act = store.get(SK("activeRoom"), null);
      if(net && !(act && act.code === m.code)){
        if(!await ask("القائد قبلك. تخرج من الغرفة اللي راك فيها وتدخل لغرفتو؟")) return;
        await leaveRoom(true);
      }
      joinOnline(m.code);
    } else if(m.type === "jd"){
      clearInbox(from, "j");
      if(ON.jout && ON.jout.host === from){ ON.jout.st = "declined"; toast(m.why === "closed" ? "الغرفة تسكّرت ولا تبدلت 🤷" : "❌ القائد ما قبلكش هذي المرة"); }
    }
  }
  renderOnlineBits();
}
async function acceptFriendData(code, n, pub, pk){
  let f = friendOf(code);
  if(!f){ f = { code, n: String(n || "؟").slice(0, 20), pub, pk, added: Date.now() }; ON.friends.push(f); }
  else { if(n) f.n = String(n).slice(0, 20); if(pub) f.pub = pub; if(pk) f.pk = pk; }
  delete ON.fin[code]; delete ON.fout[code];
  saveFriends(); watchFriend(f);
}
// حالة صاحبي (متصل؟ فاتح غرفة؟) — مشفّرة بمفتاح ما عندو غير صحابو
function watchFriend(f){
  if(!f.pk) return;
  aesKey(fromB64(f.pk)).then(k => {
    relay.sub(`${NSP}/p/${f.code}`, async (t, p) => {
      if(!p){ delete ON.pres[f.code]; return renderOnlineBits(); }
      const o = await unseal(k, p); if(!o) return;
      ON.pres[f.code] = o;
      if(o.n && o.n !== f.n){ f.n = String(o.n).slice(0, 20); saveFriends(); }
      // الغرفة تبدلت: الطلب القديم ما بقاش
      if(ON.jout && ON.jout.host === f.code && (!o.room || o.room.id !== ON.jout.room)) ON.jout = null;
      renderOnlineBits();
    });
  }).catch(() => {});
}
const presOf = code => { const o = ON.pres[code]; return o && o.on && Date.now() - (o.t || 0) < 150000 ? o : null; };

// ---------- أفعال ----------
async function addFriend(raw){
  const code = cleanCode(raw);
  if(code.length !== 8){ toast("الكود فيه 8 حروف ✍️"); return false; }
  if(code === ON.code){ toast("هذا الكود تاعك 😅"); return false; }
  if(friendOf(code)){ toast("راه صاحبك من قبل ✔"); return false; }
  if(ON.fin[code]){ await answerFriend(code, true); return true; }
  if(ON.fout[code] && ON.fout[code].st === "pending"){ toast("⏳ الطلب راح من قبل — استنا يقبلك"); return false; }
  if(!relay.up){ toast("⏳ ما راكش متصل بالإنترنت"); return false; }
  toast("⏳ نقلبو على صاحبك…");
  const ok = await sendTo(code, "f", { type: "fr", n: dispName(), pk: ON.presKeyB64 });
  if(!ok){ toast("ما لقيناش هذا الكود 🤔 (لازم صاحبك يفتح اللعبة مرة وحدة على الأقل)"); return false; }
  ON.fout[code] = { t: Date.now(), st: "pending" }; saveFriends();
  toast("📨 الطلب راح! كي يقبلك يبان في صحابك"); vibe(20);
  renderOnlineBits(); return true;
}
async function answerFriend(code, yes){
  const r = ON.fin[code]; if(!r) return;
  if(yes){
    await acceptFriendData(code, r.n, r.pub, r.pk);
    await sendTo(code, "f", { type: "fa", n: dispName(), pk: ON.presKeyB64 }, r.pub);
    toast("✅ " + r.n + " ولّا صاحبك");
  } else {
    delete ON.fin[code]; saveFriends();
    await sendTo(code, "f", { type: "fd" }, r.pub);
  }
  clearInbox(code, "f"); vibe(15); renderOnlineBits();
}
async function removeFriend(code){
  const f = friendOf(code); if(!f) return;
  if(!await ask(`تنحّي ${f.n} من صحابك؟`)) return;
  ON.friends = ON.friends.filter(x => x.code !== code); delete ON.pres[code];
  relay.unsub(`${NSP}/p/${code}`); saveFriends();
  sendTo(code, "f", { type: "fx" }, f.pub);
  renderOnlineBits();
}
// طلب دخول لغرفة صاحبي: طلب واحد برك. إذا رفض (ولا ما جاوبش دقيقة) تقدر تعاود
const joinReqWaiting = () => ON.jout && ON.jout.st === "pending" && Date.now() - ON.jout.t < 60000;
async function requestJoin(code){
  const f = friendOf(code), pr = presOf(code);
  if(!f || !pr || !pr.room){ toast("صاحبك ما فاتحش غرفة دروك"); return; }
  if(joinReqWaiting() && ON.jout.host === code){ toast("⏳ الطلب راح — استنا القائد يقبلك"); return; }
  ON.jout = { host: code, room: pr.room.id, t: Date.now(), st: "pending" };
  renderOnlineBits();
  const ok = await sendTo(code, "j", { type: "jr", room: pr.room.id, n: dispName() }, f.pub);
  if(!ok){ ON.jout = null; toast("ما قدرناش نبعثو الطلب"); }
  else { toast("📨 الطلب راح لـ " + f.n); vibe(15); }
  renderOnlineBits();
}
async function answerJoin(code, yes){
  const r = ON.jin[code]; if(!r) return;
  delete ON.jin[code];
  if(yes && isHost && room && room.mode === "online") await sendTo(code, "j", { type: "ja", code: room.code, nm: dispName() }, r.pub);
  else await sendTo(code, "j", { type: "jd", room: ON.hosting && ON.hosting.id }, r.pub);
  clearInbox(code, "j"); vibe(15); renderOnlineBits();
}
// كي القائد يسكّر الغرفة: الطلبات اللي بقات يترفضو (باش يقدرو يعاودو)
function dropJoinRequests(){ for(const code of Object.keys(ON.jin)) answerJoin(code, false); }

// ============================================================
//   الواجهة: صحابي + طلبات الدخول عند القائد
// ============================================================
function friendStatus(f){
  const pr = presOf(f.code);
  if(!pr) return { on: false, txt: "⚫ غير متصل" };
  if(pr.room) return { on: true, room: pr.room, txt: `👑 فاتح غرفة • ${pr.room.n || 1} ${(pr.room.n || 1) > 1 ? "لاعبين" : "لاعب"}${pr.room.ph && pr.room.ph !== "lobby" ? " • يلعبو" : ""}` };
  return { on: true, txt: "🟢 متصل" };
}
function renderOnlineBits(){
  // عدد الطلبات على زر صحابي
  const nReq = Object.keys(ON.fin).length;
  document.querySelectorAll("[data-frbadge]").forEach(b => { b.textContent = nReq; b.classList.toggle("hidden", !nReq); });
  const st = $("wOnlineSt");
  if(st) st.textContent = !ONLINE_OK ? "" : relay.up ? "🟢 متصل بالأونلاين" : ON.ready ? "⏳ نتصلو بالأونلاين…" : "";
  if($("s-friends") && $("s-friends").classList.contains("on")) renderFriends();
  renderJoinReqs();
}
function renderFriends(){
  $("fMyCode").textContent = fmtCode(ON.code) || "…";
  $("fConn").textContent = relay.up ? "" : "⏳ نتصلو بالأونلاين… (لازم إنترنت)";
  // طلبات الصداقة
  const ins = Object.entries(ON.fin);
  $("fReqBox").classList.toggle("hidden", !ins.length);
  $("fReqs").innerHTML = ins.map(([code, r]) => `<div class="pl">${avatarHTML("f" + code, r.n)}<span class="n">${esc(r.n)}<span class="stats-mini" dir="ltr">${fmtCode(code)}</span></span>
    <button class="mini ok" data-fyes="${code}">✔ قبول</button><button class="mini no" data-fno="${code}">✕</button></div>`).join("");
  // اللي بعثتلهم ومازال
  const outs = Object.entries(ON.fout);
  $("fOut").classList.toggle("hidden", !outs.length);
  $("fOut").innerHTML = outs.map(([code, o]) => `<div class="small out-row" dir="rtl">${o.st === "declined" ? "❌ ما قبلش" : "⏳ مستنيين يقبل"}: <b dir="ltr">${fmtCode(code)}</b>
    ${o.st === "declined" ? `<button class="link" data-fagain="${code}">عاود ابعث</button>` : ""}<button class="link" data-fcancel="${code}">✕</button></div>`).join("");
  // صحابي
  const list = ON.friends.slice().sort((a, b) => (presOf(b.code) ? 1 : 0) - (presOf(a.code) ? 1 : 0) || (presOf(b.code) && presOf(b.code).room ? 1 : 0) - (presOf(a.code) && presOf(a.code).room ? 1 : 0));
  $("fInfo").textContent = ON.friends.length ? `${ON.friends.filter(f => presOf(f.code)).length} متصلين من ${ON.friends.length}` : "";
  $("fList").innerHTML = list.length ? list.map(f => {
    const s = friendStatus(f);
    let btn = "";
    if(s.room){
      const mine = ON.jout && ON.jout.host === f.code && ON.jout.room === s.room.id;
      const inThis = !!(net && net.key && s.room && net.key.endsWith(":" + s.room.id));
      if(mine && joinReqWaiting()) btn = `<button class="mini wait" disabled>⏳ الطلب راح…</button>`;
      else if(mine && ON.jout.st === "declined") btn = `<button class="mini ok" data-jreq="${f.code}">🔁 اطلب مرة أخرى</button>`;
      else if(inThis) btn = `<span class="mini wait">✔ راك فيها</span>`;
      else btn = `<button class="mini ok" data-jreq="${f.code}">📨 اطلب الدخول</button>`;
    }
    return `<div class="pl fr ${s.on ? "" : "off"}">${avatarHTML("f" + f.code, f.n)}<span class="n">${esc(f.n)}<span class="stats-mini">${s.txt}</span></span>${btn}<button class="kick" data-frm="${f.code}" aria-label="نحّي">✕</button></div>`;
  }).join("") : `<div class="small" style="text-align:center;padding:14px">ما زال ما عندك حتى صاحب 🙂<br>ابعث الكود تاعك لصحابك، ولا اكتب الكود تاعهم فوق</div>`;
  const q = sel => $("s-friends").querySelectorAll(sel);
  q("[data-fyes]").forEach(b => b.onclick = () => answerFriend(b.dataset.fyes, true));
  q("[data-fno]").forEach(b => b.onclick = () => answerFriend(b.dataset.fno, false));
  q("[data-fagain]").forEach(b => b.onclick = () => { delete ON.fout[b.dataset.fagain]; addFriend(b.dataset.fagain); });
  q("[data-fcancel]").forEach(b => b.onclick = () => { delete ON.fout[b.dataset.fcancel]; saveFriends(); renderFriends(); });
  q("[data-jreq]").forEach(b => b.onclick = () => requestJoin(b.dataset.jreq));
  q("[data-frm]").forEach(b => b.onclick = () => removeFriend(b.dataset.frm));
}
function renderJoinReqs(){
  const box = $("wReqs"); if(!box) return;
  const list = Object.entries(ON.jin);
  const showIt = isHost && room && room.mode === "online" && list.length > 0;
  box.classList.toggle("hidden", !showIt);
  if(!showIt){ box.innerHTML = ""; return; }
  box.innerHTML = `<div class="label">📨 طلبات الدخول (${list.length})</div>` + list.map(([code, r]) => `<div class="pl">${avatarHTML("f" + code, r.n)}<span class="n">${esc(r.n)}<span class="stats-mini">${friendOf(code) ? "👥 صاحبك" : ""}</span></span>
    <button class="mini ok" data-jyes="${code}">✔ قبول</button><button class="mini no" data-jno="${code}">✕</button></div>`).join("");
  box.querySelectorAll("[data-jyes]").forEach(b => b.onclick = () => answerJoin(b.dataset.jyes, true));
  box.querySelectorAll("[data-jno]").forEach(b => b.onclick = () => answerJoin(b.dataset.jno, false));
}
let friendsFrom = "s-home";
async function openFriends(prefill){
  const cur = document.querySelector(".screen.on"); if(cur && cur.id !== "s-friends" && cur.id !== "s-profile") friendsFrom = cur.id;
  if(!ONLINE_OK){ toast("الأصحاب يخدمو في التطبيق ولا في الموقع (https)"); return; }
  if(!hasProfile()){ showProfile(true, () => openFriends(prefill)); return; }
  show("s-friends"); renderFriends();
  await onlineInit();
  if(prefill){ $("fAddCode").value = fmtCode(cleanCode(prefill)); }
  renderFriends();
}
async function shareMyCode(){
  const code = fmtCode(ON.code);
  const link = `${SITE}join.html?f=${ON.code}`;
  const text = `زيدني في صحابك في "مين المحتال؟" 🕵️\nالكود تاعي: ${code}\nولا افتح هذا الرابط: ${link}`;
  if(SHARE){ try{ await SHARE.share({ title: "مين المحتال؟", text, dialogTitle: "ابعث الكود تاعك" }); return; }catch(e){ if(String(e && e.message).match(/cancel/i)) return; } }
  else if(navigator.share){ try{ await navigator.share({ title: "مين المحتال؟", text }); return; }catch(e){ if(e && e.name === "AbortError") return; } }
  toast(await copyText(text) ? "📋 تنسخ — الصقو لصاحبك" : "ما قدرناش ننسخو");
}
$("fMyCode").onclick = async () => { toast(await copyText(fmtCode(ON.code)) ? "📋 تنسخ الكود: " + fmtCode(ON.code) : "ما قدرناش ننسخو"); };
$("fShare").onclick = shareMyCode;
$("fAdd").onclick = async () => { if(await addFriend($("fAddCode").value)) $("fAddCode").value = ""; renderFriends(); };
$("fAddCode").onkeydown = e => { if(e.key === "Enter") $("fAdd").click(); };
document.querySelectorAll("[data-friends]").forEach(b => b.onclick = () => openFriends());
$("fBack").onclick = () => { if(friendsFrom === "s-w-name") openWifi(); else show(friendsFrom === "s-friends" ? "s-home" : friendsFrom); };
