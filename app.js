"use strict";
/* ============================================================
   شكون المحتال؟ — صُنع بواسطة Chaker Red
   ============================================================ */

// ---------- أدوات ----------
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function rnd(n){ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(arr){ const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uid(){ return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join(""); }
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function vibe(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
const wait = ms => new Promise(r => setTimeout(r, ms));

let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2200); }
function ask(text){
  return new Promise(res => {
    $("mText").textContent = text; $("modal").classList.remove("hidden");
    const done = v => { $("modal").classList.add("hidden"); $("mYes").onclick = $("mNo").onclick = null; res(v); };
    $("mYes").onclick = () => done(true); $("mNo").onclick = () => done(false);
  });
}
function show(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  window.scrollTo(0, 0);
}
function confetti(){
  const box = $("confetti"); box.innerHTML = "";
  const cols = ["#ffcf3f","#ff5d73","#3fe0a5","#7d66ff","#fff"];
  for(let i = 0; i < 70; i++){
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    p.style.animationDelay = Math.random() * .5 + "s";
    box.appendChild(p);
  }
  setTimeout(() => box.innerHTML = "", 4500);
}
const AV_COLORS = ["#ffcf3f","#3fe0a5","#ff8da0","#9d8bff","#6fd3ff","#ffa95c","#c6f26b","#f39cff"];
function avColor(id){ let h = 0; for(const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }

// ---------- الكلمات ----------
const CATS = RAW_CATEGORIES.map(c => ({ id: c.id, icon: c.icon, name: c.name.replace(" 🇩🇿", ""),
  base: [...new Set(c.words.split("\n").map(s => s.trim()).filter(Boolean))], list: [] }));
const catById = id => CATS.find(c => c.id === id);
// تعديلات المستعمل: كلمات زادها وكلمات نحّاها (تتسجل في الهاتف)
let wordEdits = store.get("wordEdits", {});
function catEdits(id){ return wordEdits[id] || (wordEdits[id] = { added: [], removed: [] }); }
function applyEdits(){
  for(const c of CATS){
    const e = wordEdits[c.id] || { added: [], removed: [] };
    c.list = [...new Set([...e.added, ...c.base.filter(w => !e.removed.includes(w))])];
  }
}
applyEdits();
function pickWord(catIds){
  const pool = catIds.map(catById).filter(c => c && c.list.length);
  const cats = pool.length ? pool : CATS.filter(c => c.list.length);
  if(!cats.length) return null;
  // اختيار فئة حسب عدد كلماتها
  let total = cats.reduce((s, c) => s + c.list.length, 0), r = rnd(total), cat = cats[0];
  for(const c of cats){ if(r < c.list.length){ cat = c; break; } r -= c.list.length; }
  const used = store.get("used_" + cat.id, []);
  let left = cat.list.filter(w => !used.includes(w));
  if(!left.length){ left = cat.list.slice(); used.length = 0; }
  const word = left[rnd(left.length)];
  used.push(word); store.set("used_" + cat.id, used);
  return { cat, word };
}
function catsLabel(ids){
  if(!ids.length || ids.length === CATS.length) return "🎲 كل الفئات";
  if(ids.length === 1){ const c = catById(ids[0]); return c.icon + " " + c.name; }
  return "🎲 " + ids.length + " فئات";
}
function renderCatGrid(el, selected, onToggle){
  el.classList.toggle("readonly", !onToggle);
  el.innerHTML = CATS.map(c => `<button class="cat ${selected.includes(c.id) ? "sel" : ""}" data-id="${c.id}"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}</span></button>`).join("");
  if(onToggle) el.querySelectorAll(".cat").forEach(b => b.onclick = () => { vibe(8); onToggle(b.dataset.id); });
}

// ---------- البطاقة (نفس الشكل للجميع) ----------
function cardHTML(){ return `<div class="in"><div class="face front"><div class="q">؟</div><div class="tap">اضغط مطوّل باش تشوف كلمتك 👆</div></div><div class="face back"><div class="cat-l"></div><div class="word"></div><div class="hint"></div><div class="again">سيّب صبعك باش تخبّيها</div></div></div>`; }

// الضغط المطوّل: الكلمة تبان غير وقت الضغط، وكي تسيّب صبعك تتخبّى
function holdToShow(el, onShow, onHide){
  let down = false;
  const start = e => {
    if(e.button > 0) return;
    e.preventDefault(); down = true;
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
    vibe(15); onShow();
  };
  const end = () => { if(!down) return; down = false; onHide(); };
  el.addEventListener("pointerdown", start);
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => el.addEventListener(t, end));
  el.addEventListener("contextmenu", e => e.preventDefault());
  // لو التطبيق راح للخلفية وهو مضغوط
  document.addEventListener("visibilitychange", () => { if(document.hidden) end(); });
}
function fillCard(el, {isImp, word, catName, hint, againText}){
  if(!el.firstChild) el.innerHTML = cardHTML();
  el.querySelector(".cat-l").textContent = "الفئة: " + (isImp && !hint ? "؟" : catName);
  el.querySelector(".word").textContent = isImp ? "أنت المحتال 🤫" : word;
  el.querySelector(".hint").textContent = isImp ? "حاول تفهم الكلمة من كلامهم" : "ما تقولهاش للمحتال!";
  el.querySelector(".again").textContent = againText || "";
}

// ---------- الجسر مع أندرويد ----------
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const getPlugin = n => (window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin(n) : window.Capacitor.Plugins[n]);
const LN = NATIVE ? getPlugin("LocalNet") : null;
const APP = NATIVE ? getPlugin("App") : null;
const SHARE = NATIVE ? getPlugin("Share") : null;
const CLIP = NATIVE ? getPlugin("Clipboard") : null;
const SITE = "https://chakerredjil552-bot.github.io/imposter-game/";
// رابط دعوة جا من برا (mohtal://join?r=IP)
let pendingJoin = null;
const PORT = 47800;            // منفذ الغرفة على الهاتف
const TEST_PORT = 47801;       // خادم التجربة على الحاسوب
const HTTP_PORT = 47880;       // صفحة اللعبة على هاتف القائد (للآيفون)
const PARAMS = new URLSearchParams(location.search);
// HOSTED: الصفحة جات من هاتف القائد (config.js يعطينا منفذ الغرفة)
const HOSTED = !NATIVE && !PARAMS.has("leader") && typeof window.ROOM_WS_PORT === "number";
// القائد لازم يكون التطبيق (أو ?leader للتجربة على الحاسوب)
const CAN_LEAD = NATIVE || PARAMS.has("leader");
const keepAwake = on => { if(LN) LN.keepAwake({ on }).catch(() => {}); };

// ============================================================
//   البداية: الأذونات (مرة وحدة) + شاشة صُنع بواسطة
// ============================================================
async function boot(){
  // في المتصفح ما كاين حتى إذن نطلبوه
  if(!NATIVE) store.set("onboarded", true);
  // جاي من رابط القائد: نروحو مباشرة للدخول
  if(HOSTED){
    if(PARAMS.get("name")) store.set("myName", PARAMS.get("name").slice(0, 14));
    show("s-splash"); await wait(1400);
    openWifi();
    if(store.get("myName", "")) $("wJoin").click();
    return;
  }
  if(!store.get("onboarded", false)){
    show("s-perm");
    $("btnPerm").onclick = async () => {
      $("btnPerm").disabled = true;
      try{ if(LN) await LN.requestPerms(); }catch(e){}
      store.set("onboarded", true);
      splash();
    };
  } else splash();
}
async function splash(){
  show("s-splash");
  await wait(1900);
  if(!$("s-splash").classList.contains("on")) return;
  if(pendingJoin) goPendingJoin(); else show("s-home");
}
// ----- روابط الدعوة -----
function parseInvite(text){
  const s = String(text || "");
  const m = /[?&]r=([^&#\s]+)/.exec(s);
  let r = m ? decodeURIComponent(m[1]) : s.trim();
  r = r.replace(/\s/g, "");
  if(!/^[\w.\-]+(:\d+)?$/.test(r)) return null;
  const [ip, port] = r.split(":");
  return { ip, port: +port || PORT };
}
function goPendingJoin(){
  if(!pendingJoin) return;
  if(net){ toast("راك في غرفة دوك — اخرج منها أولاً"); pendingJoin = null; return; }
  openWifi();
  if(store.get("myName", "")) $("wJoin").click();
  else { $("wName").focus(); toast("اكتب اسمك ومن بعد اضغط ادخل للغرفة"); }
}
function handleInviteUrl(url){
  const inv = parseInvite(url); if(!inv) return;
  pendingJoin = inv;
  // إذا اللعبة مفتوحة من قبل (ماشي في شاشة البداية) ندخلو مباشرة
  const on = document.querySelector(".screen.on");
  if(on && on.id !== "s-splash" && on.id !== "s-perm") goPendingJoin();
}
if(APP){
  APP.addListener("appUrlOpen", e => handleInviteUrl(e && e.url));
  APP.getLaunchUrl().then(r => { if(r && r.url) handleInviteUrl(r.url); }).catch(() => {});
}
document.querySelectorAll("[data-home]").forEach(b => b.onclick = () => show("s-home"));
$("goPass").onclick = () => { renderPassSetup(); show("s-pass-setup"); };
function openWifi(){
  $("wName").value = store.get("myName", "");
  $("wHost").classList.toggle("hidden", !CAN_LEAD);
  $("wWebNote").classList.toggle("hidden", CAN_LEAD);
  $("wJoin").className = CAN_LEAD ? "btn ghost" : "btn";
  $("wJoin").textContent = HOSTED || pendingJoin ? "🚪 ادخل للغرفة" : "🔎 انضمام لغرفة";
  show("s-w-name");
}
$("goWifi").onclick = openWifi;

// ============================================================
//   وضع الهاتف الواحد
// ============================================================
let pcfg = store.get("passCfg", { players: 4, imps: 1, hint: true, names: [], cats: CATS.map(c => c.id) });
pcfg.cats = (pcfg.cats || []).filter(catById);
let pgame = null;
const pMaxImps = () => Math.max(1, Math.floor((pcfg.players - 1) / 2));
function settingsHTML(prefix, s, editable, maxI){
  return `<div class="row set-row"><div><div class="label">عدد المحتالين</div><div class="small">يتم اختيارهم عشوائياً</div></div>
    <div class="stepper"><button ${editable ? "" : "disabled"} data-${prefix}imps="1">+</button><b>${s.imps}</b><button ${editable ? "" : "disabled"} data-${prefix}imps="-1">−</button></div></div>
    <div class="row set-row"><div><div class="label">المحتال يشوف الفئة</div><div class="small">تلميح صغير للمحتال</div></div>
    <button class="toggle ${s.hint ? "on" : ""}" ${editable ? "" : "disabled"} data-${prefix}hint></button></div>`;
}
function renderPassSetup(){
  if(pcfg.imps > pMaxImps()) pcfg.imps = pMaxImps();
  $("pPlayers").textContent = pcfg.players;
  const box = $("pNames");
  while(box.children.length > pcfg.players) box.lastChild.remove();
  for(let i = box.children.length; i < pcfg.players; i++){
    const inp = document.createElement("input");
    inp.maxLength = 14; inp.placeholder = "اللاعب " + (i + 1); inp.value = pcfg.names[i] || "";
    inp.oninput = () => { pcfg.names[i] = inp.value.trim(); store.set("passCfg", pcfg); };
    box.appendChild(inp);
  }
  $("pSettings").innerHTML = settingsHTML("p", pcfg, true);
  $("pSettings").querySelectorAll("[data-pimps]").forEach(b => b.onclick = () => { pcfg.imps = Math.min(pMaxImps(), Math.max(1, pcfg.imps + +b.dataset.pimps)); renderPassSetup(); });
  $("pSettings").querySelector("[data-phint]").onclick = () => { pcfg.hint = !pcfg.hint; renderPassSetup(); };
  renderCatGrid($("pCats"), pcfg.cats, id => {
    pcfg.cats = pcfg.cats.includes(id) ? pcfg.cats.filter(x => x !== id) : [...pcfg.cats, id];
    renderPassSetup();
  });
  $("pStart").disabled = !pcfg.cats.length;
  $("pStart").textContent = pcfg.cats.length ? "ابدأ اللعب ▶" : "اختار فئة وحدة على الأقل";
  store.set("passCfg", pcfg);
}
document.querySelectorAll("[data-pstep]").forEach(b => b.onclick = () => { pcfg.players = Math.min(20, Math.max(3, pcfg.players + +b.dataset.d)); renderPassSetup(); });
document.querySelector('[data-allcats="pass"]').onclick = () => {
  pcfg.cats = pcfg.cats.length === CATS.length ? [] : CATS.map(c => c.id); renderPassSetup();
};

function passStart(){
  const picked = pickWord(pcfg.cats);
  if(!picked){ toast("الفئات اللي اخترتها فارغة — زيد كلمات ✏️"); return; }
  const { cat, word } = picked;
  const players = Array.from({ length: pcfg.players }, (_, i) => pcfg.names[i] || ("اللاعب " + (i + 1)));
  pgame = { cat, word, players, imps: shuffle(players.map((_, i) => i)).slice(0, pcfg.imps), turn: 0 };
  $("passCat").textContent = catsLabel(pcfg.cats);
  $("pFlip").innerHTML = cardHTML();
  passTurn(); show("s-pass");
}
function passTurn(){
  const i = pgame.turn;
  $("passName").textContent = pgame.players[i];
  $("passHint").textContent = i === 0 ? "الهاتف عند" : "مرّر الهاتف إلى";
  $("dots").innerHTML = pgame.players.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("");
  fillCard($("pFlip"), { isImp: pgame.imps.includes(i), word: pgame.word, catName: pgame.cat.name, hint: pcfg.hint, againText: "سيّب صبعك باش تخبّيها" });
  $("pFlip").classList.remove("open");
  $("pNext").classList.add("hidden");
  $("pNext").textContent = i === pgame.players.length - 1 ? "فهمت، خبّي ✔" : "فهمت، خبّي ومرّر ⬅";
}
$("pStart").onclick = passStart;
// هاتف واحد: اضغط مطوّل باش تشوف، وكي تسيّب يبان زر "مرّر"
holdToShow($("pFlip"),
  () => $("pFlip").classList.add("open"),
  () => { $("pFlip").classList.remove("open"); $("pNext").classList.remove("hidden"); });
$("pNext").onclick = () => {
  $("pFlip").classList.remove("open"); $("pNext").classList.add("hidden");
  setTimeout(() => { pgame.turn++; if(pgame.turn >= pgame.players.length) show("s-pass-ready"); else passTurn(); }, 400);
};
// دوران اختيار من يبدأ — ينتهي دايماً على نفس الشخص في كل الهواتف
function spinTo(el, names, finalIdx, done){
  const n = names.length, steps = 16 + (finalIdx % 5);
  let k = 0, delay = 50;
  (function tick(){
    el.textContent = names[((finalIdx - steps + k) % n + n * 10) % n];
    if(k < steps){ k++; delay *= 1.09; vibe(4); setTimeout(tick, delay); }
    else { el.textContent = "🎤 " + names[finalIdx]; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); vibe([30, 40, 60]); done && done(); }
  })();
}
$("pGo").onclick = () => {
  show("s-pass-first");
  $("pReveal").classList.add("hidden"); $("pRule").classList.add("hidden");
  spinTo($("pSpin"), pgame.players, rnd(pgame.players.length), () => {
    $("pRule").classList.remove("hidden");
    setTimeout(() => $("pReveal").classList.remove("hidden"), 400);
  });
};
function revealHTML(impNames, word){
  return `<div class="emoji">🎭</div>
    <div class="reveal-card pop" style="animation-delay:.15s"><div class="k">${impNames.length > 1 ? "المحتالين كانو" : "المحتال كان"}</div><div class="v imp">${esc(impNames.join(" و "))}</div></div>
    <div class="reveal-card pop" style="animation-delay:.35s"><div class="k">الكلمة كانت</div><div class="v wd">${esc(word)}</div></div>`;
}
$("pReveal").onclick = async () => {
  if(!await ask("متأكدين؟ رايح يبان المحتال والكلمة.")) return;
  $("pRevealBox").innerHTML = revealHTML(pgame.imps.map(i => pgame.players[i]), pgame.word);
  show("s-pass-reveal"); confetti();
};
$("pAgain").onclick = passStart;
$("pBack").onclick = () => { renderPassSetup(); show("s-pass-setup"); };
document.querySelector("[data-quit-pass]").onclick = async () => { if(await ask("تحب توقف الجولة؟")) { renderPassSetup(); show("s-pass-setup"); } };

// ============================================================
//   وضع الواي فاي
// ============================================================
// ?as=xxx للتجربة على الحاسوب فقط (كل نافذة كأنها هاتف مختلف)
const TEST_AS = !NATIVE && new URLSearchParams(location.search).get("as");
const myId = TEST_AS || store.get("myId", null) || (() => { const id = uid(); store.set("myId", id); return id; })();
let net = null;        // اتصال الويب سوكت الحالي
let room = null;       // منطق الغرفة (عند القائد فقط)
let isHost = false;
let lastState = null;
let discovering = false;
let webLinks = [];     // روابط صفحة الويب عند القائد (للآيفون)
let httpPort = HTTP_PORT;
// رابط الدعوة: يفتح التطبيق في الغرفة، ولا المتصفح
function inviteLink(){
  const s = lastState; if(!s || !s.ips.length) return null;
  const host = s.players.find(p => p.host);
  return `${SITE}join.html?r=${encodeURIComponent(s.ips[0])}${httpPort !== HTTP_PORT ? "&h=" + httpPort : ""}&n=${encodeURIComponent(host ? host.name : "")}`;
}
async function copyCode(){
  const s = lastState; if(!s || !s.ips.length) return;
  toast(await copyText(s.ips[0]) ? "📋 تنسخ الرمز: " + s.ips[0] : "ما قدرناش ننسخو");
  vibe(15);
}
async function sendInvite(){
  const link = inviteLink(); if(!link){ toast("شعّل الواي فاي ولا نقطة الاتصال أولاً"); return; }
  const code = lastState.ips[0];
  const text = `تعال نلعبو شكون المحتال؟ 🕵️\nادخل للغرفة من هنا 👇\n${link}\n\nولا اكتب رمز الغرفة: ${code}\n(لازم تكون في نفس الواي فاي)`;
  if(SHARE){
    try{ await SHARE.share({ title: "شكون المحتال؟", text, dialogTitle: "ابعث الدعوة لصحابك" }); return; }catch(e){ if(String(e && e.message).match(/cancel/i)) return; }
  } else if(navigator.share){
    try{ await navigator.share({ title: "شكون المحتال؟", text }); return; }catch(e){ if(e && e.name === "AbortError") return; }
  }
  toast(await copyText(text) ? "📋 تنسخت الدعوة — الصقها في أي محادثة" : "ما قدرناش ننسخو");
}

function myName(){ return ($("wName").value || "").trim(); }
function needName(){
  const n = myName();
  if(!n){ toast("اكتب اسمك أولاً ✍️"); $("wName").focus(); return null; }
  store.set("myName", n); return n;
}

// ----- اتصال مع إعادة محاولة تلقائية -----
class Link {
  constructor(url, onMsg, onStatus){
    this.url = url; this.onMsg = onMsg; this.onStatus = onStatus;
    this.closed = false; this.tries = 0; this.queue = [];
    this.open();
  }
  open(){
    let ws;
    try{ ws = new WebSocket(this.url); }catch(e){ return this.retry(); }
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; this.onStatus("up"); this.queue.splice(0).forEach(m => ws.send(m)); };
    ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(_){ return; } this.onMsg(m); };
    ws.onclose = () => { if(this.closed) return; this.onStatus("down", this.tries); this.retry(); };
    ws.onerror = () => {};
  }
  retry(){
    if(this.closed) return;
    this.tries++;
    if(this.tries > 25){ this.onStatus("dead"); return; }
    setTimeout(() => this.open(), Math.min(400 * this.tries, 2000));
  }
  send(obj){
    const m = JSON.stringify(obj);
    if(this.ws && this.ws.readyState === 1) this.ws.send(m); else this.queue.push(m);
  }
  close(){ this.closed = true; try{ this.ws && this.ws.close(); }catch(e){} }
}

