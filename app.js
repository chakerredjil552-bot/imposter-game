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
// صور البروفايل: صورتي (في الهاتف) + صور اللاعبين في الغرفة
let myPfp = store.get("pfp", null);
const pfpCache = {};
function avatarHTML(id, name, extra){
  const img = pfpCache[id];
  return img ? `<span class="av has-img ${extra || ""}" style="background-image:url('${img}')"></span>`
    : `<span class="av ${extra || ""}" style="background:${avColor(id)}">${esc((name || "؟").trim()[0] || "؟")}</span>`;
}
function setAvatarEl(el, id, name){
  const img = id === myId ? myPfp : pfpCache[id];
  if(img){ el.textContent = ""; el.style.background = ""; el.style.backgroundImage = `url('${img}')`; el.classList.add("has-img"); }
  else { el.style.backgroundImage = ""; el.classList.remove("has-img"); el.style.background = avColor(id); el.textContent = (name || "؟").trim()[0] || "؟"; }
}
function refreshAvatars(){
  ["wPlayers", "wVoteList"].forEach(id => { const el = document.getElementById(id); if(el) el.dataset.key = ""; });
  if(typeof UNO !== "undefined" && UNO.state) return UNO.render(true);
  if(typeof SJ !== "undefined" && SJ.state) return SJ.render(true);
  if(lastState) onState(lastState);
}
const AV_COLORS = ["#ffcf3f","#3fe0a5","#ff8da0","#9d8bff","#6fd3ff","#ffa95c","#c6f26b","#f39cff"];
function avColor(id){ let h = 0; for(const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }

// ---------- الكلمات ----------
const CATS = RAW_CATEGORIES.map(c => ({ id: c.id, icon: c.icon, name: c.name.replace(" 🇩🇿", ""),
  base: [...new Set(c.words.split("\n").map(s => s.trim()).filter(Boolean))], list: [] }));
const catById = id => CATS.find(c => c.id === id);
// التعريفات الأصلية لكل كلمة
for(const c of CATS){
  c.defs = {};
  for(const line of String((typeof RAW_DEFS !== "undefined" && RAW_DEFS[c.id]) || "").split("\n")){
    const i = line.indexOf("="); if(i > 0) c.defs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
// تعديلات المستعمل: كلمات زادها وكلمات نحّاها + تعريفاتو (تتسجل في الهاتف)
let wordEdits = store.get("wordEdits", {});
function catEdits(id){
  const e = wordEdits[id] || (wordEdits[id] = { added: [], removed: [] });
  if(!e.defs) e.defs = {};
  return e;
}
// تعريف الكلمة: تعريف المستعمل أولاً، ومن بعد الأصلي
function getDef(catId, word){
  const e = wordEdits[catId], c = catById(catId);
  return (e && e.defs && e.defs[word]) || (c && c.defs[word]) || "";
}

// ----- صور الكلمات (تتسجل في الهاتف فقط) -----
const photoDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("mohtal", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("photos");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("photos", mode); const q = fn(t.objectStore("photos")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return {
    get: k => tx("readonly", s => s.get(k)).catch(() => null),
    set: (k, v) => tx("readwrite", s => s.put(v, k)).catch(() => null),
    del: k => tx("readwrite", s => s.delete(k)).catch(() => null),
    keys: () => tx("readonly", s => s.getAllKeys()).catch(() => [])
  };
})();
const photoKey = (catId, word) => catId + "|" + word;
let photoIndex = new Set();   // الكلمات اللي عندها صورة (باش نبينو 📷 بلا ما نقراو الصور)
photoDB.keys().then(ks => { photoIndex = new Set(ks || []); });
// صور مدمجة في اللعبة للجميع (photos.js — نعمروها من بيانات المستعمل لاحقاً)
const BUILTIN = (typeof BUILTIN_PHOTOS !== "undefined" && BUILTIN_PHOTOS) || {};
async function getPhoto(catId, word){
  const k = photoKey(catId, word);
  return (photoIndex.has(k) && await photoDB.get(k)) || BUILTIN[k] || null;
}
const hasPhoto = (catId, word) => photoIndex.has(photoKey(catId, word)) || !!BUILTIN[photoKey(catId, word)];
async function savePhoto(catId, word, data){
  const k = photoKey(catId, word);
  await photoDB.set(k, data); photoIndex.add(k);
}
async function deletePhoto(catId, word){
  const k = photoKey(catId, word);
  await photoDB.del(k); photoIndex.delete(k);
}
// وسط اللعب: نزيدو صورة مرة وحدة (التبديل من تعديل الكلمات برك)
async function addPhotoMidGame(catId, word){
  if(hasPhoto(catId, word)){ toast("الكلمة عندها صورة — بدّلها من ✏️ تعديل الكلمات"); return null; }
  const img = await pickImage(480);
  if(!img) return null;
  await savePhoto(catId, word, img);
  toast("✅ تزادت الصورة — باش تبدلها روح لتعديل الكلمات"); vibe(20);
  return img;
}
// تصغير الصورة قبل ما نسجلوها
function pickImage(maxSide, square){
  return new Promise(res => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if(!f){ res(null); return; }
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => {
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if(square){ const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
        const k = Math.min(1, maxSide / Math.max(sw, sh));
        const cv = document.createElement("canvas");
        cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    };
    inp.click();
  });
}
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
function cardHTML(){ return `<div class="in"><div class="face front"><div class="q">؟</div><div class="tap">اضغط مطوّل باش تشوف كلمتك 👆</div></div><div class="face back"><div class="cat-l"></div><img class="wphoto hidden" alt=""><div class="word"></div><div class="def hidden"></div><div class="hint"></div><div class="again">سيّب صبعك باش تخبّيها</div></div></div>`; }

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
// التعريف والصورة ما يبانوش أبداً للمحتال
function fillCard(el, {isImp, word, catName, hint, againText, def, photo}){
  if(!el.firstChild) el.innerHTML = cardHTML();
  el.querySelector(".cat-l").textContent = "الفئة: " + (isImp && !hint ? "؟" : catName);
  el.querySelector(".word").textContent = isImp ? "أنت المحتال 🤫" : word;
  const d = el.querySelector(".def");
  d.textContent = !isImp && def ? def : "";
  d.classList.toggle("hidden", isImp || !def);
  const im = el.querySelector(".wphoto");
  if(!isImp && photo){ if(im.src !== photo) im.src = photo; im.classList.remove("hidden"); }
  else { im.removeAttribute("src"); im.classList.add("hidden"); }
  el.classList.toggle("has-photo", !isImp && !!photo);
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
    show("s-splash"); await wait(1400);
    ensureProfile(() => { openWifi(); $("wJoin").click(); });
    return;
  }
  if(!store.get("onboarded", false)){
    show("s-perm");
    $("btnPerm").onclick = async () => {
      $("btnPerm").disabled = true;
      try{ if(LN) await LN.requestPerms(); }catch(e){}
      store.set("onboarded", true);
      ensureProfile(splash);
    };
  } else ensureProfile(splash);
}

// ----- الملف الشخصي: الاسم واللقب (مرة وحدة، ومن بعد يتبدل من القائمة) -----
let profile = store.get("profile", null);
const hasProfile = () => !!(profile && profile.name && profile.nick);
let profileAfter = null;
function showProfile(first, after){
  profileAfter = after || null;
  $("pfName").value = profile ? profile.name : "";
  $("pfNick").value = profile ? profile.nick : "";
  $("pfTitle").textContent = first ? "عرّفنا بيك 👋" : "✏️ بدّل اسمك";
  $("pfSave").textContent = first ? "يلا نبداو ✔" : "حفظ ✔";
  $("pfBack").classList.toggle("hidden", first);
  pendingPfp = myPfp;
  // إحصائياتي (تبان كي يبدّل ملفو)
  const st = getStats();
  $("pfStats").classList.toggle("hidden", first);
  $("pfGames").textContent = st.games; $("pfRight").textContent = st.right;
  $("pfImp").textContent = st.imp; $("pfCrew").textContent = st.crew;
  $("pfLoss").textContent = Math.max(0, st.games - st.imp - st.crew);
  $("pfRate").textContent = st.games ? Math.round((st.imp + st.crew) / st.games * 100) + "%" : "—";
  updateNickPreview();
  show("s-profile");
}
let pendingPfp = null;
$("pfPick").onclick = async () => {
  const img = await pickImage(160, true);
  if(img){ pendingPfp = img; updateNickPreview(); vibe(15); }
};
$("pfRemove").onclick = () => { pendingPfp = null; updateNickPreview(); };
function ensureProfile(next){ if(hasProfile()) next(); else showProfile(true, next); }
function updateNickPreview(){
  const n = $("pfNick").value.trim();
  $("pfPreview").textContent = (n || "لقبك") + (n ? "" : "");
  const av = $("pfAv");
  if(pendingPfp){ av.textContent = ""; av.style.background = ""; av.style.backgroundImage = `url('${pendingPfp}')`; av.classList.add("has-img"); }
  else { av.style.backgroundImage = ""; av.classList.remove("has-img"); av.style.background = avColor(myId); av.textContent = (n || $("pfName").value.trim() || "؟")[0]; }
  $("pfRemove").classList.toggle("hidden", !pendingPfp);
}
$("pfNick").oninput = updateNickPreview;
$("pfName").oninput = updateNickPreview;
$("pfSave").onclick = () => {
  const name = $("pfName").value.trim().replace(/\s+/g, " ");
  const nick = $("pfNick").value.trim().replace(/\s+/g, " ");
  if(name.length < 2){ toast("اكتب اسمك ✍️"); $("pfName").focus(); return; }
  if(nick.length < 2){ toast("اختار لقب باش يعرفوك صحابك 😎"); $("pfNick").focus(); return; }
  profile = { name, nick };
  store.set("profile", profile); store.set("myName", nick);
  myPfp = pendingPfp || null; store.set("pfp", myPfp);
  renderHomeProfile(); vibe(20);
  const next = profileAfter; profileAfter = null;
  if(next) next(); else { toast("✅ تسجل"); show("s-games"); }
};
$("pfBack").onclick = () => show("s-games");
function renderHomeProfile(){
  if(!hasProfile()) return;
  $("homeNick").textContent = profile.nick;
  setAvatarEl($("homeAv"), myId, profile.nick);
}
$("homeProfile").onclick = () => showProfile(false);
async function splash(){
  show("s-splash");
  await wait(1900);
  if(!$("s-splash").classList.contains("on")) return;
  if(pendingJoin) goPendingJoin(); else show("s-games");
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
  ensureProfile(() => { openWifi(); $("wJoin").click(); });
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
// ----- اختيار اللعبة -----
let currentGame = "mohtal";
document.querySelectorAll("[data-games]").forEach(b => b.onclick = () => show("s-games"));
document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => {
  vibe(12);
  const g = b.dataset.game;
  ensureProfile(() => {
    currentGame = g;
    if(g === "mohtal") show("s-home");
    else if(g === "uno") UNO.openStart();
    else if(g === "sj") SJ.openStart();
  });
});
function gameHome(){ return currentGame === "uno" ? "s-uno-start" : currentGame === "sj" ? "s-sj-start" : "s-w-name"; }
$("goPass").onclick = () => { renderPassSetup(); show("s-pass-setup"); };
function openWifi(){
  if(!hasProfile()){ showProfile(true, openWifi); return; }
  $("wName").value = profile.nick;
  $("wHello").textContent = profile.nick;
  $("wHost").classList.toggle("hidden", !CAN_LEAD);
  $("wWebNote").classList.toggle("hidden", CAN_LEAD);
  $("wJoin").className = CAN_LEAD ? "btn ghost" : "btn";
  $("wJoin").textContent = HOSTED || pendingJoin ? "🚪 ادخل للغرفة" : "🔎 انضمام لغرفة";
  show("s-w-name");
}
$("goWifi").onclick = openWifi;
$("wEditName").onclick = () => showProfile(false, openWifi);

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
    <button class="toggle ${s.hint ? "on" : ""}" ${editable ? "" : "disabled"} data-${prefix}hint></button></div>
    <div class="row set-row"><div><div class="label">إظهار التعريف والصورة</div><div class="small">للاعبين برك — المحتال ما يشوفهمش</div></div>
    <button class="toggle ${s.showDef !== false ? "on" : ""}" ${editable ? "" : "disabled"} data-${prefix}def></button></div>`;
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
  $("pSettings").querySelector("[data-pdef]").onclick = () => { pcfg.showDef = pcfg.showDef === false; renderPassSetup(); };
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
  pgame = { cat, word, players, imps: shuffle(players.map((_, i) => i)).slice(0, pcfg.imps), turn: 0,
    def: pcfg.showDef === false ? "" : getDef(cat.id, word), photo: null };
  $("passCat").textContent = catsLabel(pcfg.cats);
  $("pFlip").innerHTML = cardHTML();
  passTurn(); show("s-pass");
  // الصورة من الهاتف (إذا كاينة)
  if(pcfg.showDef !== false) getPhoto(cat.id, word).then(p => { if(pgame && pgame.word === word){ pgame.photo = p; passTurn(true); } });
}
function passTurn(onlyCard){
  const i = pgame.turn, isImp = pgame.imps.includes(i);
  fillCard($("pFlip"), { isImp, word: pgame.word, catName: pgame.cat.name, hint: pcfg.hint, againText: "سيّب صبعك باش تخبّيها", def: pgame.def, photo: pgame.photo });
  if(onlyCard) return;
  $("passName").textContent = pgame.players[i];
  $("passHint").textContent = i === 0 ? "الهاتف عند" : "مرّر الهاتف إلى";
  $("dots").innerHTML = pgame.players.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("");
  $("pFlip").classList.remove("open");
  $("pNext").classList.add("hidden");
  $("pAddPhoto").classList.add("hidden");
  $("pNext").textContent = i === pgame.players.length - 1 ? "فهمت، خبّي ✔" : "فهمت، خبّي ومرّر ⬅";
}
$("pStart").onclick = passStart;
// هاتف واحد: اضغط مطوّل باش تشوف، وكي تسيّب يبان زر "مرّر"
holdToShow($("pFlip"),
  () => $("pFlip").classList.add("open"),
  () => {
    $("pFlip").classList.remove("open"); $("pNext").classList.remove("hidden");
    // زيد صورة للكلمة وسط اللعب (غير للي ماشي محتال، وغير إذا ما عندهاش صورة)
    const canAdd = pgame && !pgame.imps.includes(pgame.turn) && !pgame.photo;
    $("pAddPhoto").classList.toggle("hidden", !canAdd);
  });
$("pAddPhoto").onclick = async () => {
  if(!pgame || pgame.photo || pgame.imps.includes(pgame.turn)) return;
  const img = await addPhotoMidGame(pgame.cat.id, pgame.word);
  if(img){ pgame.photo = pcfg.showDef === false ? null : img; passTurn(true); $("pAddPhoto").classList.add("hidden"); }
};
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

// ----- إحصائيات اللاعب (أونلاين فقط، بعد التصويت) -----
// imp: ربح كمحتال • crew: ربح كبريء • right: خمّن المحتال صح • games: جولات بالتصويت
function cleanStats(s){
  s = s || {};
  const n = v => Math.max(0, Math.min(99999, Math.floor(+v || 0)));
  return { imp: n(s.imp), crew: n(s.crew), right: n(s.right), games: n(s.games) };
}
function getStats(){ return cleanStats(store.get("stats", null)); }
function sendMe(){
  const msg = { a: "me", full: profile ? profile.name : "", stats: getStats() };
  if(isHost && room){ const p = room.player(myId); if(p){ p.full = msg.full; p.stats = msg.stats; room.sync(); } }
  else if(net) net.send({ d: msg });
}
// نحسبو نتيجة الجولة مرة وحدة برك
function countRound(s){
  const r = s.round;
  if(!r || !r.me || !r.reveal || !r.reveal.result) return;
  const key = s.sid + ":" + r.no;
  const done = store.get("counted", []);
  if(done.includes(key)) return;
  done.push(key); store.set("counted", done.slice(-60));
  const st = getStats(), res = r.reveal.result;
  st.games++;
  if(r.me.isImp && res.winner === "imposter") st.imp++;
  if(!r.me.isImp && res.winner === "players") st.crew++;
  if(!r.me.isImp && res.myVoteIdx >= 0 && r.reveal.impIdx.includes(res.myVoteIdx)) st.right++;
  store.set("stats", st);
  sendMe();
}
function statLine(st){
  st = cleanStats(st);
  return `<span class="sl" title="ربح كمحتال">😈 ${st.imp}</span><span class="sl" title="ربح كبريء">😇 ${st.crew}</span><span class="sl" title="خمّن صح">🎯 ${st.right}</span>`;
}
// بطاقة اللاعب
function showPlayerCard(p){
  if(!p) return;
  const st = cleanStats(p.stats);
  setAvatarEl($("pcAv"), p.id, p.name);
  $("pcRate").textContent = st.games ? `🏆 نسبة الربح: ${Math.round((st.imp + st.crew) / st.games * 100)}%` : "";
  $("pcNick").textContent = p.name + (p.host ? " 👑" : "");
  $("pcName").textContent = p.full ? "الاسم: " + p.full : "";
  $("pcImp").textContent = st.imp; $("pcCrew").textContent = st.crew; $("pcRight").textContent = st.right;
  $("pcGames").textContent = st.games ? `لعب ${st.games} جولات بالتصويت` : "ما زال ما لعب حتى جولة بالتصويت";
  $("pcard").classList.remove("hidden"); vibe(10);
}
function closePlayerCard(){ $("pcard").classList.add("hidden"); }
// رابط الدعوة: يفتح التطبيق في الغرفة، ولا المتصفح
function inviteLink(st){
  const s = st || lastState; if(!s || !s.ips.length) return null;
  const host = s.players.find(p => p.host);
  return `${SITE}join.html?r=${encodeURIComponent(s.ips[0])}${httpPort !== HTTP_PORT ? "&h=" + httpPort : ""}&n=${encodeURIComponent(host ? host.name : "")}`;
}
async function copyCode(st){
  const s = (st && st.ips) ? st : lastState; if(!s || !s.ips.length) return;
  toast(await copyText(s.ips[0]) ? "📋 تنسخ الرمز: " + s.ips[0] : "ما قدرناش ننسخو");
  vibe(15);
}
async function sendInvite(st, gameTitle){
  const s = (st && st.ips) ? st : lastState;
  const link = inviteLink(s); if(!link){ toast("شعّل الواي فاي ولا نقطة الاتصال أولاً"); return; }
  const code = s.ips[0];
  const text = `تعال نلعبو ${gameTitle || "شكون المحتال؟ 🕵️"}\nادخل للغرفة من هنا 👇\n${link}\n\nولا اكتب رمز الغرفة: ${code}\n(لازم تكون في نفس الواي فاي)`;
  if(SHARE){
    try{ await SHARE.share({ title: "شكون المحتال؟", text, dialogTitle: "ابعث الدعوة لصحابك" }); return; }catch(e){ if(String(e && e.message).match(/cancel/i)) return; }
  } else if(navigator.share){
    try{ await navigator.share({ title: "شكون المحتال؟", text }); return; }catch(e){ if(e && e.name === "AbortError") return; }
  }
  toast(await copyText(text) ? "📋 تنسخت الدعوة — الصقها في أي محادثة" : "ما قدرناش ننسخو");
}

function myName(){ return ($("wName").value || "").trim(); }
function needName(){
  const n = hasProfile() ? profile.nick : myName();
  if(!n){ showProfile(true, openWifi); return null; }
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
    this.players = [{ id: myId, name, online: true, host: true, full: profile ? profile.name : "", stats: getStats() }];
    this.sid = uid();   // رقم الغرفة باش الجولات ما يتحسبوش مرتين
    this.settings = store.get("hostSettings", { imps: 1, hint: true, showDef: true, cats: CATS.map(c => c.id) });
    if(this.settings.showDef === undefined) this.settings.showDef = true;
    this.pfps = {};   // صور البروفايل تاع اللاعبين
    if(myPfp){ this.pfps[myId] = myPfp; pfpCache[myId] = myPfp; }
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
      // رجع ولا دخل جديد: نعاودو نبعثولو صورة الكلمة وصور البروفايل
      if(this.round && this.round.photoSent) this.round.photoSent.delete(m.id);
      setTimeout(() => this.sendAllPfps(m.id), 300);
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
      if(d.a === "me"){ p.full = String(d.full || "").slice(0, 20); p.stats = cleanStats(d.stats); this.sync(); }
      if(d.a === "pfp"){
        const ok = typeof d.data === "string" && d.data.startsWith("data:image/") && d.data.length < 80000;
        this.setPfp(p.id, ok ? d.data : null);
      }
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
    const show = this.settings.showDef !== false;
    this.round = { no: (this.round ? this.round.no : 0) + 1, ids, imps: shuffle(ids).slice(0, imps), word, cat: cat.id, seen: [], first: null,
      def: show ? getDef(cat.id, word) : "", photo: null, photoSent: new Set() };
    this.phase = "card";
    this.sync();
    // صورة الكلمة من هاتف القائد
    if(show){ const r = this.round; getPhoto(cat.id, word).then(p => { if(p && this.round === r){ r.photo = p; r.photoSent.clear(); this.sync(); } }); }
  }
  // القائد زاد صورة وسط اللعب: تبان عند الجميع
  setRoundPhoto(img){
    const r = this.round; if(!r || this.settings.showDef === false) return;
    r.photo = img; r.photoSent.clear(); this.sync();
  }
  // صور البروفايل: نبعثوهم مرة وحدة برك (ماشي مع كل تحديث)
  setPfp(id, data){
    if(data) this.pfps[id] = data; else delete this.pfps[id];
    for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "pfp", id, data: data || null } });
    pfpCache[id] = data || null; this.sync();
  }
  sendAllPfps(to){
    for(const [id, data] of Object.entries(this.pfps)) net.send({ to, d: { type: "pfp", id, data } });
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
      sid: this.sid,
      players: this.players.map(p => ({ id: p.id, name: p.name, online: p.online, host: !!p.host, full: p.full || "", stats: p.stats || cleanStats() })),
      settings: this.settings, maxImps: this.maxImps(),
      round: null
    };
    if(r && this.phase !== "lobby"){
      const cat = catById(r.cat);
      s.round = {
        no: r.no, inRound, count: r.ids.length, seen: r.seen.length, pids: r.ids.slice(),
        names: r.ids.map(id => (this.player(id) || {}).name || "؟"),
        firstIdx: r.first ? r.ids.indexOf(r.first) : -1,
        me: inRound ? (() => {
          const imp = r.imps.includes(pid);
          const me = { isImp: imp, word: imp ? null : r.word, catName: cat.name, catId: imp ? null : r.cat, hint: this.settings.hint,
            def: imp ? "" : (r.def || ""), hasPhoto: !imp && !!r.photo };
          // الصورة تتبعث مرة وحدة لكل لاعب (المحتال ما ياخذهاش)
          if(!imp && r.photo && !r.photoSent.has(pid)){ me.photo = r.photo; r.photoSent.add(pid); }
          return me;
        })() : null,
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
// يفتح سيرفر الغرفة على هاتف القائد ويرجع الرابط والعناوين (لكل الألعاب)
async function openRoomServer(name, label){
  let url, ips = [];
  if(LN){
    const r = await LN.startServer({ port: PORT, name: (label ? label + " " : "") + name });
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
  return { url, ips };
}
$("wHost").onclick = async () => {
  const name = needName(); if(!name) return;
  $("wHost").disabled = true;
  try{
    let url, ips = [];
    if(LN){
      const r = await LN.startServer({ port: PORT, name: "🕵️ " + name });
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
    if(m.t === "msg" && m.d && m.d.type === "state"){ gotState = true; currentGame = "mohtal"; onState(m.d.s); }
    else if(m.t === "msg" && m.d && m.d.type === "uno"){ gotState = true; currentGame = "uno"; UNO.onState(m.d.s); }
    else if(m.t === "msg" && m.d && m.d.type === "sj"){ gotState = true; currentGame = "sj"; SJ.onState(m.d.s); }
    else if(m.t === "msg" && m.d && m.d.type === "pfp"){ pfpCache[m.d.id] = m.d.data || null; if(lastState) refreshAvatars(); }
    else if(m.t === "kicked"){ leaveRoom(false); toast("القائد خرّجك من الغرفة 😅"); }
    else if(m.t === "hostgone"){ leaveRoom(false); toast("القائد سكّر الغرفة"); }
  }, st => {
    if(st === "dead" && !gotState){ leaveRoom(false); toast("ما قدرناش ندخلو للغرفة. تأكد أنكم في نفس الواي فاي"); show("s-w-find"); }
    else connStatus(st);
    // نبعثو الاسم والإحصائيات والصورة للقائد (حتى بعد إعادة الاتصال)
    if(st === "up"){ sendMe(); if(net) net.send({ d: { a: "pfp", data: myPfp || null } }); }
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
  if(room && room.destroy) room.destroy();
  isHost = false; room = null; lastState = null;
  if(typeof UNO !== "undefined") UNO.left();
  if(typeof SJ !== "undefined") SJ.left();
  keepAwake(false);
  show(gameHome());
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
  if(s.phase === "reveal") countRound(s);
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
  const key = isHost + "|" + s.players.map(p => p.id + p.online + p.name + JSON.stringify(p.stats) + (pfpCache[p.id] ? "i" : "")).join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = s.players.map(p => `<div class="pl ${p.online ? "" : "off"}" data-pid="${p.id}">
      ${avatarHTML(p.id, p.name)}
      <span class="n">${esc(p.name)}${p.id === myId ? " (أنت)" : ""}<span class="stats-mini">${statLine(p.stats)}</span></span>
      <span class="tag">${p.host ? "👑 القائد" : p.online ? "" : "غير متصل"}</span>
      ${isHost && !p.host ? `<button class="kick" data-kick="${p.id}">✕</button>` : ""}</div>`).join("");
    // اضغط على لاعب باش تشوف بطاقتو
    list.querySelectorAll(".pl").forEach(row => row.onclick = e => {
      if(e.target.closest("[data-kick]")) return;
      showPlayerCard(lastState.players.find(x => x.id === row.dataset.pid));
    });
    list.querySelectorAll("[data-kick]").forEach(b => b.onclick = async () => {
      const p = s.players.find(x => x.id === b.dataset.kick);
      if(p && await ask(`تخرّج ${p.name} من الغرفة؟`)) room.kick(p.id);
    });
  }
  $("wSettings").innerHTML = settingsHTML("w", s.settings, isHost);
  if(isHost){
    $("wSettings").querySelectorAll("[data-wimps]").forEach(b => b.onclick = () => room.setSettings(st => st.imps = Math.min(s.maxImps, Math.max(1, st.imps + +b.dataset.wimps))));
    $("wSettings").querySelector("[data-whint]").onclick = () => room.setSettings(st => st.hint = !st.hint);
    $("wSettings").querySelector("[data-wdef]").onclick = () => room.setSettings(st => st.showDef = st.showDef === false);
  }
  renderCatGrid($("wCats"), s.settings.cats, isHost ? id => room.setSettings(st => st.cats = st.cats.includes(id) ? st.cats.filter(x => x !== id) : [...st.cats, id]) : null);
  $("wStart").disabled = online.length < 3 || !s.settings.cats.length;
  $("wStart").textContent = online.length < 3 ? "في انتظار اللاعبين… (3 على الأقل)" : !s.settings.cats.length ? "اختار فئة وحدة على الأقل" : `ابدأ الجولة مع ${online.length} لاعبين ▶`;
}
function renderRound(s){
  const r = s.round;
  // جولة جديدة: نرجع البطاقة مقلوبة
  if(shownRound !== r.no){
    shownRound = r.no; seenSent = 0; roundPhoto = null; localPhoto = null;
    $("wFlip").innerHTML = cardHTML(); $("wFlip").classList.remove("open");
    $("peekPop").classList.add("hidden");
    $("wSpin").textContent = ""; $("wRule").classList.add("hidden");
    if(s.phase === "card") vibe([20, 30, 20]);
  }
  // صورة الكلمة من القائد (تجي مرة وحدة) ولا اللي زدتها انت
  if(r.me.photo) roundPhoto = r.me.photo;
  const photo = r.me.isImp ? null : (roundPhoto || localPhoto);
  fillCard($("wFlip"), { ...r.me, photo, againText: "سيّب صبعك باش تخبّيها" });
  // كلمتي تبقى متاحة طول الجولة (ضغط مطوّل)
  $("peekCat").textContent = "الفئة: " + (r.me.isImp && !r.me.hint ? "؟" : r.me.catName);
  $("peekWord").textContent = r.me.isImp ? "أنت المحتال 🤫" : r.me.word;
  $("peekDef").textContent = r.me.isImp ? "" : (r.me.def || "");
  $("peekDef").classList.toggle("hidden", r.me.isImp || !r.me.def);
  if(photo){ $("peekImg").src = photo; $("peekImg").classList.remove("hidden"); } else $("peekImg").classList.add("hidden");
  // زر "زيد صورة" وسط اللعب: غير للي ماشي محتال، وغير إذا الكلمة ما عندهاش صورة
  const canAdd = !r.me.isImp && !photo && !r.me.hasPhoto && s.settings.showDef !== false && (s.phase === "card" || s.phase === "first");
  document.querySelectorAll("[data-addphoto]").forEach(b => b.classList.toggle("hidden", !canAdd));
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

// زيد صورة للكلمة وسط اللعب (أونلاين)
let roundPhoto = null, localPhoto = null;
document.querySelectorAll("[data-addphoto]").forEach(b => b.onclick = async () => {
  const r = lastState && lastState.round;
  if(!r || !r.me || r.me.isImp || !r.me.catId) return;
  const img = await addPhotoMidGame(r.me.catId, r.me.word);
  if(!img) return;
  if(isHost && room) room.setRoundPhoto(img);       // القائد: تبان عند الجميع
  else { localPhoto = img; onState(lastState); }   // لاعب: تتسجل في هاتفو
});

// ----- شاشة التصويت -----
let votePick = -1, voteShownNo = 0;
function renderVote(r){
  const v = r.vote;
  if(voteShownNo !== v.no){ voteShownNo = v.no; votePick = -1; $("wVoteList").dataset.key = ""; vibe([20, 40, 20]); }
  const locked = v.myVote >= 0;
  const max = Math.max(1, ...v.counts);
  const top = Math.max(...v.counts);
  const list = $("wVoteList");
  const pl = i => lastState.players.find(p => p.id === (r.pids || [])[i]);
  const key = r.names.join("|") + "|" + (r.pids || []).map(id => JSON.stringify((lastState.players.find(p => p.id === id) || {}).stats) + (pfpCache[id] ? "i" : "")).join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = r.names.map((n, i) => { const p = pl(i); return `<button class="vopt ${i === v.myIdx ? "me" : ""}" data-i="${i}" style="animation-delay:${i * 0.05}s">
      <span class="bar"></span>${avatarHTML(p ? p.id : n + i, n)}
      <span class="n">${esc(n)}${i === v.myIdx ? " (أنت)" : ""}<span class="stats-mini">${statLine(p && p.stats)}</span></span>
      <span class="info" data-info="${i}" aria-label="بطاقة اللاعب">👤</span><span class="vc">0</span></button>`; }).join("");
    list.querySelectorAll(".vopt").forEach(b => b.onclick = e => {
      if(e.target.closest("[data-info]")){ e.stopPropagation(); showPlayerCard(pl(+b.dataset.i)); return; }
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
$("pcClose").onclick = closePlayerCard;
$("pcard").onclick = e => { if(e.target.id === "pcard") closePlayerCard(); };
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
  for(const k in wordEdits){
    const e = wordEdits[k];
    if(!e.added.length && !e.removed.length && !Object.keys(e.defs || {}).length) delete wordEdits[k];
  }
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
  $("wcList").innerHTML = words.length ? words.map(w => `<div class="wrow ${picked.has(w) ? "sel" : ""}" data-w="${esc(w)}"><span class="ck"></span>
      <span class="w">${esc(w)}<small>${esc(getDef(c.id, w) || "— بلا تعريف")}</small></span>
      ${hasPhoto(c.id, w) ? `<span class="ph">📷</span>` : ""}${(e.added || []).includes(w) ? `<span class="new">جديدة</span>` : ""}
      <button class="edit" data-edit="${esc(w)}" aria-label="تعديل">✏️</button></div>`).join("")
    : `<div class="small" style="text-align:center;padding:16px">${$("wcSearch").value.trim() ? "ما لقينا حتى كلمة" : "الفئة فارغة — زيد كلمات!"}</div>`;
  $("wcList").querySelectorAll(".wrow").forEach(row => row.onclick = ev => {
    if(ev.target.closest("[data-edit]")){ openWordSheet(row.dataset.w); return; }
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
    // الكلمة تتمسح مع تعريفها وصورتها
    delete ed.defs[w];
    if(photoIndex.has(photoKey(editCat.id, w))) deletePhoto(editCat.id, w);
  }
  picked.clear(); saveEdits(); renderWordList();
  toast(`🗑️ تنحّاو ${n} ${n === 1 ? "كلمة" : "كلمات"}`); vibe(20);
};
// يزيد كلمة لفئة (يرجّع true إذا تزادت فعلاً)
function addToCat(catId, raw, rawDef){
  const w = String(raw).trim().replace(/\s+/g, " ").slice(0, 30);
  const def = String(rawDef || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const c = catById(catId); if(!w || !c) return false;
  if(c.list.includes(w)) return false;
  const ed = catEdits(catId);
  if(ed.removed.includes(w)) ed.removed = ed.removed.filter(x => x !== w);   // كانت أصلية ونحّيناها
  else ed.added.unshift(w);
  if(def) ed.defs[w] = def;
  c.list.unshift(w);
  return true;
}
let newWordPhoto = null;
$("wcNewPhoto").onclick = async () => {
  const img = await pickImage(480); if(!img) return;
  newWordPhoto = img; $("wcNewPhotoPrev").src = img; $("wcNewPhotoPrev").classList.remove("hidden");
};
async function addWord(){
  const w = $("wcNew").value.trim().replace(/\s+/g, " ");
  const def = $("wcNewDef").value.trim().replace(/\s+/g, " ");
  if(!w){ toast("اكتب الكلمة ✍️"); $("wcNew").focus(); return; }
  if(def.length < 3){ toast("لازم تكتب تعريف للكلمة 📝"); $("wcNewDef").focus(); return; }
  if(!addToCat(editCat.id, w, def)){ toast("الكلمة موجودة ✔"); return; }
  if(newWordPhoto) await savePhoto(editCat.id, w, newWordPhoto);
  saveEdits();
  $("wcNew").value = ""; $("wcNewDef").value = ""; newWordPhoto = null; $("wcNewPhotoPrev").classList.add("hidden");
  $("wcNew").focus();
  toast("✅ تزادت: " + w); vibe(15); renderWordList();
}

// ----- تعديل كلمة: التعريف والصورة -----
let wsWord = null, wsPhotoNew = undefined;   // undefined = ما تبدلتش، null = تنحّات
async function openWordSheet(w){
  wsWord = w; wsPhotoNew = undefined;
  $("wsWord").textContent = w;
  $("wsDef").value = getDef(editCat.id, w);
  showWsPhoto(await getPhoto(editCat.id, w));
  $("wordSheet").classList.remove("hidden");
}
function showWsPhoto(p){
  $("wsPhoto").classList.toggle("hidden", !p); if(p) $("wsPhoto").src = p;
  $("wsNoPhoto").classList.toggle("hidden", !!p);
  $("wsDelPhoto").classList.toggle("hidden", !p);
  $("wsPick").textContent = p ? "📷 بدّل الصورة" : "📷 اختار صورة";
}
function closeWordSheet(){ $("wordSheet").classList.add("hidden"); wsWord = null; }
$("wsPick").onclick = async () => { const img = await pickImage(480); if(img){ wsPhotoNew = img; showWsPhoto(img); } };
$("wsDelPhoto").onclick = () => { wsPhotoNew = null; showWsPhoto(null); };
$("wsClose").onclick = closeWordSheet;
$("wsSave").onclick = async () => {
  const w = wsWord; if(!w) return;
  const def = $("wsDef").value.trim().replace(/\s+/g, " ").slice(0, 80);
  if(def.length < 3){ toast("لازم تعريف للكلمة 📝"); return; }
  const ed = catEdits(editCat.id), base = editCat.defs[w];
  if(def === base) delete ed.defs[w]; else ed.defs[w] = def;
  if(wsPhotoNew === null) await deletePhoto(editCat.id, w);
  else if(wsPhotoNew) await savePhoto(editCat.id, w, wsPhotoNew);
  saveEdits(); closeWordSheet(); renderWordList(); toast("✅ تسجل"); vibe(15);
};

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
  $("shText").placeholder = paste ? "الصق الكود تاع صاحبك هنا\nولا اكتب: كلمة = تعريف (كل كلمة في سطر)" : "";
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
  let lists, skipped = 0;
  if(obj) lists = obj.c;
  else {
    // نص عادي: كل سطر "كلمة = تعريف" (ولا كلمة: تعريف)
    const lines = String(text).split(/\n+/).map(s => s.trim()).filter(Boolean);
    if(!lines.length){ toast("الصق الكود تاع صاحبك أولاً"); return 0; }
    if(!intoCat){ toast("هذا ماشي كود — ادخل لفئة والصق الكلمات فيها"); return 0; }
    const pairs = [];
    for(const l of lines){
      const m = /^(.+?)\s*[=:]\s*(.{3,})$/.exec(l);
      if(m) pairs.push([m[1], m[2]]); else skipped++;
    }
    lists = { [intoCat]: pairs };
  }
  let added = 0;
  for(const [cid, words] of Object.entries(lists)){
    const target = intoCat || cid;
    if(!catById(target) || !Array.isArray(words)) continue;
    // كل كلمة مع تعريفها: ["كلمة","تعريف"] (والكودات القديمة: "كلمة")
    for(const it of words){
      const [w, d] = Array.isArray(it) ? it : [it, ""];
      if(addToCat(target, w, d)) added++;
    }
  }
  saveEdits();
  if(skipped) toast(`تخطينا ${skipped} سطر بلا تعريف — اكتب: كلمة = تعريف`);
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
// نشاركو الكلمة مع تعريفها (الصور تبقى في الهاتف)
const withDefs = (catId, words) => words.map(w => [w, getDef(catId, w)]);
$("wcShare").onclick = () => {
  const ed = wordEdits[editCat.id];
  openShare({ v: 2, c: { [editCat.id]: ed ? withDefs(editCat.id, ed.added) : [] } }, "كلمات " + editCat.name);
};
$("wcImport").onclick = () => openImport(editCat.id);
$("shareAll").onclick = () => {
  const c = {}; for(const [id, ed] of Object.entries(wordEdits)) if(ed.added && ed.added.length) c[id] = withDefs(id, ed.added);
  openShare({ v: 2, c }, "كل كلماتي");
};
$("importAll").onclick = () => openImport(null);

// ----- تصدير / استرجاع البيانات (كلمات + تعريفات + صور) -----
const FS = NATIVE ? getPlugin("Filesystem") : null;
$("exportData").onclick = async () => {
  const photos = {};
  for(const k of await photoDB.keys()){ const v = await photoDB.get(k); if(v) photos[k] = v; }
  const data = { app: "mohtal", v: 1, date: new Date().toISOString(), by: profile ? profile.nick : "", wordEdits, photos };
  const json = JSON.stringify(data);
  const nWords = Object.values(wordEdits).reduce((s, e) => s + (e.added ? e.added.length : 0), 0);
  const name = `mohtal-data-${new Date().toISOString().slice(0, 10)}.json`;
  try{
    if(FS && SHARE){
      const r = await FS.writeFile({ path: name, data: json, directory: "CACHE", encoding: "utf8" });
      await SHARE.share({ title: "بيانات شكون المحتال؟", files: [r.uri], dialogTitle: "احفظ ولا ابعث الملف" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    toast(`📦 تصدّرو ${nWords} كلمة و ${Object.keys(photos).length} صورة`);
  }catch(e){ if(!String(e && e.message).match(/cancel/i)) toast("ما قدرناش نصدرو الملف"); }
};
$("importData").onclick = () => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    let data; try{ data = JSON.parse(await f.text()); }catch(e){ toast("الملف ماشي صحيح"); return; }
    if(!data || data.app !== "mohtal"){ toast("هذا ماشي ملف تاع شكون المحتال؟"); return; }
    if(!await ask("نزيدو الكلمات والتعريفات والصور اللي في الملف لهاتفك؟")) return;
    let nw = 0, np = 0;
    for(const [cid, e] of Object.entries(data.wordEdits || {})){
      if(!catById(cid)) continue;
      const ed = catEdits(cid);
      for(const w of e.added || []) if(addToCat(cid, w, (e.defs || {})[w])) nw++;
      for(const w of e.removed || []) if(!ed.removed.includes(w)){ ed.removed.push(w); }
      for(const [w, d] of Object.entries(e.defs || {})) if(!ed.defs[w]) ed.defs[w] = d;
    }
    for(const [k, v] of Object.entries(data.photos || {})){
      if(typeof v === "string" && v.startsWith("data:image/") && !photoIndex.has(k)){ await photoDB.set(k, v); photoIndex.add(k); np++; }
    }
    saveEdits(); renderWordCats();
    toast(`✅ ترجعو ${nw} كلمة و ${np} صورة`); vibe([20, 40, 20]);
  };
  inp.click();
};
$("goWords").onclick = () => { renderWordCats(); show("s-words"); };
$("wordsBack").onclick = () => { renderWordCats(); show("s-words"); };
$("wcAdd").onclick = addWord;
$("wcNew").onkeydown = e => { if(e.key === "Enter") addWord(); };
$("wcSearch").oninput = renderWordList;
$("wordsBack").addEventListener("click", () => picked.clear());
$("wcReset").onclick = async () => {
  if(!await ask(`ترجّع الكلمات الأصلية تاع "${editCat.name}"؟ الكلمات اللي زدتها رايحين يتحاو مع تعريفاتهم وصورهم.`)) return;
  const ed = wordEdits[editCat.id];
  if(ed) for(const w of ed.added || []) if(photoIndex.has(photoKey(editCat.id, w))) await deletePhoto(editCat.id, w);
  delete wordEdits[editCat.id]; saveEdits(); renderWordList(); toast("↩️ رجعت الكلمات الأصلية");
};

// زر الرجوع في أندرويد
if(APP){
  APP.addListener("backButton", () => {
    if(!$("modal").classList.contains("hidden")){ $("mNo").click(); return; }
    if(!$("sheet").classList.contains("hidden")){ closeSheet(); return; }
    if(!$("wordSheet").classList.contains("hidden")){ closeWordSheet(); return; }
    if(!$("pcard").classList.contains("hidden")){ closePlayerCard(); return; }
    const on = document.querySelector(".screen.on");
    if(!on || on.id === "s-games" || (on.id === "s-profile" && !hasProfile())) APP.exitApp();
    else if(on.id === "s-uno-lobby") $("unoLeave").click();
    else if(on.id === "s-uno-table") $("utLeave").click();
    else if(on.id === "s-sj-lobby" || on.id === "s-sj-game") $("sjLeave").click();
    else if(on.id === "s-uno-start" || on.id === "s-sj-start" || on.id === "s-home") show("s-games");
    else if(on.id === "s-w-find") document.querySelector("[data-wback]").click();
    else if(on.id === "s-words-cat") $("wordsBack").click();
    else if(on.id === "s-w-room") $("wLeave").click();
    else if(on.id.startsWith("s-pass") && on.id !== "s-pass-setup") document.querySelector("[data-quit-pass]").click();
    else show(on.id.startsWith("s-w-") || on.id.startsWith("s-pass") || on.id.startsWith("s-words") ? "s-home" : "s-games");
  });
}

renderHomeProfile();

// الموقع يخدم بلا إنترنت بعد أول زيارة
if(!NATIVE && location.protocol === "https:" && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

boot();