// ----- القائد: منطق الغرفة كامل هنا، والباقي يستقبلو الحالة -----
class HostRoom {
  constructor(name){
    this.players = [{ id: myId, name, online: true, host: true }];
    this.settings = store.get("hostSettings", { imps: 1, hint: true, cats: CATS.map(c => c.id) });
    this.settings.cats = this.settings.cats.filter(catById);
    this.phase = "lobby";
    this.round = null;
    this.roomName = name;
    this.ips = [];
    this.pending = false;
  }
  maxImps(n){ return Math.max(1, Math.floor(((n || this.players.length) - 1) / 2)); }
  player(id){ return this.players.find(p => p.id === id); }
  // من السيرفر
  onServer(m){
    if(m.t === "join"){
      const p = this.player(m.id);
      if(p){ p.online = true; p.name = m.name || p.name; }
      else { this.players.push({ id: m.id, name: (m.name || "لاعب").slice(0, 14), online: true }); toast("👋 " + (m.name || "لاعب") + " دخل للغرفة"); vibe(15); }
      this.sync();
    } else if(m.t === "leave"){
      const p = this.player(m.id);
      if(p){
        // في اللوبي نحيه، وفي الجولة نخليه (يقدر يرجع)
        if(this.phase === "lobby"){ this.players = this.players.filter(x => x.id !== m.id); toast("🚪 " + p.name + " خرج"); }
        else p.online = false;
        if(this.phase === "vote") this.checkVoteDone();
        this.sync();
      }
    } else if(m.t === "msg"){
      const d = m.d || {}, p = this.player(m.from);
      if(!p) return;
      if(d.a === "seen" && this.round && this.round.ids.includes(p.id) && !this.round.seen.includes(p.id)){ this.round.seen.push(p.id); this.sync(); }
      if(d.a === "vote") this.castVote(p.id, d.target, d.no);
      if(d.a === "bye"){ this.players = this.players.filter(x => x.id !== p.id); if(this.round) this.round.ids = this.round.ids.filter(x => x !== p.id); this.sync(); }
    }
  }
  // أوامر القائد
  setSettings(fn){ fn(this.settings); this.settings.imps = Math.min(this.settings.imps, this.maxImps()); store.set("hostSettings", this.settings); this.sync(); }
  kick(id){
    const p = this.player(id); if(!p || p.host) return;
    this.players = this.players.filter(x => x.id !== id);
    if(this.round){
      this.round.ids = this.round.ids.filter(x => x !== id);
      if(this.round.votes){ delete this.round.votes[id]; for(const v in this.round.votes) if(this.round.votes[v] === id) delete this.round.votes[v]; }
    }
    net.send({ t: "kick", id });
    if(this.phase === "vote") this.checkVoteDone();
    this.sync();
  }
  // ----- التصويت -----
  startVote(){
    const r = this.round; if(!r) return;
    r.votes = {}; r.voteNo = (r.voteNo || 0) + 1; r.result = null;
    this.phase = "vote";
    this.sync();
  }
  castVote(voter, targetIdx, voteNo){
    const r = this.round;
    if(this.phase !== "vote" || !r || voteNo !== r.voteNo) return;
    if(!r.ids.includes(voter) || r.votes[voter]) return;            // صوت واحد برك
    const target = r.ids[targetIdx];
    if(!target || target === voter) return;                          // ما تصوتش على روحك
    r.votes[voter] = target;
    this.checkVoteDone();
    this.sync();
  }
  voters(){ const r = this.round; return r.ids.filter(id => { const p = this.player(id); return p && p.online; }); }
  checkVoteDone(){
    const r = this.round;
    if(this.phase !== "vote" || !r) return;
    const need = this.voters();
    if(need.length && need.every(id => r.votes[id])) this.finishVote();
  }
  finishVote(){
    const r = this.round;
    const counts = r.ids.map(id => Object.values(r.votes).filter(t => t === id).length);
    const max = Math.max(0, ...counts);
    const tops = r.ids.filter((_, i) => counts[i] === max && max > 0);
    if(tops.length !== 1){
      // تعادل: يكملو الأسئلة ويعاودو يصوتو
      r.tie = { no: r.voteNo, counts };
      this.phase = "first";
    } else {
      r.tie = null;
      r.result = { winner: r.imps.includes(tops[0]) ? "players" : "imposter", top: tops[0], counts, votes: { ...r.votes } };
      this.phase = "reveal";
    }
    this.sync();
  }
  start(){
    const ids = this.players.filter(p => p.online).map(p => p.id);
    if(ids.length < 3){ toast("لازم 3 لاعبين على الأقل"); return; }
    if(!this.settings.cats.length){ toast("اختار فئة وحدة على الأقل"); return; }
    const imps = Math.min(this.settings.imps, this.maxImps(ids.length));
    const picked = pickWord(this.settings.cats);
    if(!picked){ toast("الفئات اللي اخترتها فارغة — زيد كلمات ✏️"); return; }
    const { cat, word } = picked;
    this.round = { no: (this.round ? this.round.no : 0) + 1, ids, imps: shuffle(ids).slice(0, imps), word, cat: cat.id, seen: [], first: null };
    this.phase = "card";
    this.sync();
  }
  pickFirst(){ this.round.first = this.round.ids[rnd(this.round.ids.length)]; this.round.tie = null; this.phase = "first"; this.sync(); }
  reveal(){ this.phase = "reveal"; this.sync(); }
  toLobby(){
    this.phase = "lobby";
    this.players = this.players.filter(p => p.online);
    this.sync();
  }
  // حالة مخصصة لكل لاعب
  snapshot(pid){
    const r = this.round, inRound = !!(r && r.ids.includes(pid));
    const s = {
      phase: this.phase, roomName: this.roomName, ips: this.ips,
      players: this.players.map(p => ({ id: p.id, name: p.name, online: p.online, host: !!p.host })),
      settings: this.settings, maxImps: this.maxImps(),
      round: null
    };
    if(r && this.phase !== "lobby"){
      const cat = catById(r.cat);
      s.round = {
        no: r.no, inRound, count: r.ids.length, seen: r.seen.length,
        names: r.ids.map(id => (this.player(id) || {}).name || "؟"),
        firstIdx: r.first ? r.ids.indexOf(r.first) : -1,
        me: inRound ? { isImp: r.imps.includes(pid), word: r.imps.includes(pid) ? null : r.word, catName: cat.name, hint: this.settings.hint } : null,
        reveal: this.phase === "reveal" ? { imps: r.imps.map(id => (this.player(id) || {}).name || "؟"), word: r.word,
          impIdx: r.imps.map(id => r.ids.indexOf(id)),
          result: r.result ? { winner: r.result.winner, topIdx: r.ids.indexOf(r.result.top), counts: r.result.counts,
            myVoteIdx: r.result.votes[pid] ? r.ids.indexOf(r.result.votes[pid]) : -1 } : null } : null,
        // عدد الأصوات على كل لاعب يبان للجميع وقت التصويت
        vote: this.phase === "vote" ? { no: r.voteNo, counts: r.ids.map(id => Object.values(r.votes).filter(t => t === id).length),
          voted: Object.keys(r.votes).length, total: this.voters().length,
          myVote: r.votes[pid] ? r.ids.indexOf(r.votes[pid]) : -1, myIdx: r.ids.indexOf(pid) } : null,
        tie: this.phase === "first" && r.tie ? r.tie : null
      };
    }
    return s;
  }
  // نرسل الحالة للجميع (مجمعة باش تكون سريعة)
  sync(){
    if(this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "state", s: this.snapshot(p.id) } });
      onState(this.snapshot(myId));
    });
  }
}

// ----- إنشاء غرفة -----
$("wHost").onclick = async () => {
  const name = needName(); if(!name) return;
  $("wHost").disabled = true;
  try{
    let url, ips = [];
    if(LN){
      const r = await LN.startServer({ port: PORT, name });
      const port = r.port || PORT;
      ips = (r.ips || []).map(ip => port === PORT ? ip : ip + ":" + port);
      webLinks = r.httpPort > 0 ? (r.ips || []).map(ip => `http://${ip}:${r.httpPort}`) : [];
      httpPort = r.httpPort > 0 ? r.httpPort : HTTP_PORT;
      url = `ws://127.0.0.1:${port}/?role=host&id=${myId}&name=${encodeURIComponent(name)}`;
    } else {
      url = `ws://${location.hostname || "localhost"}:${TEST_PORT}/?role=host&id=${myId}&name=${encodeURIComponent(name)}`;
      ips = [location.hostname || "localhost"];
      webLinks = [`http://${location.host}/`];
      httpPort = +location.port || 80;
    }
    if(LN && !ips.length) toast("⚠️ شعّل الواي فاي ولا نقطة الاتصال باش صحابك يدخلو");
    isHost = true; room = new HostRoom(name); room.ips = ips;
    net = new Link(url, m => room.onServer(m), st => connStatus(st));
    keepAwake(true);
    room.sync();
  }catch(e){
    toast("ما قدرناش نفتحو الغرفة. تأكد من الواي فاي");
  }
  $("wHost").disabled = false;
};

// ----- البحث والانضمام -----
const foundRooms = new Map();
function renderRooms(){
  const box = $("rooms");
  if(!foundRooms.size){ box.innerHTML = `<div class="small" style="text-align:center;padding:18px">ما زال ما لقينا حتى غرفة… خلي القائد يفتح غرفة</div>`; return; }
  box.innerHTML = [...foundRooms.values()].map(r => `<button class="room" data-ip="${esc(r.host)}" data-port="${r.port}"><span class="ri">👑</span><span><b>غرفة ${esc(r.name)}</b><small>اضغط باش تدخل</small></span></button>`).join("");
  box.querySelectorAll(".room").forEach(b => b.onclick = () => joinRoom(b.dataset.ip, +b.dataset.port));
}
$("wJoin").onclick = async () => {
  if(!needName()) return;
  // الصفحة جات من هاتف القائد: ندخلو مباشرة
  if(HOSTED){ joinRoom(location.hostname, window.ROOM_WS_PORT); return; }
  // جاي من رابط دعوة: الرمز واجد
  if(pendingJoin){ const p = pendingJoin; pendingJoin = null; joinRoom(p.ip, p.port); return; }
  foundRooms.clear();
  // في الموقع (GitHub) ما نقدروش نقلبو على الغرف، غير بالرمز
  $("wSearching").classList.toggle("hidden", !NATIVE);
  $("rooms").classList.toggle("hidden", !NATIVE);
  renderRooms(); show("s-w-find");
  $("wIp").value = store.get("lastIp", "");
  if(LN && !discovering){
    discovering = true;
    try{ await LN.startDiscovery(); }catch(e){ toast("البحث التلقائي ما خدمش، استعمل الرمز"); }
  }
};
if(LN){
  LN.addListener("room", r => {
    const key = r.host + ":" + r.port;
    if(r.lost){ for(const [k, v] of foundRooms) if(v.name === r.name) foundRooms.delete(k); }
    else foundRooms.set(key, r);
    renderRooms();
  });
}
function stopDiscovery(){ if(LN && discovering){ discovering = false; LN.stopDiscovery().catch(() => {}); } }
document.querySelector("[data-wback]").onclick = () => { stopDiscovery(); show("s-w-name"); };
$("wIpGo").onclick = () => {
  // يقبل الرمز ولا رابط الدعوة كامل
  const inv = parseInvite($("wIp").value.trim());
  if(!inv){ toast("الرمز ماشي صحيح"); return; }
  const v = inv.ip + (inv.port !== PORT ? ":" + inv.port : "");
  const ip = inv.ip, port = inv.port !== PORT ? inv.port : 0;
  store.set("lastIp", v);
  if(!NATIVE){
    // من المتصفح: نروحو لصفحة اللعبة اللي على هاتف القائد
    location.href = `http://${ip}:${HTTP_PORT}/?name=${encodeURIComponent(store.get("myName", ""))}`;
    return;
  }
  joinRoom(ip, +port || PORT);
};
function joinRoom(ip, port){
  const name = needName(); if(!name) return;
  stopDiscovery();
  isHost = false; room = null; lastState = null;
  let gotState = false;
  const url = `ws://${ip}:${port}/?role=player&id=${myId}&name=${encodeURIComponent(name)}`;
  net = new Link(url, m => {
    if(m.t === "msg" && m.d && m.d.type === "state"){ gotState = true; onState(m.d.s); }
    else if(m.t === "kicked"){ leaveRoom(false); toast("القائد خرّجك من الغرفة 😅"); }
    else if(m.t === "hostgone"){ leaveRoom(false); toast("القائد سكّر الغرفة"); }
  }, st => {
    if(st === "dead" && !gotState){ leaveRoom(false); toast("ما قدرناش ندخلو للغرفة. تأكد أنكم في نفس الواي فاي"); show("s-w-find"); }
    else connStatus(st);
  });
  keepAwake(true);
  toast("⏳ نتصلو بالغرفة…");
}
function connStatus(st){
  $("wConn").classList.toggle("hidden", st === "up");
  if(st === "dead"){ leaveRoom(false); toast("انقطع الاتصال مع الغرفة"); }
}
async function leaveRoom(sendBye){
  if(net){
    if(sendBye && !isHost) net.send({ d: { a: "bye" } });
    const n = net; net = null;
    setTimeout(() => n.close(), sendBye ? 150 : 0);
  }
  if(isHost && LN) LN.stopServer().catch(() => {});
  isHost = false; room = null; lastState = null;
  keepAwake(false);
  show("s-w-name");
}
$("wLeave").onclick = async () => {
  if(await ask(isHost ? "تسكّر الغرفة؟ كل اللاعبين يخرجو." : "تخرج من الغرفة؟")) leaveRoom(true);
};

// ----- عرض الحالة (نفس الشي عند الكل) -----
let shownRound = 0, spunRound = 0, seenSent = 0;
function onState(s){
  const prev = lastState; lastState = s;
  if(!document.getElementById("s-w-room").classList.contains("on")) show("s-w-room");
  document.querySelectorAll("#s-w-room .host-only").forEach(e => e.classList.toggle("hidden", !isHost));
  document.querySelectorAll("#s-w-room .guest-only").forEach(e => e.classList.toggle("hidden", isHost));

  const host = s.players.find(p => p.host);
  $("wRoomChip").textContent = "👑 غرفة " + (host ? host.name : s.roomName);
  const online = s.players.filter(p => p.online).length;
  const cnt = $("wCount");
  if(cnt.dataset.n !== String(online)){ cnt.dataset.n = online; cnt.innerHTML = `👥 ${online}`; cnt.classList.remove("bump"); void cnt.offsetWidth; cnt.classList.add("bump"); }

  let view = s.phase;
  if(s.phase !== "lobby" && s.round && !s.round.inRound) view = "wait";
  document.querySelectorAll("#s-w-room .view").forEach(v => v.classList.toggle("on", v.id === "v-" + view));

  if(view === "lobby") renderLobby(s, prev);
  if(view === "card" || view === "first" || view === "reveal" || view === "vote") renderRound(s);
}
function renderLobby(s){
  $("wCodeBox").classList.toggle("hidden", !isHost || !s.ips.length);
  $("wCode").textContent = s.ips.join("  •  ");
  // رابط + QR لأصحاب الآيفون
  const link = isHost && webLinks[0];
  $("wWebBox").classList.toggle("hidden", !link);
  if(link && $("wLink").textContent !== link){
    $("wLink").textContent = link;
    try{ const q = qrcode(0, "M"); q.addData(link); q.make(); $("wQr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }catch(e){}
  }
  const online = s.players.filter(p => p.online);
  $("wPlayersInfo").textContent = online.length < 3 ? `لازم ${3 - online.length} آخرين على الأقل` : `${online.length} لاعبين جاهزين`;
  const list = $("wPlayers");
  const key = isHost + "|" + s.players.map(p => p.id + p.online + p.name).join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = s.players.map(p => `<div class="pl ${p.online ? "" : "off"}">
      <span class="av" style="background:${avColor(p.id)}">${esc(p.name.trim()[0] || "؟")}</span>
      <span class="n">${esc(p.name)}${p.id === myId ? " (أنت)" : ""}</span>
      <span class="tag">${p.host ? "👑 القائد" : p.online ? "" : "غير متصل"}</span>
      ${isHost && !p.host ? `<button class="kick" data-kick="${p.id}">✕</button>` : ""}</div>`).join("");
    list.querySelectorAll("[data-kick]").forEach(b => b.onclick = async () => {
      const p = s.players.find(x => x.id === b.dataset.kick);
      if(p && await ask(`تخرّج ${p.name} من الغرفة؟`)) room.kick(p.id);
    });
  }
  $("wSettings").innerHTML = settingsHTML("w", s.settings, isHost);
  if(isHost){
    $("wSettings").querySelectorAll("[data-wimps]").forEach(b => b.onclick = () => room.setSettings(st => st.imps = Math.min(s.maxImps, Math.max(1, st.imps + +b.dataset.wimps))));
    $("wSettings").querySelector("[data-whint]").onclick = () => room.setSettings(st => st.hint = !st.hint);
  }
  renderCatGrid($("wCats"), s.settings.cats, isHost ? id => room.setSettings(st => st.cats = st.cats.includes(id) ? st.cats.filter(x => x !== id) : [...st.cats, id]) : null);
  $("wStart").disabled = online.length < 3 || !s.settings.cats.length;
  $("wStart").textContent = online.length < 3 ? "في انتظار اللاعبين… (3 على الأقل)" : !s.settings.cats.length ? "اختار فئة وحدة على الأقل" : `ابدأ الجولة مع ${online.length} لاعبين ▶`;
}
function renderRound(s){
  const r = s.round;
  // جولة جديدة: نرجع البطاقة مقلوبة
  if(shownRound !== r.no){
    shownRound = r.no; seenSent = 0;
    $("wFlip").innerHTML = cardHTML(); $("wFlip").classList.remove("open");
    $("peekPop").classList.add("hidden");
    $("wSpin").textContent = ""; $("wRule").classList.add("hidden");
    if(s.phase === "card") vibe([20, 30, 20]);
  }
  fillCard($("wFlip"), { ...r.me, againText: "سيّب صبعك باش تخبّيها" });
  // كلمتي تبقى متاحة طول الجولة (ضغط مطوّل)
  $("peekCat").textContent = "الفئة: " + (r.me.isImp && !r.me.hint ? "؟" : r.me.catName);
  $("peekWord").textContent = r.me.isImp ? "أنت المحتال 🤫" : r.me.word;
  $("wSeen").textContent = `👀 شافو كلمتهم: ${r.seen} / ${r.count}`;
  $("wFirst").textContent = r.seen >= r.count ? "الكل شاف! شكون يبدأ؟ 🎲" : `شكون يبدأ؟ 🎲 (${r.seen}/${r.count} شافو)`;

  if(s.phase === "first" || s.phase === "reveal"){
    if(spunRound !== r.no){
      spunRound = r.no;
      if(s.phase === "first"){
        // الأزرار تبان كي يحبس الدوران
        $("v-first").classList.add("spinning");
        spinTo($("wSpin"), r.names, r.firstIdx, () => {
          $("wRule").classList.remove("hidden");
          setTimeout(() => $("v-first").classList.remove("spinning"), 400);
        });
      }
    }
    if(s.phase === "reveal" || spunRound === r.no && $("wSpin").textContent.startsWith("🎤")){
      $("wSpin").textContent = "🎤 " + r.names[r.firstIdx]; $("wRule").classList.remove("hidden");
    }
  }
  // تعادل في التصويت: نكملو الأسئلة
  const tieBox = $("wTie");
  if(s.phase === "first" && r.tie){
    tieBox.classList.remove("hidden");
    if(tieBox.dataset.no !== String(r.tie.no)){
      tieBox.dataset.no = r.tie.no;
      const parts = r.names.map((n, i) => ({ n, c: r.tie.counts[i] })).filter(x => x.c > 0).sort((a, b) => b.c - a.c);
      tieBox.innerHTML = `⚖️ تعادل! كمّلو الأسئلة وعاودو صوّتو<div class="tl">${parts.length ? parts.map(x => esc(x.n) + ": " + x.c).join(" • ") : "حتى واحد ما صوّت"}</div>`;
      vibe([30, 50, 30]);
    }
  } else tieBox.classList.add("hidden");
  $("wVote").textContent = r.tie ? "🗳️ عاودو التصويت" : "🗳️ تصويت: شكون المحتال؟";

  if(s.phase === "vote" && r.vote) renderVote(r);

  if(s.phase === "reveal" && r.reveal){
    const box = $("wRevealBox");
    if(box.dataset.no !== String(r.no)){
      box.dataset.no = r.no;
      const res = r.reveal.result;
      let head = "";
      if(res){
        const crewWon = res.winner === "players";
        const iWon = r.me.isImp ? !crewWon : crewWon;
        head = `<div class="winner ${crewWon ? "good" : "bad"} pop">${crewWon ? "🎉 فاز اللاعبين! المحتال انكشف" : "😈 فاز المحتال!"}</div>
          <div class="mine pop" style="animation-delay:.1s">${iWon ? "✅ ربحت!" : "❌ خسرت"}${!r.me.isImp && res.myVoteIdx >= 0 ? (r.reveal.impIdx.includes(res.myVoteIdx) ? " — صوتك كان صحيح" : " — صوتك كان غالط") : ""}</div>`;
      }
      let tally = "";
      if(res){
        const rows = r.names.map((n, i) => ({ n, c: res.counts[i], imp: r.reveal.impIdx.includes(i) })).sort((a, b) => b.c - a.c);
        tally = `<div class="tally pop" style="animation-delay:.5s">${rows.map(x => `<div class="${x.imp ? "imp" : ""}"><span>${x.imp ? "🎭 " : ""}${esc(x.n)}</span><span>${x.c} 🗳️</span></div>`).join("")}</div>`;
      }
      box.innerHTML = head + revealHTML(r.reveal.imps, r.reveal.word) + tally +
        `<div class="small">${r.me.isImp ? "كنت أنت المحتال! 😈" : "الكلمة تاعك كانت: " + esc(r.me.word)}</div>`;
      if(!res || (res.winner === "players") !== !!r.me.isImp) confetti();
      vibe([40, 60, 40]);
    }
  }
}
// أونلاين: اضغط مطوّل على البطاقة باش تشوف كلمتك
holdToShow($("wFlip"), () => {
  $("wFlip").classList.add("open");
  if(seenSent !== shownRound && lastState && lastState.round){
    seenSent = shownRound;
    if(isHost) room.onServer({ t: "msg", from: myId, d: { a: "seen" } });
    else net && net.send({ d: { a: "seen" } });
  }
}, () => $("wFlip").classList.remove("open"));
// بعد البطاقة (النقاش والتصويت): زر "كلمتي" بالضغط المطوّل باش ما تنساهاش
document.querySelectorAll("[data-peek]").forEach(b => holdToShow(b,
  () => { b.classList.add("holding"); $("peekPop").classList.remove("hidden"); },
  () => { b.classList.remove("holding"); $("peekPop").classList.add("hidden"); }));
$("wStart").onclick = () => room && room.start();
$("wFirst").onclick = async () => {
  if(!room) return;
  const r = room.round;
  if(r.seen.length < r.ids.length && !await ask(`مازال ${r.ids.length - r.seen.length} ما شافوش كلمتهم. نكملو؟`)) return;
  room.pickFirst();
};
$("wReveal").onclick = async () => { if(room && await ask("متأكدين؟ رايح يبان المحتال والكلمة عند الكل.")) room.reveal(); };

// ----- شاشة التصويت -----
let votePick = -1, voteShownNo = 0;
function renderVote(r){
  const v = r.vote;
  if(voteShownNo !== v.no){ voteShownNo = v.no; votePick = -1; $("wVoteList").dataset.key = ""; vibe([20, 40, 20]); }
  const locked = v.myVote >= 0;
  const max = Math.max(1, ...v.counts);
  const top = Math.max(...v.counts);
  const list = $("wVoteList");
  const key = r.names.join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = r.names.map((n, i) => `<button class="vopt ${i === v.myIdx ? "me" : ""}" data-i="${i}" style="animation-delay:${i * 0.05}s">
      <span class="bar"></span><span class="av" style="background:${avColor(n + i)}">${esc(n.trim()[0] || "؟")}</span>
      <span class="n">${esc(n)}${i === v.myIdx ? " (أنت)" : ""}</span><span class="vc">0</span></button>`).join("");
    list.querySelectorAll(".vopt").forEach(b => b.onclick = () => {
      if(lastState.round.vote.myVote >= 0) return;
      votePick = +b.dataset.i; vibe(10); renderVote(lastState.round);
    });
  }
  list.classList.toggle("locked", locked);
  list.querySelectorAll(".vopt").forEach(b => {
    const i = +b.dataset.i, c = v.counts[i], vc = b.querySelector(".vc");
    if(vc.textContent !== String(c)){ vc.textContent = c; vc.classList.remove("bump"); void vc.offsetWidth; vc.classList.add("bump"); }
    b.querySelector(".bar").style.width = (c / max * 100) + "%";
    b.classList.toggle("sel", locked ? i === v.myVote : i === votePick);
    b.classList.toggle("top", c > 0 && c === top);
  });
  $("wVoted").textContent = `🗳️ صوّتو: ${v.voted} / ${v.total}`;
  $("wVoteInfo").textContent = locked ? `✔ صوّتت على ${r.names[v.myVote]} — نستناو الباقي…` : "اختار اللاعب اللي تشك فيه، ومن بعد أكّد صوتك";
  $("wVoteOk").disabled = locked || votePick < 0;
  $("wVoteOk").textContent = locked ? "✔ تم التصويت" : votePick >= 0 ? `تأكيد: ${r.names[votePick]} ✔` : "اختار لاعب باش تصوّت";
}
$("wVoteOk").onclick = async () => {
  const r = lastState && lastState.round;
  if(!r || !r.vote || votePick < 0 || r.vote.myVote >= 0) return;
  if(!await ask(`تأكّد صوتك على ${r.names[votePick]}؟ ما تقدرش تبدلو من بعد.`)) return;
  const msg = { a: "vote", target: votePick, no: r.vote.no };
  if(isHost) room.castVote(myId, msg.target, msg.no);
  else net && net.send({ d: msg });
  vibe(30);
};
$("wVote").onclick = () => room && room.startVote();
$("wCode").onclick = copyCode;
$("wCopyCode").onclick = copyCode;
$("wInvite").onclick = sendInvite;
$("wVoteEnd").onclick = async () => { if(room && await ask("تختم التصويت بالأصوات اللي كاينة؟")) room.finishVote(); };
$("wAgain").onclick = () => room && room.start();
$("wLobby").onclick = () => room && room.toLobby();
document.querySelector('[data-allcats="wifi"]').onclick = () => room && room.setSettings(st => st.cats = st.cats.length === CATS.length ? [] : CATS.map(c => c.id));

// ============================================================
//   تعديل الكلمات
// ============================================================
let editCat = null;
function saveEdits(){
  for(const k in wordEdits) if(!wordEdits[k].added.length && !wordEdits[k].removed.length) delete wordEdits[k];
  store.set("wordEdits", wordEdits); applyEdits();
}
function renderWordCats(){
  $("wcats").innerHTML = CATS.map(c => {
    const e = wordEdits[c.id];
    const tag = e ? `<span class="ed">${e.added.length ? "+" + e.added.length : ""}${e.added.length && e.removed.length ? " / " : ""}${e.removed.length ? "−" + e.removed.length : ""}</span>` : "";
    return `<button class="wcat" data-id="${c.id}"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}</span>${tag}<span class="ct">${c.list.length} كلمة</span></button>`;
  }).join("");
  $("wcats").querySelectorAll(".wcat").forEach(b => b.onclick = () => openWordCat(b.dataset.id));
}
// الكلمات المحددة للحذف
const picked = new Set();
function openWordCat(id){
  editCat = catById(id);
  picked.clear();
  $("wcTitle").textContent = editCat.icon + " " + editCat.name;
  $("wcNew").value = ""; $("wcSearch").value = "";
  renderWordList(); show("s-words-cat");
}
function visibleWords(){
  const q = $("wcSearch").value.trim();
  return editCat.list.filter(w => !q || w.includes(q));
}
function renderWordList(){
  const c = editCat, e = wordEdits[c.id] || { added: [], removed: [] };
  const words = visibleWords();
  for(const w of [...picked]) if(!c.list.includes(w)) picked.delete(w);
  $("wcCount").textContent = c.list.length;
  $("wcList").innerHTML = words.length ? words.map(w => `<div class="wrow ${picked.has(w) ? "sel" : ""}" data-w="${esc(w)}"><span class="ck"></span><span class="w">${esc(w)}</span>${e.added.includes(w) ? `<span class="new">جديدة</span>` : ""}</div>`).join("")
    : `<div class="small" style="text-align:center;padding:16px">${$("wcSearch").value.trim() ? "ما لقينا حتى كلمة" : "الفئة فارغة — زيد كلمات!"}</div>`;
  $("wcList").querySelectorAll(".wrow").forEach(row => row.onclick = () => {
    const w = row.dataset.w;
    if(picked.has(w)) picked.delete(w); else picked.add(w);
    row.classList.toggle("sel", picked.has(w)); vibe(8); updateSelBar();
  });
  $("wcReset").classList.toggle("hidden", !wordEdits[c.id]);
  updateSelBar();
}
function updateSelBar(){
  const words = visibleWords();
  const allOn = words.length > 0 && words.every(w => picked.has(w));
  $("wcSelAll").textContent = allOn ? "✖️ إلغاء التحديد" : "☑️ تحديد الكل";
  $("wcSelInfo").textContent = picked.size ? `محددين: ${picked.size}` : "اضغط على الكلمات باش تحددهم";
  $("wcDel").classList.toggle("hidden", !picked.size);
  $("wcDel").textContent = `🗑️ نحّي المحددين (${picked.size})`;
}
$("wcSelAll").onclick = () => {
  const words = visibleWords();
  const allOn = words.length > 0 && words.every(w => picked.has(w));
  words.forEach(w => allOn ? picked.delete(w) : picked.add(w));
  vibe(12); renderWordList();
};
$("wcDel").onclick = async () => {
  const n = picked.size; if(!n) return;
  if(!await ask(`تنحّي ${n} ${n === 1 ? "كلمة" : "كلمات"} من "${editCat.name}"؟`)) return;
  const ed = catEdits(editCat.id);
  for(const w of picked){
    if(ed.added.includes(w)) ed.added = ed.added.filter(x => x !== w);
    else if(!ed.removed.includes(w)) ed.removed.push(w);
  }
  picked.clear(); saveEdits(); renderWordList();
  toast(`🗑️ تنحّاو ${n} ${n === 1 ? "كلمة" : "كلمات"}`); vibe(20);
};
// يزيد كلمة لفئة (يرجّع true إذا تزادت فعلاً)
function addToCat(catId, raw){
  const w = String(raw).trim().replace(/\s+/g, " ").slice(0, 30);
  const c = catById(catId); if(!w || !c) return false;
  if(c.list.includes(w)) return false;
  const ed = catEdits(catId);
  if(ed.removed.includes(w)) ed.removed = ed.removed.filter(x => x !== w);   // كانت أصلية ونحّيناها
  else ed.added.unshift(w);
  c.list.unshift(w);
  return true;
}
function addWord(){
  const w = $("wcNew").value.trim().replace(/\s+/g, " ");
  if(!w) return;
  if(!addToCat(editCat.id, w)){ toast("الكلمة موجودة ✔"); return; }
  saveEdits(); $("wcNew").value = ""; $("wcNew").focus();
  toast("✅ تزادت: " + w); vibe(15); renderWordList();
}

// ----- مشاركة الكلمات مع الصحاب -----
// الكود فيه غير الكلمات اللي زادها المستعمل (ماشي كلمات اللعبة الأصلية)
const CODE_RE = /#MOHTAL1#([A-Za-z0-9_\-]+)/;
function encodeWords(obj){
  const b = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeWords(text){
  const m = CODE_RE.exec(text || ""); if(!m) return null;
  try{
    let b = m[1].replace(/-/g, "+").replace(/_/g, "/"); while(b.length % 4) b += "=";
    const o = JSON.parse(decodeURIComponent(escape(atob(b))));
    return o && typeof o.c === "object" ? o : null;
  }catch(e){ return null; }
}
function shareText(obj, label){
  const total = Object.values(obj.c).reduce((s, a) => s + a.length, 0);
  return `شكون المحتال؟ ✏️ ${label} (${total} كلمة)\nافتح اللعبة ← تعديل الكلمات ← 📥 كلمات صاحبي، والصق هذا:\n#MOHTAL1#${encodeWords(obj)}`;
}
async function copyText(t){
  if(CLIP){ try{ await CLIP.write({ string: t }); return true; }catch(e){} }
  try{ await navigator.clipboard.writeText(t); return true; }catch(e){}
  try{ const ta = $("shText"); ta.focus(); ta.select(); return document.execCommand("copy"); }catch(e){ return false; }
}
let sheetAction = null;
function openSheet({ title, info, text, main, paste, onMain }){
  $("shTitle").textContent = title; $("shInfo").textContent = info;
  $("shText").value = text || ""; $("shText").readOnly = !paste;
  $("shText").placeholder = paste ? "الصق الكود تاع صاحبك هنا (ولا اكتب كلمات، كل كلمة في سطر)" : "";
  $("shMain").textContent = main; $("shPaste").classList.toggle("hidden", !paste);
  sheetAction = onMain;
  $("sheet").classList.remove("hidden");
}
function closeSheet(){ $("sheet").classList.add("hidden"); sheetAction = null; }
$("shClose").onclick = closeSheet;
$("shMain").onclick = () => sheetAction && sheetAction($("shText").value);
$("shPaste").onclick = async () => {
  try{ const t = await navigator.clipboard.readText(); if(t){ $("shText").value = t; return; } }catch(e){}
  $("shText").focus(); toast("اضغط مطوّل في المربع واختار لصق");
};
function openShare(obj, label){
  const total = Object.values(obj.c).reduce((s, a) => s + a.length, 0);
  if(!total){ toast("ما زدت حتى كلمة باش تشاركها ✏️"); return; }
  const text = shareText(obj, label);
  openSheet({ title: "📤 شارك كلماتك", info: `فيه ${total} كلمة زدتهم انت. انسخ وابعثو لصاحبك (واتساب، ميسنجر…)`, text, main: "📋 انسخ", paste: false,
    onMain: async t => { toast(await copyText(t) ? "✅ تنسخ! ابعثو لصاحبك" : "انسخ النص يدوياً"); } });
}
// intoCat: نزيدو كل الكلمات لفئة وحدة (من شاشة الفئة)، ولا كل كلمة لفئتها (من شاشة الفئات)
function importWords(text, intoCat){
  const obj = decodeWords(text);
  let lists;
  if(obj) lists = obj.c;
  else {
    // نص عادي: كل كلمة في سطر ولا بين فاصلات
    const words = String(text).split(/[\n,،]+/).map(s => s.trim()).filter(Boolean);
    if(!words.length){ toast("الصق الكود تاع صاحبك أولاً"); return 0; }
    if(!intoCat){ toast("هذا ماشي كود — ادخل لفئة والصق الكلمات فيها"); return 0; }
    lists = { [intoCat]: words };
  }
  let added = 0;
  for(const [cid, words] of Object.entries(lists)){
    const target = intoCat || cid;
    if(!catById(target) || !Array.isArray(words)) continue;
    for(const w of words) if(addToCat(target, w)) added++;
  }
  saveEdits();
  return added;
}
function openImport(intoCat){
  const where = intoCat ? `فئة "${catById(intoCat).name}"` : "الفئات تاعها";
  openSheet({ title: "📥 زيد كلمات صاحبك", info: `الكلمات تتزاد لـ ${where}. الكلمات اللي عندك من قبل ما تتعاودش.`, text: "", main: "➕ زيد الكلمات", paste: true,
    onMain: t => {
      const n = importWords(t, intoCat);
      if(n === 0 && (decodeWords(t) || t.trim())){ toast("كل الكلمات كانو عندك من قبل ✔"); return; }
      if(n > 0){ closeSheet(); toast(`✅ تزادو ${n} كلمات من صاحبك`); vibe([20, 40, 20]); intoCat ? renderWordList() : renderWordCats(); }
    } });
}
$("wcShare").onclick = () => {
  const ed = wordEdits[editCat.id];
  openShare({ v: 1, c: { [editCat.id]: ed ? ed.added.slice() : [] } }, "كلمات " + editCat.name);
};
$("wcImport").onclick = () => openImport(editCat.id);
$("shareAll").onclick = () => {
  const c = {}; for(const [id, ed] of Object.entries(wordEdits)) if(ed.added.length) c[id] = ed.added.slice();
  openShare({ v: 1, c }, "كل كلماتي");
};
$("importAll").onclick = () => openImport(null);
$("goWords").onclick = () => { renderWordCats(); show("s-words"); };
$("wordsBack").onclick = () => { renderWordCats(); show("s-words"); };
$("wcAdd").onclick = addWord;
$("wcNew").onkeydown = e => { if(e.key === "Enter") addWord(); };
$("wcSearch").oninput = renderWordList;
$("wordsBack").addEventListener("click", () => picked.clear());
$("wcReset").onclick = async () => {
  if(!await ask(`ترجّع الكلمات الأصلية تاع "${editCat.name}"؟ الكلمات اللي زدتها رايحين يتحاو.`)) return;
  delete wordEdits[editCat.id]; saveEdits(); renderWordList(); toast("↩️ رجعت الكلمات الأصلية");
};

// زر الرجوع في أندرويد
if(APP){
  APP.addListener("backButton", () => {
    if(!$("modal").classList.contains("hidden")){ $("mNo").click(); return; }
    if(!$("sheet").classList.contains("hidden")){ closeSheet(); return; }
    const on = document.querySelector(".screen.on");
    if(!on || on.id === "s-home") APP.exitApp();
    else if(on.id === "s-w-find") document.querySelector("[data-wback]").click();
    else if(on.id === "s-words-cat") $("wordsBack").click();
    else if(on.id === "s-w-room") $("wLeave").click();
    else if(on.id.startsWith("s-pass") && on.id !== "s-pass-setup") document.querySelector("[data-quit-pass]").click();
    else show("s-home");
  });
}

// الموقع يخدم بلا إنترنت بعد أول زيارة
if(!NATIVE && location.protocol === "https:" && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

boot();
