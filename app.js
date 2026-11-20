"use strict";
/* ============================================================
   مين المحتال؟ — صُنع بواسطة Chaker Red
   ============================================================ */

// ---------- أدوات ----------
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function rnd(n){ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffle(arr){ const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// اختيار عادل: اللي كان محتال (ولا بدا) الجولة اللي فاتت فرصتو صغيرة بزاف باش يعاود،
// وماشي مستحيلة — باش ما يقدر حتى واحد يحسب ويعرف شكون المحتال
function fairPick(ids, n, hist){
  const last = hist[hist.length - 1] || [], recent = hist.slice(-6).flat();
  const pool = ids.slice(), out = [];
  while(out.length < n && pool.length){
    const w = pool.map(id => (last.includes(id) ? 0.12 : 1) / Math.pow(1 + recent.filter(x => x === id).length * 0.6, 2));
    let x = rnd(1e9) / 1e9 * w.reduce((a, b) => a + b, 0), k = 0;
    while(k < pool.length - 1 && (x -= w[k]) > 0) k++;
    out.push(pool[k]); pool.splice(k, 1);
  }
  hist.push(out); if(hist.length > 12) hist.shift();
  return out;
}
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
  if(lastState) onState(lastState);
}
const AV_COLORS = ["#ffcf3f","#3fe0a5","#ff8da0","#9d8bff","#6fd3ff","#ffa95c","#c6f26b","#f39cff"];
function avColor(id){ let h = 0; for(const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }

// ---------- الكلمات ----------
const CATS = RAW_CATEGORIES.map(c => ({ id: c.id, icon: c.icon, name: c.name.replace(" 🇩🇿", ""),
  base: [...new Set(c.words.split("\n").map(s => s.trim()).filter(Boolean))], list: [] }));
const catById = id => CATS.find(c => c.id === id) || ORIG_CATS.find(c => c.id === id);
// غير كلمات Claude يتعدلو — الكلمات الأصلية مقفولة 🔒
const claudeCat = id => CATS.find(c => c.id === id);
// ----- باقات الكلمات -----
// 🤖 كلمات Claude: اللي جات مع اللعبة (تتعدل) • 📦 الكلمات الأصلية: يزيدها صاحب الهاتف من ملف (تبقى في هاتفو برك، ما تتعدلش)
// 🤝 الزوج: الفئات اللي كاينة في الزوج يتخلطو، والفئات الجديدة تاع الأصلية يبانو وحدهم
// في الغرفة، الكلمات تتختار في هاتف القائد: اللاعبين ما يحتاجوش الباقة
const PACKS = { claude: "🤖 كلمات Claude", orig: "📦 الكلمات الأصلية", both: "🤝 Claude + الأصلية" };
const PACK_BTN = { claude: "🤖 Claude", orig: "📦 الأصلية", both: "🤝 الزوج" };
const PACK_IDS = ["claude", "orig", "both"];
let ORIG_CATS = [], bothCache = null;
function loadOrig(){
  const p = store.get("origPack", null);
  ORIG_CATS = !p || !Array.isArray(p.cats) ? [] : p.cats.map((c, i) => {
    const base = Object.freeze([...new Set((c.words || []).map(w => String(w).trim().replace(/\s+/g, " ")).filter(w => w && w.length <= 40))]);
    const match = CATS.some(x => x.id === c.match) ? c.match : "";
    return Object.freeze({ id: "o" + i, icon: String(c.icon || "📦").slice(0, 4), name: String(c.name || "فئة " + (i + 1)).slice(0, 30), base, list: base, defs: Object.freeze({}), orig: true, match });
  }).filter(c => c.list.length);
  bothCache = null;
}
loadOrig();
const hasOrig = () => ORIG_CATS.length > 0;
const packOf = st => st && (st.pack === "orig" || st.pack === "both") && hasOrig() ? st.pack : "claude";
// الزوج: فئة Claude + نفس الفئة من الأصلية = فئة وحدة مخلطة
function bothCats(){
  if(bothCache) return bothCache;
  const out = CATS.map(c => {
    const add = ORIG_CATS.filter(o => o.match === c.id);
    if(!add.length) return c;
    const list = [...new Set([...c.list, ...add.flatMap(o => o.list)])];
    return { id: c.id, icon: c.icon, name: c.name, list, defs: c.defs, mix: true };
  });
  return bothCache = [...out, ...ORIG_CATS.filter(o => !o.match)];
}
const packCats = p => !hasOrig() ? CATS : p === "orig" ? ORIG_CATS : p === "both" ? bothCats() : CATS;
const srcOf = c => c.src || (c.mix ? "mix" : c.orig ? "orig" : "claude");
const packWords = p => packCats(p).reduce((n, c) => n + c.list.length, 0);
const packInfo = p => ({ pack: p, n: packWords(p), cats: packCats(p).map(c => ({ id: c.id, name: c.name, icon: c.icon, src: srcOf(c) })) });
// الفئات المختارة لازم يكونو من نفس الباقة
function fixPackCats(st){
  const p = packOf(st); st.pack = p;
  const ids = packCats(p).map(c => c.id);
  st.cats = (st.cats || []).filter(id => ids.includes(id));
  if(!st.cats.length) st.cats = ids.slice();
  return st;
}
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
  bothCache = null;
  for(const c of CATS){
    const e = wordEdits[c.id] || { added: [], removed: [] };
    c.list = [...new Set([...e.added, ...c.base.filter(w => !e.removed.includes(w))])];
  }
}
applyEdits();
function pickWord(catIds, pack){
  const all = packCats(pack || "claude");
  const pool = all.filter(c => catIds.includes(c.id) && c.list.length);
  const cats = pool.length ? pool : all.filter(c => c.list.length);
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
function catsLabel(ids, pack){
  if(!ids.length || ids.length === packCats(pack || "claude").length) return "🎲 كل الفئات";
  if(ids.length === 1){ const c = catById(ids[0]); return c.icon + " " + c.name; }
  return "🎲 " + ids.length + " فئات";
}
// الألوان: 🤖 Claude أزرق • 📦 الأصلية برتقالي • 🤖📦 مخلطين نص ونص
const SRC_TAG = { claude: "🤖", orig: "📦", mix: "🤖📦" };
const SRC_NAME = { claude: "🤖 Claude", orig: "📦 الأصلية", mix: "🤖📦 مخلطين" };
function renderCatGrid(el, selected, onToggle, list){
  list = list || CATS;
  const srcs = list.map(srcOf), kinds = ["claude", "mix", "orig"].filter(k => srcs.includes(k)), multi = kinds.length > 1;
  el.classList.toggle("readonly", !onToggle);
  el.classList.toggle("multi", multi);
  el.innerHTML = (multi ? `<div class="cat-legend">${kinds.map(k => `<span class="lg ${k}">${SRC_NAME[k]}</span>`).join("")}</div>` : "") +
    list.map((c, i) => { const s = srcs[i], col = multi || s !== "claude";
      return `<button class="cat ${col ? "src-" + s : ""} ${selected.includes(c.id) ? "sel" : ""}" data-id="${esc(c.id)}"><span class="ic">${esc(c.icon)}</span><span class="nm">${esc(c.name)}</span>${multi ? `<span class="src">${SRC_TAG[s]}</span>` : ""}</button>`; }).join("");
  if(onToggle) el.querySelectorAll(".cat").forEach(b => b.onclick = () => { vibe(8); onToggle(b.dataset.id); });
}

// ---------- البطاقة (نفس الشكل للجميع) ----------
function cardHTML(){ return `<div class="in"><div class="face front"><div class="q">؟</div><div class="tap">اضغط مطوّل باش تشوف كلمتك 👆</div></div><div class="face back"><div class="cat-l"></div><div class="word"></div><div class="def hidden"></div><div class="hint"></div><div class="again">سيّب صبعك باش تخبّيها</div></div></div>`; }

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
// التعريف ما يبانش أبداً للمحتال، بصح البطاقة تاعو عندها نفس الشكل (سطر بلاصة التعريف)
const IMP_DEF = "🤫 ما عندكش التعريف… اسمع مليح واش يقولو";
const defLine = ({ isImp, def, hasDef }) => isImp ? (hasDef || def ? IMP_DEF : "") : (def || "");
function fillCard(el, {isImp, word, catName, hint, againText, def, hasDef}){
  if(!el.firstChild) el.innerHTML = cardHTML();
  const look = { def: defLine({ isImp, def, hasDef }) };
  el.querySelector(".cat-l").textContent = "الفئة: " + (isImp && !hint ? "؟" : catName);
  el.querySelector(".word").textContent = isImp ? "أنت المحتال 🤫" : word;
  const d = el.querySelector(".def");
  d.textContent = look.def;
  d.classList.toggle("hidden", !look.def);
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
  if(PARAMS.get("o") || PARAMS.get("f")) handleInviteUrl(location.search);
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
// الاسم اللي يبان لصحابك: لقبك ولا اسمك (انت تختار)
const dispName = () => profile ? ((profile.show === "name" ? profile.name : profile.nick) || profile.nick || profile.name) : store.get("myName", "");
let pfShow = "nick";
let profileAfter = null;
function showProfile(first, after){
  profileAfter = after || null;
  $("pfName").value = profile ? profile.name : "";
  $("pfNick").value = profile ? profile.nick : "";
  pfShow = profile && profile.show === "name" ? "name" : "nick";
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
  const n = $("pfNick").value.trim(), nm = $("pfName").value.trim();
  const shown = pfShow === "name" ? (nm || "اسمك") : (n || "لقبك");
  $("pfPreview").textContent = shown;
  document.querySelectorAll("#pfShow [data-show]").forEach(b => b.classList.toggle("on", b.dataset.show === pfShow));
  const av = $("pfAv");
  if(pendingPfp){ av.textContent = ""; av.style.background = ""; av.style.backgroundImage = `url('${pendingPfp}')`; av.classList.add("has-img"); }
  else { av.style.backgroundImage = ""; av.classList.remove("has-img"); av.style.background = avColor(myId); av.textContent = (n || $("pfName").value.trim() || "؟")[0]; }
  $("pfRemove").classList.toggle("hidden", !pendingPfp);
}
$("pfNick").oninput = updateNickPreview;
document.querySelectorAll("#pfShow [data-show]").forEach(b => b.onclick = () => { pfShow = b.dataset.show; vibe(8); updateNickPreview(); });
$("pfName").oninput = updateNickPreview;
$("pfSave").onclick = () => {
  const name = $("pfName").value.trim().replace(/\s+/g, " ");
  const nick = $("pfNick").value.trim().replace(/\s+/g, " ");
  if(name.length < 2){ toast("اكتب اسمك ✍️"); $("pfName").focus(); return; }
  if(nick.length < 2){ toast("اختار لقب باش يعرفوك صحابك 😎"); $("pfNick").focus(); return; }
  profile = { name, nick, show: pfShow };
  store.set("profile", profile); store.set("myName", dispName());
  const pfpChanged = (pendingPfp || null) !== myPfp;
  myPfp = pendingPfp || null; store.set("pfp", myPfp);
  renderHomeProfile(); vibe(20);
  // راك في غرفة: صحابك يشوفو الاسم الجديد مباشرة
  if(net){ sendMe(); if(pfpChanged){ if(isHost && room) room.setPfp(myId, myPfp); else net.send({ d: { a: "pfp", data: myPfp || null } }); } }
  if(typeof onlineProfileChanged === "function") onlineProfileChanged();
  const next = profileAfter; profileAfter = null;
  if(next) next(); else { toast("✅ تسجل"); show("s-home"); }
};
$("pfBack").onclick = () => show("s-home");
function renderHomeProfile(){
  if(!hasProfile()) return;
  $("homeNick").textContent = dispName();
  setAvatarEl($("homeAv"), myId, dispName());
}
$("homeProfile").onclick = () => showProfile(false);
async function splash(){
  show("s-splash");
  await wait(1900);
  if(!$("s-splash").classList.contains("on")) return;
  afterSplash();
}
function afterSplash(){
  if(typeof onlineInit === "function" && hasProfile()) onlineInit();
  if(pendingJoin){ goPendingJoin(); return; }
  if(pendingFriend){ const f = pendingFriend; pendingFriend = null; show("s-home"); openFriends(f); return; }
  show("s-home"); renderResume();
  // التطبيق تسكّر وسط اللعب (ماشي بإرادتو): نرجعو للغرفة وحدنا
  const r = resumeInfo();
  if(r && Date.now() - r.d.at < 30 * 60 * 1000){ toast("🔄 نرجعو للغرفة…"); openWifi(); doResume(); }
}
// ----- روابط الدعوة -----
function parseInvite(text){
  const s = String(text || "");
  // غرفة أونلاين: ?o=CODE ولا الرمز وحدو (ABCD-EFGH)
  const mo = /[?&#]o=([A-Za-z0-9\-]+)/.exec(s);
  if(mo && typeof isRoomCode === "function" && isRoomCode(mo[1])) return { online: cleanCode(mo[1]) };
  if(typeof isRoomCode === "function" && !/[.:\/]/.test(s) && isRoomCode(s)) return { online: cleanCode(s) };
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
  const p = pendingJoin; pendingJoin = null;
  ensureProfile(() => { openWifi(); if(p.online) joinOnline(p.online); else joinRoom(p.ip, p.port); });
}
let pendingFriend = null;
function handleInviteUrl(url){
  // رابط صاحب: ?f=CODE → نفتحو صحابي والكود مكتوب
  const mf = /[?&#]f=([A-Za-z0-9\-]{8,9})/.exec(String(url || ""));
  if(mf){ pendingFriend = mf[1]; const on = document.querySelector(".screen.on"); if(on && on.id !== "s-splash" && on.id !== "s-perm"){ const f = pendingFriend; pendingFriend = null; openFriends(f); } return; }
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
  if(!hasProfile()){ showProfile(true, openWifi); return; }
  $("wName").value = dispName();
  $("wHello").textContent = dispName();
  // أونلاين: التطبيق والموقع (https). صفحة الآيفون المحلية (http) غير واي فاي
  $("wOnlineBox").classList.toggle("hidden", !ONLINE_OK);
  $("wLocalBox").classList.toggle("hidden", !CAN_LEAD && !HOSTED);
  $("wHost").classList.toggle("hidden", !CAN_LEAD);
  $("wWebNote").classList.toggle("hidden", CAN_LEAD || ONLINE_OK);
  $("wJoin").className = HOSTED ? "btn" : "btn ghost small-btn";
  renderResume(); if(typeof renderOnlineBits === "function") renderOnlineBits();
  if(ONLINE_OK) onlineInit();
  $("wJoin").textContent = HOSTED ? "🚪 ادخل للغرفة" : "📶 الغرف القريبة";
  show("s-w-name");
}
$("goWifi").onclick = openWifi;
$("wEditName").onclick = () => showProfile(false, openWifi);

// ============================================================
//   وضع الهاتف الواحد
// ============================================================
let pcfg = store.get("passCfg", { players: 4, imps: 1, hint: true, names: [], cats: CATS.map(c => c.id) });
fixPackCats(pcfg);
// تبديل الباقة (هاتف واحد ولا القائد)
function choosePack(p, apply){
  if(p !== "claude" && !hasOrig()){ toast("📦 ما زدتش الكلمات الأصلية — زيدها من ✏️ تعديل الكلمات"); return; }
  apply(st => { st.pack = p; st.cats = packCats(p).map(c => c.id); });
  toast("✅ رايح نستعملو: " + PACKS[p]); vibe(15);
}
let pgame = null;
const pMaxImps = () => Math.max(1, Math.floor((pcfg.players - 1) / 2));
function settingsHTML(prefix, s, editable, info){
  const cur = info ? info.pack : packOf(s), n = info ? info.n : packWords(cur);
  return `<div class="label">📚 الكلمات اللي نلعبو بيها</div>
    <div class="pick-row pack-row">${PACK_IDS.map(p => `<button type="button" ${editable ? "" : "disabled"} class="${cur === p ? "on" : ""}" data-${prefix}pack="${p}">${PACK_BTN[p]}</button>`).join("")}</div>
    <div class="pack-now">✅ رايح نستعملو: <b>${PACKS[cur] || PACKS.claude}</b> — ${n.toLocaleString("en")} كلمة</div>
    <div class="row set-row"><div><div class="label">عدد المحتالين</div><div class="small">يتم اختيارهم عشوائياً</div></div>
    <div class="stepper"><button ${editable ? "" : "disabled"} data-${prefix}imps="1">+</button><b>${s.imps}</b><button ${editable ? "" : "disabled"} data-${prefix}imps="-1">−</button></div></div>
    <div class="row set-row"><div><div class="label">المحتال يشوف الفئة</div><div class="small">تلميح صغير للمحتال</div></div>
    <button class="toggle ${s.hint ? "on" : ""}" ${editable ? "" : "disabled"} data-${prefix}hint></button></div>
    <div class="row set-row"><div><div class="label">إظهار التعريف</div><div class="small">للاعبين برك — المحتال ما يشوفوش</div></div>
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
  $("pSettings").querySelectorAll("[data-ppack]").forEach(b => b.onclick = () => choosePack(b.dataset.ppack, fn => { fn(pcfg); renderPassSetup(); }));
  $("pSettings").querySelectorAll("[data-pimps]").forEach(b => b.onclick = () => { pcfg.imps = Math.min(pMaxImps(), Math.max(1, pcfg.imps + +b.dataset.pimps)); renderPassSetup(); });
  $("pSettings").querySelector("[data-phint]").onclick = () => { pcfg.hint = !pcfg.hint; renderPassSetup(); };
  $("pSettings").querySelector("[data-pdef]").onclick = () => { pcfg.showDef = pcfg.showDef === false; renderPassSetup(); };
  fixPackCats(pcfg);
  renderCatGrid($("pCats"), pcfg.cats, id => {
    pcfg.cats = pcfg.cats.includes(id) ? pcfg.cats.filter(x => x !== id) : [...pcfg.cats, id];
    renderPassSetup();
  }, packCats(packOf(pcfg)));
  $("pStart").disabled = !pcfg.cats.length;
  $("pStart").textContent = pcfg.cats.length ? "ابدأ اللعب ▶" : "اختار فئة وحدة على الأقل";
  store.set("passCfg", pcfg);
}
document.querySelectorAll("[data-pstep]").forEach(b => b.onclick = () => { pcfg.players = Math.min(20, Math.max(3, pcfg.players + +b.dataset.d)); renderPassSetup(); });
document.querySelector('[data-allcats="pass"]').onclick = () => {
  const all = packCats(packOf(pcfg)); pcfg.cats = pcfg.cats.length === all.length ? [] : all.map(c => c.id); renderPassSetup();
};

// تاريخ المحتالين في الهاتف الواحد (يتنسى كي يتبدل عدد اللاعبين)
let passImpHist = { n: 0, h: [] };
function passHist(players){ if(passImpHist.n !== players.length) passImpHist = { n: players.length, h: [] }; return passImpHist.h; }
let passFirstHist = [];
function passStart(){
  const pack = packOf(pcfg);
  const picked = pickWord(pcfg.cats, pack);
  if(!picked){ toast("الفئات اللي اخترتها فارغة — زيد كلمات ✏️"); return; }
  const { cat, word } = picked;
  const players = Array.from({ length: pcfg.players }, (_, i) => pcfg.names[i] || ("اللاعب " + (i + 1)));
  pgame = { cat, word, players, imps: fairPick(players.map((_, i) => i), Math.min(pcfg.imps, pMaxImps()), passHist(players)), turn: 0,
    def: pcfg.showDef === false ? "" : getDef(cat.id, word) };
  $("passCat").textContent = { claude: "🤖 Claude", orig: "📦 الأصلية", both: "🤝 Claude + الأصلية" }[pack] + " • " + catsLabel(pcfg.cats, pack);
  $("pFlip").innerHTML = cardHTML();
  passTurn(); show("s-pass");
}
function passTurn(onlyCard){
  const i = pgame.turn, isImp = pgame.imps.includes(i);
  fillCard($("pFlip"), { isImp, word: pgame.word, catName: pgame.cat.name, hint: pcfg.hint, againText: "سيّب صبعك باش تخبّيها", def: isImp ? "" : pgame.def, hasDef: !!pgame.def });
  if(onlyCard) return;
  $("passName").textContent = pgame.players[i];
  $("passHint").textContent = i === 0 ? "الهاتف عند" : "مرّر الهاتف إلى";
  $("dots").innerHTML = pgame.players.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("");
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
  const tok = el._tok = (el._tok || 0) + 1;   // دوران جديد يحبس القديم
  (function tick(){
    if(el._tok !== tok) return;
    el.textContent = names[((finalIdx - steps + k) % n + n * 10) % n];
    if(k < steps){ k++; delay *= 1.09; vibe(4); setTimeout(tick, delay); }
    else { el.textContent = "🎤 " + names[finalIdx]; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); vibe([30, 40, 60]); done && done(); }
  })();
}
$("pGo").onclick = () => {
  show("s-pass-first");
  $("pReveal").classList.add("hidden"); $("pRule").classList.add("hidden");
  if(pgame.firstIdx === undefined) pgame.firstIdx = fairPick(pgame.players.map((_, i) => i), 1, passFirstHist)[0];
  spinTo($("pSpin"), pgame.players, pgame.firstIdx, () => {
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
const TEST_AS = !NATIVE && /^(localhost|127.0.0.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("as");
// للتجربة على الحاسوب: كل نافذة تحفظ غرفتها وحدها
const SK = k => (TEST_AS ? "t_" + TEST_AS + "_" : "") + k;
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
  const msg = { a: "me", nick: dispName(), full: profile ? profile.name : "", stats: getStats(), code: typeof myFriendCode === "function" ? myFriendCode() : "" };
  if(isHost && room){ const p = room.player(myId); if(p){ p.full = msg.full; p.stats = msg.stats; p.name = msg.nick.slice(0, 20); p.code = msg.code; room.sync(); } }
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
function inviteLink(){
  const s = lastState; if(!s) return null;
  const host = s.players.find(p => p.host);
  if(s.code) return `${SITE}join.html?o=${s.code}&n=${encodeURIComponent(host ? host.name : "")}`;
  if(!s.ips.length) return null;
  return `${SITE}join.html?r=${encodeURIComponent(s.ips[0])}${httpPort !== HTTP_PORT ? "&h=" + httpPort : ""}&n=${encodeURIComponent(host ? host.name : "")}`;
}
async function copyCode(){
  const s = lastState; if(!s) return;
  const c = s.code ? fmtCode(s.code) : s.ips[0]; if(!c) return;
  toast(await copyText(c) ? "📋 تنسخ الرمز: " + c : "ما قدرناش ننسخو");
  vibe(15);
}
async function sendInvite(){
  const link = inviteLink(); if(!link){ toast("شعّل الواي فاي ولا نقطة الاتصال أولاً"); return; }
  const online = !!lastState.code, code = online ? fmtCode(lastState.code) : lastState.ips[0];
  const text = `تعال نلعبو مين المحتال؟ 🕵️\nادخل للغرفة من هنا 👇\n${link}\n\nولا اكتب رمز الغرفة: ${code}\n${online ? "(تخدم من أي بلاصة بالإنترنت 🌍)" : "(لازم تكون في نفس الواي فاي)"}`;
  if(SHARE){
    try{ await SHARE.share({ title: "مين المحتال؟", text, dialogTitle: "ابعث الدعوة لصحابك" }); return; }catch(e){ if(String(e && e.message).match(/cancel/i)) return; }
  } else if(navigator.share){
    try{ await navigator.share({ title: "مين المحتال؟", text }); return; }catch(e){ if(e && e.name === "AbortError") return; }
  }
  toast(await copyText(text) ? "📋 تنسخت الدعوة — الصقها في أي محادثة" : "ما قدرناش ننسخو");
}

function myName(){ return ($("wName").value || "").trim(); }
function needName(){
  const n = hasProfile() ? dispName() : myName();
  if(!n){ showProfile(true, openWifi); return null; }
  store.set("myName", n); return n;
}

// ----- اتصال مع إعادة محاولة تلقائية -----
// - نبضة كل 4 ثواني: إذا الواي فاي تبدل ولا الاتصال مات بلا ما يبان، نعاودو نتصلو بسرعة
// - كي ترجع للتطبيق (من واتساب، الشاشة طفات…) نعاودو نتصلو فوراً
// - رمز 4001 = نفس اللاعب دخل من اتصال آخر: هذا يحبس وما يتعاركش معاه
class Link {
  constructor(url, onMsg, onStatus, opts = {}){
    this.url = url; this.onMsg = onMsg; this.onStatus = onStatus;
    this.closed = false; this.tries = 0; this.queue = []; this.everUp = false;
    this.forever = !!opts.forever;
    this.downSince = 0; this.lastRx = 0; this.lastBeat = Date.now();
    this.onVis = () => { if(!document.hidden && !this.closed && !this.isOpen()){ this.tries = 0; this.open(); } };
    document.addEventListener("visibilitychange", this.onVis);
    this.hb = setInterval(() => this.beat(), 4000);
    this.open();
  }
  isOpen(){ return !!(this.ws && this.ws.readyState === 1); }
  open(){
    if(this.closed) return;
    clearTimeout(this.rt);
    if(this.ws && this.ws.readyState === 0) return;          // راهو يتصل دوك
    let ws;
    try{ ws = new WebSocket(this.url); }catch(e){ return this.retry(); }
    this.ws = ws;
    ws.onopen = () => {
      if(this.ws !== ws || this.closed) return;
      this.tries = 0; this.everUp = true; this.downSince = 0; this.lastRx = Date.now();
      this.onStatus("up", this);
      this.queue.splice(0).forEach(m => ws.send(m));
    };
    ws.onmessage = e => {
      if(this.ws !== ws) return;
      this.lastRx = Date.now();
      let m; try{ m = JSON.parse(e.data); }catch(_){ return; }
      if(m.t !== "pong") this.onMsg(m);
    };
    ws.onclose = e => {
      if(this.ws !== ws || this.closed) return;
      if(e && e.code === 4001){ this.close(); this.onStatus("replaced", this); return; }
      this.lost();
    };
    ws.onerror = () => {};
  }
  lost(){
    if(this.closed) return;
    if(!this.downSince) this.downSince = Date.now();
    this.onStatus("down", this);
    this.retry();
  }
  retry(){
    if(this.closed) return;
    this.tries++;
    // أول دخول: ~20 ثانية برك. من بعد: نحاولو 3 دقايق قبل ما نستسلمو
    if(!this.forever && ((!this.everUp && this.tries > 12) || (this.everUp && Date.now() - this.downSince > 180000))){
      this.close(); this.onStatus("dead", this); return;
    }
    clearTimeout(this.rt);
    this.rt = setTimeout(() => this.open(), Math.min(300 * this.tries, 2500));
  }
  beat(){
    const now = Date.now(), paused = now - this.lastBeat > 9000; this.lastBeat = now;
    const ws = this.ws; if(this.closed || !ws || ws.readyState !== 1) return;
    if(paused){ this.lastRx = now; return; }                 // التطبيق كان واقف (خلفية): ما نحكموش
    try{ ws.send('{"t":"ping"}'); }catch(e){}
    if(now - this.lastRx > 12000){
      // الاتصال ميت بلا ما يتسكر: نسيبوه ونعاودو
      this.ws = null; try{ ws.close(); }catch(e){}
      this.lost();
    }
  }
  send(obj){
    const m = JSON.stringify(obj);
    if(this.isOpen()) this.ws.send(m);
    else { this.queue.push(m); if(this.queue.length > 60) this.queue.shift(); }
  }
  close(){
    this.closed = true; clearTimeout(this.rt); clearInterval(this.hb);
    document.removeEventListener("visibilitychange", this.onVis);
    try{ this.ws && this.ws.close(); }catch(e){}
  }
}

// ----- القائد: منطق الغرفة كامل هنا، والباقي يستقبلو الحالة -----
class HostRoom {
  constructor(name){
    this.players = [{ id: myId, name, online: true, host: true, full: profile ? profile.name : "", stats: getStats(), code: typeof myFriendCode === "function" ? myFriendCode() : "" }];
    this.sid = uid();   // رقم الغرفة باش الجولات ما يتحسبوش مرتين
    this.settings = store.get("hostSettings", { imps: 1, hint: true, showDef: true, cats: CATS.map(c => c.id) });
    if(this.settings.showDef === undefined) this.settings.showDef = true;
    this.pfps = {};   // صور البروفايل تاع اللاعبين
    if(myPfp){ this.pfps[myId] = myPfp; pfpCache[myId] = myPfp; }
    fixPackCats(this.settings);
    this.phase = "lobby";
    this.round = null;
    this.roomName = name;
    this.ips = [];
    this.pending = false;
    this.mode = "wifi"; this.code = null; this.rcId = null; this.ver = 0;
  }
  // حفظ الغرفة في الهاتف (باش ترجع إذا التطبيق تسكّر)
  toSave(){
    const r = this.round;
    return { at: Date.now(), mode: this.mode, code: this.code, name: this.roomName, sid: this.sid, ver: this.ver + 100,
      settings: this.settings, phase: this.phase,
      players: this.players.map(p => ({ id: p.id, name: p.name, host: !!p.host, full: p.full || "", stats: p.stats || null, code: p.code || "" })),
      round: r ? JSON.parse(JSON.stringify(r)) : null, impHist: this.impHist || [], firstHist: this.firstHist || [] };
  }
  static fromSave(d, name){
    const h = new HostRoom(name);
    h.sid = d.sid || h.sid; h.ver = d.ver || 0;
    h.settings = fixPackCats(Object.assign(h.settings, d.settings || {}));
    h.phase = d.phase || "lobby"; h.round = d.round || null;
    h.impHist = d.impHist || []; h.firstHist = d.firstHist || [];
    for(const p of d.players || []) if(!p.host && p.id !== myId) h.players.push({ ...p, stats: p.stats || cleanStats(), online: false, needWho: true });
    if(h.phase === "lobby") h.players = h.players.filter(p => p.host);
    return h;
  }
  maxImps(n){ return Math.max(1, Math.floor(((n || this.players.length) - 1) / 2)); }
  player(id){ return this.players.find(p => p.id === id); }
  // لاعب رجع ولا دخل جديد
  arrive(id, name, quiet){
    // نعاودو نبعثولو صور البروفايل
    setTimeout(() => this.sendAllPfps(id), 300);
    const p = this.player(id);
    if(p){
      p.online = true; if(name) p.name = String(name).slice(0, 20);
      // غرفة رجعناها من الحفظ: نطلبو منو صورتو وإحصائياتو
      if(p.needWho && net){ p.needWho = false; net.send({ to: id, d: { type: "who" } }); }
      return p;
    }
    const np = { id, name: String(name || "لاعب").slice(0, 20), online: true };
    this.players.push(np);
    if(!quiet){ toast("👋 " + np.name + " دخل للغرفة"); vibe(15); }
    return np;
  }
  goneFromRoom(p){
    // في اللوبي نحيه، وفي الجولة نخليه (يقدر يرجع لنفس الجولة)
    if(this.phase === "lobby"){ this.players = this.players.filter(x => x !== p); toast("🚪 " + p.name + " خرج"); }
    else p.online = false;
    if(this.phase === "vote") this.checkVoteDone();
  }
  // من السيرفر
  onServer(m){
    if(m.t === "join"){
      this.arrive(m.id, m.name);
      this.sync();
    } else if(m.t === "roster"){
      // القائد عاود اتصل بالغرفة: القائمة الحقيقية تاع اللي متصلين دروك
      const live = new Map((m.players || []).map(x => [x.id, x.name]));
      for(const [id, name] of live){
        const known = !!this.player(id);
        this.arrive(id, known ? null : name, true);
        // ما نعرفوهش: نطلبو منو اسمو وإحصائياتو وصورتو
        if(!known && net) net.send({ to: id, d: { type: "who" } });
      }
      for(const p of this.players) if(!p.host && !live.has(p.id)) p.online = false;
      if(this.phase === "lobby") this.players = this.players.filter(p => p.host || p.online);
      if(this.phase === "vote") this.checkVoteDone();
      this.sync();
    } else if(m.t === "leave"){
      const p = this.player(m.id);
      if(p){ this.goneFromRoom(p); this.sync(); }
    } else if(m.t === "msg"){
      const d = m.d || {};
      let p = this.player(m.from);
      // رسالة من لاعب ما وصلناش خبر دخولو (ضاع وقت ما كان القائد يعاود يتصل): ندخلوه
      if(!p){ if(d.a !== "me" || !m.from) return; p = this.arrive(m.from, d.nick); }
      else if(!p.online && d.a !== "bye"){ p.online = true; this.sync(); }
      const r = this.round;
      if(d.a === "seen" && r && (d.no === undefined || d.no === r.no) && r.ids.includes(p.id) && !r.seen.includes(p.id)){ r.seen.push(p.id); this.sync(); }
      if(d.a === "vote") this.castVote(p.id, d.targetId !== undefined ? d.targetId : (r && r.ids[d.target]), d.no);
      if(d.a === "me"){ p.full = String(d.full || "").slice(0, 20); p.stats = cleanStats(d.stats); if(d.nick) p.name = String(d.nick).slice(0, 20); if(typeof d.code === "string") p.code = d.code.slice(0, 12); this.sync(); }
      if(d.a === "pfp"){
        const ok = typeof d.data === "string" && d.data.startsWith("data:image/") && d.data.length < 80000;
        this.setPfp(p.id, ok ? d.data : null);
      }
      if(d.a === "bye"){ this.goneFromRoom(p); this.sync(); }
    }
  }
  // أوامر القائد
  setSettings(fn){ fn(this.settings); fixPackCats(this.settings); this.settings.imps = Math.min(this.settings.imps, this.maxImps()); store.set("hostSettings", this.settings); this.sync(); }
  kick(id){
    const p = this.player(id); if(!p || p.host) return;
    this.players = this.players.filter(x => x.id !== id);
    if(this.round){
      const r = this.round;
      r.ids = r.ids.filter(x => x !== id);
      r.seen = r.seen.filter(x => x !== id);
      if(r.votes){ delete r.votes[id]; for(const v in r.votes) if(r.votes[v] === id) delete r.votes[v]; }
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
  castVote(voter, target, voteNo){
    const r = this.round;
    if(this.phase !== "vote" || !r || voteNo !== r.voteNo) return;
    if(!r.ids.includes(voter) || r.votes[voter]) return;            // صوت واحد برك
    if(!target || !r.ids.includes(target) || target === voter) return;   // ما تصوتش على روحك
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
    const pack = packOf(this.settings);
    const picked = pickWord(this.settings.cats, pack);
    if(!picked){ toast("الفئات اللي اخترتها فارغة — زيد كلمات ✏️"); return; }
    const { cat, word } = picked;
    const show = this.settings.showDef !== false;
    const nameOf = {}; for(const id of ids) nameOf[id] = this.player(id).name;
    this.impHist = this.impHist || [];
    this.round = { no: (this.round ? this.round.no : 0) + 1, ids, imps: fairPick(ids, imps, this.impHist), word, cat: cat.id, catName: cat.name, seen: [], first: null,
      nameOf, pack, def: show ? getDef(cat.id, word) : "" };
    this.phase = "card";
    this.sync();
  }
  // صور البروفايل: نبعثوهم مرة وحدة برك (ماشي مع كل تحديث)
  setPfp(id, data){
    if(data) this.pfps[id] = data; else delete this.pfps[id];
    for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "pfp", id, data: data || null } });
    pfpCache[id] = data || null; this.sync();
  }
  sendAllPfps(to){
    if(!net || room !== this) return;
    for(const [id, data] of Object.entries(this.pfps)) net.send({ to, d: { type: "pfp", id, data } });
  }
  pickFirst(){
    const r = this.round;
    // اللي يبدأ: من اللي متصلين، وقليل باش يعاود نفس اللي بدا الجولة اللي فاتت
    const live = r.ids.filter(id => { const p = this.player(id); return p && p.online; });
    this.firstHist = this.firstHist || [];
    r.first = fairPick(live.length ? live : r.ids, 1, this.firstHist)[0];
    r.tie = null; this.phase = "first"; this.sync();
  }
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
      sid: this.sid, v: this.ver, mode: this.mode, code: pid === myId ? this.code : undefined,
      players: this.players.map(p => ({ id: p.id, name: p.name, online: p.online, host: !!p.host, full: p.full || "", stats: p.stats || cleanStats(), code: p.code || "" })),
      settings: this.settings, maxImps: this.maxImps(), packInfo: packInfo(packOf(this.settings)),
      round: null
    };
    if(r && this.phase !== "lobby"){
      const cat = catById(r.cat) || { name: r.catName || "؟" };
      const nm = id => (this.player(id) || {}).name || (r.nameOf && r.nameOf[id]) || "؟";
      s.round = {
        no: r.no, pack: r.pack || "claude", inRound, count: r.ids.length, seen: r.seen.filter(id => r.ids.includes(id)).length, pids: r.ids.slice(),
        names: r.ids.map(nm),
        firstIdx: r.first ? r.ids.indexOf(r.first) : -1,
        me: inRound ? (() => {
          const imp = r.imps.includes(pid);
          // hasDef يوصل للكل (حتى المحتال) باش الشاشات تبان كيف كيف — بلا ما نبعثو التعريف للمحتال
          return { isImp: imp, word: imp ? null : r.word, catName: cat.name, catId: imp ? null : r.cat, hint: this.settings.hint,
            def: imp ? "" : (r.def || ""), hasDef: !!r.def };
        })() : null,
        reveal: this.phase === "reveal" ? { imps: r.imps.map(nm), word: r.word,
          impIdx: r.imps.map(id => r.ids.indexOf(id)),
          result: r.result ? { winner: r.result.winner, topIdx: r.ids.indexOf(r.result.top), counts: r.result.counts,
            myVoteIdx: r.result.votes[pid] ? r.ids.indexOf(r.result.votes[pid]) : -1 } : null } : null,
        // عدد الأصوات على كل لاعب يبان للجميع وقت التصويت
        vote: this.phase === "vote" ? { no: r.voteNo, counts: r.ids.map(id => Object.values(r.votes).filter(t => t === id).length),
          voted: r.ids.filter(id => r.votes[id]).length, total: Math.max(this.voters().length, r.ids.filter(id => r.votes[id]).length),
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
      if(room !== this || !net) return;      // الغرفة تسكرت
      this.ver++;
      clearTimeout(this.saveT); this.saveT = setTimeout(saveHostRoom, 800);
      if(this.mode === "online" && typeof setHosting === "function")
        setHosting({ id: this.rcId, nm: this.roomName, n: this.players.filter(p => p.online).length, ph: this.phase });
      for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "state", s: this.snapshot(p.id) } });
      onState(this.snapshot(myId));
    });
  }
}

// ----- إنشاء غرفة -----
// الغرفة تتسجل في الهاتف: إذا التطبيق تسكّر ولا الهاتف طفا، القائد يرجّعها كيما كانت
function saveHostRoom(){ if(isHost && room && room.toSave) store.set(SK("hostSave"), room.toSave()); }
function clearSaves(){ store.set(SK("hostSave"), null); store.set(SK("activeRoom"), null); }
function afterHostStart(myRoom){
  isHost = true; room = myRoom;
  keepAwake(true);
  room.sync();
  renderResume();
}
// غرفة أونلاين (بالإنترنت): تخدم في التطبيق وفي الموقع
async function hostOnline(restore){
  const name = needName(); if(!name) return;
  if(!ONLINE_OK){ toast("الأونلاين يخدم في التطبيق ولا في الموقع"); return; }
  if(hostBusy) return; hostBusy = true;
  try{
    if(net){ const old = net; net = null; old.close(); }
    resetRoundView(); isHost = false; room = null; lastState = null;
    toast("⏳ نفتحو الغرفة…");
    await onlineInit();
    const rc = await roomCrypto(restore && restore.code ? restore.code : randCode(8));
    const myRoom = restore ? HostRoom.fromSave(restore, name) : new HostRoom(name);
    myRoom.mode = "online"; myRoom.code = rc.code; myRoom.rcId = rc.id; myRoom.ips = []; webLinks = [];
    room = myRoom; isHost = true;
    net = new OnlineHostLink(rc, m => { if(room === myRoom) myRoom.onServer(m); }, (st, l) => { if(l === net) connStatus(st); });
    afterHostStart(myRoom);
    if(restore) toast("🔄 رجعت غرفتك — صحابك يرجعو وحدهم");
  }catch(e){ toast("ما قدرناش نفتحو الغرفة. تأكد من الإنترنت"); }
  hostBusy = false;
}
let hostBusy = false;
// غرفة في نفس الواي فاي (بلا إنترنت) — من التطبيق برك
async function hostWifi(restore){
  const name = needName(); if(!name) return;
  if(hostBusy) return; hostBusy = true;
  if(net){ const old = net; net = null; old.close(); }
  resetRoundView(); isHost = false; room = null; lastState = null;
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
    const myRoom = restore ? HostRoom.fromSave(restore, name) : new HostRoom(name);
    myRoom.mode = "wifi"; myRoom.ips = ips;
    room = myRoom; isHost = true;
    // القائد يعاود يتصل بغرفتو ديما (بلا حد): كي يرجع، السيرفر يبعثلو قائمة اللي متصلين
    net = new Link(url, m => { if(room === myRoom) myRoom.onServer(m); }, (st, l) => { if(l === net) connStatus(st); }, { forever: true });
    net.key = "host:" + url;
    afterHostStart(myRoom);
  }catch(e){
    toast("ما قدرناش نفتحو الغرفة. تأكد من الواي فاي");
  }
  hostBusy = false;
}
$("wHost").onclick = () => hostWifi();
$("wHostOnline").onclick = () => hostOnline();

// ----- البحث والانضمام -----
const foundRooms = new Map();
function renderRooms(){
  const box = $("rooms");
  if(!foundRooms.size){ box.innerHTML = `<div class="small" style="text-align:center;padding:18px">ما زال ما لقينا حتى غرفة… خلي القائد يفتح غرفة</div>`; return; }
  box.innerHTML = [...foundRooms.values()].map(r => `<button class="room" data-ip="${esc(r.host)}" data-port="${r.port}"><span class="ri">👑</span><span><b>غرفة ${esc(r.name)}</b><small>اضغط باش تدخل</small></span></button>`).join("");
  box.querySelectorAll(".room").forEach(b => b.onclick = () => joinRoom(b.dataset.ip, +b.dataset.port));
}
// شاشة الدخول: wifi = نقلبو على الغرف القريبة، وإلا غير بالرمز
async function openFind(wifi){
  if(!needName()) return;
  foundRooms.clear();
  const scan = !!(wifi && LN);
  $("wSearching").classList.toggle("hidden", !scan);
  $("rooms").classList.toggle("hidden", !scan);
  $("wFindChip").textContent = scan ? "📶 الغرف القريبة" : "🔗 ادخل لغرفة";
  renderRooms(); show("s-w-find");
  $("wIp").value = "";
  if(scan && !discovering){
    discovering = true;
    try{ await LN.startDiscovery(); }catch(e){ toast("البحث التلقائي ما خدمش، استعمل الرمز"); }
  }
}
$("wJoin").onclick = () => {
  if(!needName()) return;
  // الصفحة جات من هاتف القائد: ندخلو مباشرة
  if(HOSTED){ joinRoom(location.hostname, window.ROOM_WS_PORT); return; }
  // جاي من رابط دعوة: الرمز واجد
  if(pendingJoin){ goPendingJoin(); return; }
  openFind(true);
};
$("wJoinCode").onclick = () => { if(pendingJoin){ goPendingJoin(); return; } openFind(false); };
if(LN){
  LN.addListener("room", r => {
    const key = r.host + ":" + r.port;
    if(r.lost){ for(const [k, v] of foundRooms) if(v.name === r.name) foundRooms.delete(k); }
    else foundRooms.set(key, r);
    renderRooms();
  });
}
function stopDiscovery(){ if(LN && discovering){ discovering = false; LN.stopDiscovery().catch(() => {}); } }
document.querySelector("[data-wback]").onclick = () => { stopDiscovery(); openWifi(); };
$("wIpGo").onclick = () => {
  // يقبل رمز الغرفة الأونلاين، ولا رمز الواي فاي، ولا رابط الدعوة كامل
  const inv = parseInvite($("wIp").value.trim());
  if(!inv){ toast("الرمز ماشي صحيح"); return; }
  if(inv.online){ joinOnline(inv.online); return; }
  const v = inv.ip + (inv.port !== PORT ? ":" + inv.port : "");
  const ip = inv.ip, port = inv.port !== PORT ? inv.port : 0;
  store.set("lastIp", v);
  if(!NATIVE && !HOSTED && !PARAMS.has("leader")){
    // من المتصفح: نروحو لصفحة اللعبة اللي على هاتف القائد
    location.href = `http://${ip}:${HTTP_PORT}/?name=${encodeURIComponent(store.get("myName", ""))}`;
    return;
  }
  joinRoom(ip, +port || PORT);
};
$("wIp").onkeydown = e => { if(e.key === "Enter") $("wIpGo").click(); };

// لاعب يدخل لغرفة (واي فاي ولا أونلاين): نفس المنطق، غير الطريق يتبدل
function startGuest(key, makeLink, saveAs){
  const name = needName(); if(!name) return;
  stopDiscovery();
  // ضغطة مزدوجة على نفس الغرفة: ما نفتحوش اتصال ثاني (كانو يتعاركو ويبقى "إعادة الاتصال")
  if(net && !isHost && net.key === key && !net.closed) return;
  if(net){ const old = net; net = null; old.close(); }
  if(isHost){ isHost = false; store.set(SK("hostSave"), null); }
  room = null; lastState = null; resetRoundView();
  store.set(SK("activeRoom"), { ...saveAs, at: Date.now() });
  let gotState = false, helloT = null, helloN = 0;
  const link = makeLink(m => {
    if(net !== link) return;
    if(m.t === "msg" && m.d && m.d.type === "state"){ gotState = true; link.stateAt = Date.now(); onState(m.d.s); }
    else if(m.t === "msg" && m.d && m.d.type === "who"){ sendMe(); net.send({ d: { a: "pfp", data: myPfp || null } }); }
    else if(m.t === "msg" && m.d && m.d.type === "pfp"){ pfpCache[m.d.id] = m.d.data || null; if(lastState) refreshAvatars(); }
    else if(m.t === "kicked"){ clearSaves(); leaveRoom(false); toast("القائد خرّجك من الغرفة 😅"); }
    else if(m.t === "hostgone"){ clearSaves(); leaveRoom(false); toast("القائد سكّر الغرفة"); }
  }, (st, l) => {
    if(l !== net) return;                       // اتصال قديم
    if(st === "dead" && !gotState){
      store.set(SK("activeRoom"), null); leaveRoom(false);
      toast(saveAs.mode === "online" ? "ما لقيناش الغرفة 🤔 تأكد من الرمز، ولا القائد مازال ما فتحهاش" : "ما قدرناش ندخلو للغرفة. تأكد أنكم في نفس الواي فاي");
      if(!HOSTED) openFind(saveAs.mode !== "online");
      return;
    }
    if(st === "replaced"){ store.set(SK("activeRoom"), null); leaveRoom(false); toast("دخلت لنفس الغرفة من جهة أخرى"); return; }
    connStatus(st);
    if(st === "up"){
      // نعرّفو روحنا للقائد. إذا ما جاتناش الحالة في 3 ثواني نعاودو (يمكن القائد ما سمعش بينا)
      link.upAt = Date.now(); helloN = 0;
      const hello = () => {
        if(net !== link || link.closed) return;
        sendMe();
        if(seenSent && seenSent === shownRound && lastState && lastState.round) net.send({ d: { a: "seen", no: lastState.round.no } });
        clearTimeout(helloT);
        helloT = setTimeout(() => { if(net === link && !(link.stateAt > link.upAt) && ++helloN < 8) hello(); }, 3000);
      };
      hello();
      net.send({ d: { a: "pfp", data: myPfp || null } });
    }
  });
  link.key = key;
  net = link;
  keepAwake(true);
  renderResume();
  toast("⏳ نتصلو بالغرفة…");
}
function joinRoom(ip, port){
  const name = needName(); if(!name) return;
  const url = `ws://${ip}:${port}/?role=player&id=${encodeURIComponent(myId)}&name=${encodeURIComponent(name)}`;
  startGuest("wifi:" + ip + ":" + port, (onMsg, onSt) => new Link(url, onMsg, onSt), { mode: "wifi", ip, port });
}
async function joinOnline(code){
  if(!needName()) return;
  code = cleanCode(code);
  if(!ONLINE_OK){ toast("الأونلاين يخدم في التطبيق ولا في الموقع"); return; }
  if(!isRoomCode(code)){ toast("رمز الغرفة فيه 8 حروف ✍️"); return; }
  await onlineInit();
  const rc = await roomCrypto(code);
  startGuest("on:" + rc.id, (onMsg, onSt) => new OnlinePlayerLink(rc, onMsg, onSt), { mode: "online", code });
}
// شريط "إعادة الاتصال": يبان غير إذا الاتصال طاح أكثر من ثانية ونص (باش ما يبقاش يرمش)
let connT = null;
function connStatus(st){
  if(st === "up"){ clearTimeout(connT); connT = null; $("wConn").classList.add("hidden"); return; }
  if(st === "down"){ if(!connT && $("wConn").classList.contains("hidden")) connT = setTimeout(() => { connT = null; if(net && !net.isOpen()) $("wConn").classList.remove("hidden"); }, 1500); return; }
  if(st === "dead"){ clearTimeout(connT); connT = null; $("wConn").classList.add("hidden"); leaveRoom(false); toast("انقطع الاتصال مع الغرفة — تقدر ترجع من زر 🔄"); }
}
// sendBye = خرج بإرادتو (✕): ننساو الغرفة. غير هكذا نخليوها باش يقدر يرجع
async function leaveRoom(sendBye){
  clearTimeout(connT); connT = null; $("wConn").classList.add("hidden");
  const wasHost = isHost, mode = room && room.mode;
  if(net){
    if(sendBye && !isHost) net.send({ d: { a: "bye" } });
    const n = net; net = null;
    setTimeout(() => n.close(), sendBye ? 300 : 0);
  }
  if(wasHost && mode === "online"){ dropJoinRequests(); setHosting(null); }
  if(wasHost && LN && mode !== "online") LN.stopServer().catch(() => {});
  if(sendBye) clearSaves();
  isHost = false; room = null; lastState = null; resetRoundView();
  keepAwake(false);
  openWifi();
}
$("wLeave").onclick = async () => {
  if(await ask(isHost ? "تسكّر الغرفة؟ كل اللاعبين يخرجو." : "تخرج من الغرفة؟")) leaveRoom(true);
};

// ----- الرجوع للغرفة (بعد ما التطبيق تسكّر ولا الاتصال طاح بزاف) -----
const RESUME_MAX = 6 * 3600 * 1000;
function resumeInfo(){
  const h = store.get(SK("hostSave"), null);
  if(h && h.at && Date.now() - h.at < RESUME_MAX && (h.mode === "online" ? ONLINE_OK : (NATIVE || PARAMS.has("leader")))) return { host: true, d: h };
  const a = store.get(SK("activeRoom"), null);
  if(a && a.at && Date.now() - a.at < RESUME_MAX && (a.mode !== "online" || ONLINE_OK)) return { host: false, d: a };
  return null;
}
function renderResume(){
  const r = net ? null : resumeInfo();
  $("wResume").classList.toggle("hidden", !r);
  $("homeResume").classList.toggle("hidden", !r);
  if(r){
    const txt = r.host ? `🔄 رجّع غرفتك (${r.d.mode === "online" ? "أونلاين" : "واي فاي"})` : "🔄 رجوع للغرفة";
    $("wResume").textContent = txt; $("homeResume").textContent = txt;
  }
}
function doResume(){
  const r = resumeInfo(); if(!r){ renderResume(); return; }
  if(r.host) return r.d.mode === "online" ? hostOnline(r.d) : hostWifi(r.d);
  if(r.d.mode === "online") return joinOnline(r.d.code);
  return joinRoom(r.d.ip, r.d.port);
}
$("wResume").onclick = doResume;
$("homeResume").onclick = () => { ensureProfile(() => { openWifi(); doResume(); }); };

// ----- عرض الحالة (نفس الشي عند الكل) -----
// كل شي مربوط بـ "رقم الغرفة:رقم الجولة" — غرفة جديدة تبدا من الجولة 1 وما تختلطش مع اللي قبلها
let shownRound = "", spunRound = "", seenSent = "";
function resetRoundView(){
  shownRound = spunRound = seenSent = ""; voteShownNo = ""; votePick = null; voteSending = 0;
  ["wRevealBox", "wTie", "wVoteList"].forEach(id => { const e = $(id); if(e){ e.dataset.no = ""; e.dataset.key = ""; } });
}
function onState(s){
  const prev = lastState;
  if(prev && prev.sid === s.sid && typeof s.v === "number" && typeof prev.v === "number" && s.v < prev.v) return;
  lastState = s;
  if(!document.getElementById("s-w-room").classList.contains("on")) show("s-w-room");
  document.querySelectorAll("#s-w-room .host-only").forEach(e => e.classList.toggle("hidden", !isHost));
  document.querySelectorAll("#s-w-room .guest-only").forEach(e => e.classList.toggle("hidden", isHost));

  const host = s.players.find(p => p.host);
  $("wRoomChip").textContent = (s.mode === "online" ? "🌍" : "📶") + " غرفة " + (host ? host.name : s.roomName);
  if(typeof renderJoinReqs === "function") renderJoinReqs();
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
  const isOnline = !!s.code;
  $("wCodeBox").classList.toggle("hidden", !isHost || (!isOnline && !s.ips.length));
  $("wCode").textContent = isOnline ? fmtCode(s.code) : s.ips.join("  •  ");
  $("wCodeNote").textContent = isOnline ? "🌍 صحابك يدخلو من أي بلاصة بالإنترنت: ابعثلهم الدعوة ولا يكتبو الرمز" : "الرابط يفتح التطبيق مباشرة في الغرفة، ولا المتصفح إذا ما عندوش التطبيق";
  // رابط + QR: أونلاين = رابط الدعوة، واي فاي = صفحة الآيفون
  const link = isHost && (isOnline ? inviteLink() : webLinks[0]);
  $("wWebBox").classList.toggle("hidden", !link);
  $("wWebLabel").textContent = isOnline ? "📷 صوّرو الكود باش تدخلو (آيفون ولا أندرويد)" : "📱 صحابك اللي عندهم آيفون";
  $("wWebSmall").textContent = isOnline ? "يفتح الغرفة في التطبيق ولا في المتصفح" : "يصوّرو هذا الكود بالكاميرا، ولا يفتحو الرابط في Safari";
  if(link && $("wLink").textContent !== link){
    $("wLink").textContent = link;
    try{ const q = qrcode(0, "M"); q.addData(link); q.make(); $("wQr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }catch(e){}
  }
  const online = s.players.filter(p => p.online);
  $("wPlayersInfo").textContent = online.length < 3 ? `لازم ${3 - online.length} آخرين على الأقل` : `${online.length} لاعبين جاهزين`;
  const list = $("wPlayers");
  const canFriend = p => ONLINE_OK && ON.ready && p.code && p.id !== myId && p.code !== ON.code && !friendOf(p.code);
  const key = isHost + "|" + s.players.map(p => p.id + p.online + p.name + JSON.stringify(p.stats) + (pfpCache[p.id] ? "i" : "") + (canFriend(p) ? "f" : "") + (ON.fout[p.code] ? "o" : "")).join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = s.players.map(p => `<div class="pl ${p.online ? "" : "off"}" data-pid="${p.id}">
      ${avatarHTML(p.id, p.name)}
      <span class="n">${esc(p.name)}${p.id === myId ? " (أنت)" : ""}<span class="stats-mini">${statLine(p.stats)}</span></span>
      <span class="tag">${p.host ? "👑 القائد" : p.online ? "" : "غير متصل"}</span>
      ${canFriend(p) ? (ON.fout[p.code] ? `<span class="mini wait">⏳</span>` : `<button class="mini ok" data-addf="${esc(p.code)}" title="زيدو صاحب">➕👥</button>`) : ""}
      ${isHost && !p.host ? `<button class="kick" data-kick="${p.id}">✕</button>` : ""}</div>`).join("");
    // اضغط على لاعب باش تشوف بطاقتو
    list.querySelectorAll(".pl").forEach(row => row.onclick = e => {
      if(e.target.closest("[data-kick]")) return;
      const af = e.target.closest("[data-addf]"); if(af){ addFriend(af.dataset.addf).then(() => { list.dataset.key = ""; renderLobby(lastState); }); return; }
      showPlayerCard(lastState.players.find(x => x.id === row.dataset.pid));
    });
    list.querySelectorAll("[data-kick]").forEach(b => b.onclick = async () => {
      const p = s.players.find(x => x.id === b.dataset.kick);
      if(p && await ask(`تخرّج ${p.name} من الغرفة؟`)) room.kick(p.id);
    });
  }
  $("wSettings").innerHTML = settingsHTML("w", s.settings, isHost, s.packInfo);
  if(isHost){
    $("wSettings").querySelectorAll("[data-wpack]").forEach(b => b.onclick = () => choosePack(b.dataset.wpack, fn => room.setSettings(fn)));
    $("wSettings").querySelectorAll("[data-wimps]").forEach(b => b.onclick = () => room.setSettings(st => st.imps = Math.min(s.maxImps, Math.max(1, st.imps + +b.dataset.wimps))));
    $("wSettings").querySelector("[data-whint]").onclick = () => room.setSettings(st => st.hint = !st.hint);
    $("wSettings").querySelector("[data-wdef]").onclick = () => room.setSettings(st => st.showDef = st.showDef === false);
  }
  renderCatGrid($("wCats"), s.settings.cats, isHost ? id => room.setSettings(st => st.cats = st.cats.includes(id) ? st.cats.filter(x => x !== id) : [...st.cats, id]) : null, s.packInfo ? s.packInfo.cats : CATS);
  $("wStart").disabled = online.length < 3 || !s.settings.cats.length;
  $("wStart").textContent = online.length < 3 ? "في انتظار اللاعبين… (3 على الأقل)" : !s.settings.cats.length ? "اختار فئة وحدة على الأقل" : `ابدأ الجولة مع ${online.length} لاعبين ▶`;
}
function renderRound(s){
  const r = s.round, rk = s.sid + ":" + r.no;
  // جولة جديدة: نرجع البطاقة مقلوبة
  if(shownRound !== rk){
    shownRound = rk; seenSent = "";
    $("wRevealBox").dataset.no = ""; $("wTie").dataset.no = "";
    $("wFlip").innerHTML = cardHTML(); $("wFlip").classList.remove("open");
    $("peekPop").classList.add("hidden");
    $("wSpin")._tok = ($("wSpin")._tok || 0) + 1; $("wSpin").textContent = ""; $("wRule").classList.add("hidden"); $("v-first").classList.remove("spinning");
    if(s.phase === "card") vibe([20, 30, 20]);
  }
  fillCard($("wFlip"), { ...r.me, againText: "سيّب صبعك باش تخبّيها" });
  document.querySelectorAll("[data-packchip]").forEach(e => e.textContent = "📚 الكلمات: " + (PACKS[r.pack] || PACKS.claude));
  const look = { def: defLine(r.me) };
  // كلمتي تبقى متاحة طول الجولة (ضغط مطوّل)
  $("peekCat").textContent = "الفئة: " + (r.me.isImp && !r.me.hint ? "؟" : r.me.catName);
  $("peekWord").textContent = r.me.isImp ? "أنت المحتال 🤫" : r.me.word;
  $("peekDef").textContent = look.def;
  $("peekDef").classList.toggle("hidden", !look.def);
  $("wSeen").textContent = `👀 شافو كلمتهم: ${r.seen} / ${r.count}`;
  $("wFirst").textContent = r.seen >= r.count ? "الكل شاف! شكون يبدأ؟ 🎲" : `شكون يبدأ؟ 🎲 (${r.seen}/${r.count} شافو)`;

  if(s.phase === "first" || s.phase === "reveal"){
    if(spunRound !== rk){
      spunRound = rk;
      if(s.phase === "first" && r.firstIdx >= 0){
        // الأزرار تبان كي يحبس الدوران
        $("v-first").classList.add("spinning");
        spinTo($("wSpin"), r.names, r.firstIdx, () => {
          $("wRule").classList.remove("hidden");
          setTimeout(() => $("v-first").classList.remove("spinning"), 400);
        });
      }
    }
    if(r.firstIdx >= 0 && (s.phase === "reveal" || spunRound === rk && $("wSpin").textContent.startsWith("🎤"))){
      $("wSpin").textContent = "🎤 " + r.names[r.firstIdx]; $("wRule").classList.remove("hidden");
    }
  }
  // تعادل في التصويت: نكملو الأسئلة
  const tieBox = $("wTie");
  if(s.phase === "first" && r.tie){
    tieBox.classList.remove("hidden");
    if(tieBox.dataset.no !== rk + ":" + r.tie.no){
      tieBox.dataset.no = rk + ":" + r.tie.no;
      const parts = r.names.map((n, i) => ({ n, c: r.tie.counts[i] })).filter(x => x.c > 0).sort((a, b) => b.c - a.c);
      tieBox.innerHTML = `⚖️ تعادل! كمّلو الأسئلة وعاودو صوّتو<div class="tl">${parts.length ? parts.map(x => esc(x.n) + ": " + x.c).join(" • ") : "حتى واحد ما صوّت"}</div>`;
      vibe([30, 50, 30]);
    }
  } else tieBox.classList.add("hidden");
  $("wVote").textContent = r.tie ? "🗳️ عاودو التصويت" : "🗳️ تصويت: مين المحتال؟";

  if(s.phase === "vote" && r.vote) renderVote(r);

  if(s.phase === "reveal" && r.reveal){
    const box = $("wRevealBox");
    if(box.dataset.no !== rk){
      box.dataset.no = rk;
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
  if(shownRound && seenSent !== shownRound && lastState && lastState.round){
    seenSent = shownRound;
    const d = { a: "seen", no: lastState.round.no };
    if(isHost && room) room.onServer({ t: "msg", from: myId, d });
    else if(net) net.send({ d });
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

// ----- شاشة التصويت -----
let votePick = null, voteShownNo = "", voteSending = 0;
function renderVote(r){
  const v = r.vote, pids = r.pids || [];
  const vk = (lastState ? lastState.sid : "") + ":" + r.no + ":" + v.no;
  if(voteShownNo !== vk){ voteShownNo = vk; votePick = null; voteSending = 0; $("wVoteList").dataset.key = ""; vibe([20, 40, 20]); }
  if(votePick && !pids.includes(votePick)) votePick = null;
  const pickIdx = votePick ? pids.indexOf(votePick) : -1;
  const locked = v.myVote >= 0;
  const sending = !locked && voteSending && Date.now() - voteSending < 4000;
  const max = Math.max(1, ...v.counts);
  const top = Math.max(...v.counts);
  const list = $("wVoteList");
  const pl = i => lastState.players.find(p => p.id === (r.pids || [])[i]);
  const key = r.names.join("|") + "|" + pids.join(",") + "|" + pids.map(id => JSON.stringify((lastState.players.find(p => p.id === id) || {}).stats) + (pfpCache[id] ? "i" : "")).join("|");
  if(list.dataset.key !== key){
    list.dataset.key = key;
    list.innerHTML = r.names.map((n, i) => { const p = pl(i); return `<button class="vopt ${i === v.myIdx ? "me" : ""}" data-i="${i}" style="animation-delay:${i * 0.05}s">
      <span class="bar"></span>${avatarHTML(p ? p.id : n + i, n)}
      <span class="n">${esc(n)}${i === v.myIdx ? " (أنت)" : ""}<span class="stats-mini">${statLine(p && p.stats)}</span></span>
      <span class="info" data-info="${i}" aria-label="بطاقة اللاعب">👤</span><span class="vc">0</span></button>`; }).join("");
    list.querySelectorAll(".vopt").forEach(b => b.onclick = e => {
      if(e.target.closest("[data-info]")){ e.stopPropagation(); showPlayerCard(pl(+b.dataset.i)); return; }
      const lr = lastState && lastState.round;
      if(!lr || !lr.vote || lr.vote.myVote >= 0) return;
      votePick = (lr.pids || [])[+b.dataset.i] || null; vibe(10); renderVote(lr);
    });
  }
  list.classList.toggle("locked", locked);
  list.querySelectorAll(".vopt").forEach(b => {
    const i = +b.dataset.i, c = v.counts[i], vc = b.querySelector(".vc");
    if(vc.textContent !== String(c)){ vc.textContent = c; vc.classList.remove("bump"); void vc.offsetWidth; vc.classList.add("bump"); }
    b.querySelector(".bar").style.width = (c / max * 100) + "%";
    b.classList.toggle("sel", locked ? i === v.myVote : i === pickIdx);
    b.classList.toggle("top", c > 0 && c === top);
  });
  $("wVoted").textContent = `🗳️ صوّتو: ${v.voted} / ${v.total}`;
  $("wVoteInfo").textContent = locked ? `✔ صوّتت على ${r.names[v.myVote]} — نستناو الباقي…` : "اختار اللاعب اللي تشك فيه، ومن بعد أكّد صوتك";
  $("wVoteOk").disabled = locked || sending || pickIdx < 0;
  $("wVoteOk").textContent = locked ? "✔ تم التصويت" : sending ? "⏳ نبعثو صوتك…" : pickIdx >= 0 ? `تأكيد: ${r.names[pickIdx]} ✔` : "اختار لاعب باش تصوّت";
  // إذا الصوت ما وصلش (الاتصال طاح)، الزر يرجع بعد 4 ثواني
  if(sending){ clearTimeout(renderVote.t); renderVote.t = setTimeout(() => { if(lastState && lastState.round && lastState.round.vote) renderVote(lastState.round); }, 4100); }
}
$("wVoteOk").onclick = async () => {
  const r = lastState && lastState.round;
  if(!r || !r.vote || !votePick || r.vote.myVote >= 0) return;
  const target = votePick, idx = (r.pids || []).indexOf(target); if(idx < 0) return;
  if(!await ask(`تأكّد صوتك على ${r.names[idx]}؟ ما تقدرش تبدلو من بعد.`)) return;
  const cur = lastState && lastState.round;
  if(!cur || !cur.vote || cur.vote.no !== r.vote.no || cur.vote.myVote >= 0) return;   // التصويت تبدل وقت التأكيد
  const msg = { a: "vote", targetId: target, no: cur.vote.no };
  if(isHost && room) room.castVote(myId, msg.targetId, msg.no);
  else if(net) net.send({ d: msg });
  voteSending = Date.now(); renderVote(cur);
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
document.querySelector('[data-allcats="wifi"]').onclick = () => room && room.setSettings(st => { const all = packCats(packOf(st)); st.cats = st.cats.length === all.length ? [] : all.map(c => c.id); });

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
  if(!editCat) return;
  picked.clear();
  const ro = !!editCat.orig;
  $("s-words-cat").classList.toggle("ro", ro);
  $("wcTitle").textContent = editCat.icon + " " + editCat.name + (ro ? " 🔒" : "");
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
  if(c.orig){
    // 🔒 الكلمات الأصلية: تتشاف برك
    $("wcList").innerHTML = words.length ? words.map(w => `<div class="wrow ro"><span class="w">${esc(w)}</span><span class="lock">🔒</span></div>`).join("")
      : `<div class="small" style="text-align:center;padding:16px">ما لقينا حتى كلمة</div>`;
    $("wcReset").classList.add("hidden");
    return;
  }
  $("wcList").innerHTML = words.length ? words.map(w => `<div class="wrow ${picked.has(w) ? "sel" : ""}" data-w="${esc(w)}"><span class="ck"></span>
      <span class="w">${esc(w)}<small>${esc(getDef(c.id, w) || "— بلا تعريف")}</small></span>
      ${(e.added || []).includes(w) ? `<span class="new">جديدة</span>` : ""}
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
    // الكلمة تتمسح مع تعريفها
    delete ed.defs[w];
  }
  picked.clear(); saveEdits(); renderWordList();
  toast(`🗑️ تنحّاو ${n} ${n === 1 ? "كلمة" : "كلمات"}`); vibe(20);
};
// يزيد كلمة لفئة (يرجّع true إذا تزادت فعلاً)
function addToCat(catId, raw, rawDef){
  const w = String(raw).trim().replace(/\s+/g, " ").slice(0, 30);
  const def = String(rawDef || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const c = claudeCat(catId); if(!w || !c) return false;
  if(c.list.includes(w)) return false;
  const ed = catEdits(catId);
  if(ed.removed.includes(w)) ed.removed = ed.removed.filter(x => x !== w);   // كانت أصلية ونحّيناها
  else ed.added.unshift(w);
  if(def) ed.defs[w] = def;
  c.list.unshift(w);
  return true;
}
async function addWord(){
  const w = $("wcNew").value.trim().replace(/\s+/g, " ");
  const def = $("wcNewDef").value.trim().replace(/\s+/g, " ");
  if(!w){ toast("اكتب الكلمة ✍️"); $("wcNew").focus(); return; }
  if(def.length < 3){ toast("لازم تكتب تعريف للكلمة 📝"); $("wcNewDef").focus(); return; }
  if(!addToCat(editCat.id, w, def)){ toast("الكلمة موجودة ✔"); return; }
  saveEdits();
  $("wcNew").value = ""; $("wcNewDef").value = "";
  $("wcNew").focus();
  toast("✅ تزادت: " + w); vibe(15); renderWordList();
}

// ----- تعديل كلمة: التعريف -----
let wsWord = null;
function openWordSheet(w){
  if(!editCat || editCat.orig) return;
  wsWord = w;
  $("wsWord").textContent = w;
  $("wsDef").value = getDef(editCat.id, w);
  $("wordSheet").classList.remove("hidden");
}
function closeWordSheet(){ $("wordSheet").classList.add("hidden"); wsWord = null; }
$("wsClose").onclick = closeWordSheet;
$("wsSave").onclick = async () => {
  const w = wsWord; if(!w) return;
  const def = $("wsDef").value.trim().replace(/\s+/g, " ").slice(0, 80);
  if(def.length < 3){ toast("لازم تعريف للكلمة 📝"); return; }
  const ed = catEdits(editCat.id), base = editCat.defs[w];
  if(def === base) delete ed.defs[w]; else ed.defs[w] = def;
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
  return `مين المحتال؟ ✏️ ${label} (${total} كلمة)\nافتح اللعبة ← تعديل الكلمات ← 📥 كلمات صاحبي، والصق هذا:\n#MOHTAL1#${encodeWords(obj)}`;
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
    if(!claudeCat(target) || !Array.isArray(words)) continue;
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
// نشاركو الكلمة مع تعريفها
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

// ----- تصدير / استرجاع البيانات (كلمات + تعريفات) -----
const FS = NATIVE ? getPlugin("Filesystem") : null;
$("exportData").onclick = async () => {
  const data = { app: "mohtal", v: 2, date: new Date().toISOString(), by: profile ? profile.nick : "", wordEdits };
  const json = JSON.stringify(data);
  const nWords = Object.values(wordEdits).reduce((s, e) => s + (e.added ? e.added.length : 0), 0);
  const name = `mohtal-data-${new Date().toISOString().slice(0, 10)}.json`;
  try{
    if(FS && SHARE){
      const r = await FS.writeFile({ path: name, data: json, directory: "CACHE", encoding: "utf8" });
      await SHARE.share({ title: "بيانات مين المحتال؟", files: [r.uri], dialogTitle: "احفظ ولا ابعث الملف" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    toast(`📦 تصدّرو ${nWords} كلمة`);
  }catch(e){ if(!String(e && e.message).match(/cancel/i)) toast("ما قدرناش نصدرو الملف"); }
};
$("importData").onclick = () => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    let data; try{ data = JSON.parse(await f.text()); }catch(e){ toast("الملف ماشي صحيح"); return; }
    if(!data || data.app !== "mohtal"){ toast("هذا ماشي ملف تاع مين المحتال؟"); return; }
    if(!await ask("نزيدو الكلمات والتعريفات اللي في الملف لهاتفك؟")) return;
    let nw = 0;
    for(const [cid, e] of Object.entries(data.wordEdits || {})){
      if(!claudeCat(cid)) continue;
      const ed = catEdits(cid);
      for(const w of e.added || []) if(addToCat(cid, w, (e.defs || {})[w])) nw++;
      for(const w of e.removed || []) if(!ed.removed.includes(w)){ ed.removed.push(w); }
      for(const [w, d] of Object.entries(e.defs || {})) if(!ed.defs[w]) ed.defs[w] = d;
    }
    saveEdits(); renderWordCats();
    toast(`✅ ترجعو ${nw} كلمة`); vibe([20, 40, 20]);
  };
  inp.click();
};
$("goWords").onclick = () => { renderWordCats(); renderOrigPanel(); show("s-words"); };
// ----- الكلمات الأصلية: ملف يتزاد في هذا الهاتف برك -----
function renderOrigPanel(){
  const n = packWords("orig"), mixed = ORIG_CATS.filter(c => c.match), fresh = ORIG_CATS.filter(c => !c.match);
  $("origInfo").innerHTML = hasOrig()
    ? `✅ كاينين في هاتفك: <b>${n.toLocaleString("en")}</b> كلمة في <b>${ORIG_CATS.length}</b> فئة — 🔒 ما يتبدلوش<br>
      القائد يختار من الإعدادات: 🤖 Claude • 📦 الأصلية • 🤝 الزوج<br>
      🤝 في الزوج: ${mixed.length} فئات يتخلطو مع فئات Claude${fresh.length ? ` و ${fresh.length} فئات جداد (${fresh.map(c => esc(c.name)).join("، ")})` : ""}`
    : "ما زالو ما تزادوش. زيد ملف الكلمات (.json) باش القائد يقدر يختارهم.";
  $("origImport").textContent = hasOrig() ? "📥 بدّلهم بملف جديد" : "📥 زيد من ملف";
  $("origCats").innerHTML = ORIG_CATS.map(c => `<button type="button" class="chip ochip ${c.match ? "mix" : "new"}" data-oid="${c.id}">${esc(c.icon)} ${esc(c.name)} • ${c.list.length}${c.match ? "" : " ✨"}</button>`).join(" ");
  $("origCats").querySelectorAll("[data-oid]").forEach(b => b.onclick = () => openWordCat(b.dataset.oid));
}
$("origImport").onclick = () => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".json,application/json,text/plain";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if(!f) return;
    let data; try{ data = JSON.parse(await f.text()); }catch(e){ toast("الملف ماشي صحيح"); return; }
    if(!data || data.app !== "mohtal-pack" || !Array.isArray(data.cats)){ toast("هذا ماشي ملف كلمات تاع اللعبة"); return; }
    const cats = data.cats.filter(x => x && x.name && Array.isArray(x.words)).map(x => ({ name: x.name, icon: x.icon, match: typeof x.match === "string" ? x.match : "", words: x.words.filter(w => typeof w === "string") }));
    if(!cats.length){ toast("الملف فارغ"); return; }
    if(hasOrig() && !await ask("تبدّل الكلمات الأصلية اللي عندك بهذا الملف؟")) return;
    store.set("origPack", { name: String(data.name || "الكلمات الأصلية").slice(0, 40), cats });
    loadOrig(); renderOrigPanel(); fixPackCats(pcfg); store.set("passCfg", pcfg);
    if(isHost && room) room.setSettings(() => {});
    toast(`✅ تزادو ${packWords("orig").toLocaleString("en")} كلمة في ${ORIG_CATS.length} فئة`); vibe([20, 40, 20]);
  };
  inp.click();
};
$("wordsBack").onclick = () => { renderWordCats(); show("s-words"); };
$("wcAdd").onclick = addWord;
$("wcNew").onkeydown = e => { if(e.key === "Enter") addWord(); };
$("wcSearch").oninput = renderWordList;
$("wordsBack").addEventListener("click", () => picked.clear());
$("wcReset").onclick = async () => {
  if(!await ask(`ترجّع الكلمات الأصلية تاع "${editCat.name}"؟ الكلمات اللي زدتها رايحين يتحاو مع تعريفاتهم.`)) return;
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
    if(!on || on.id === "s-home" || (on.id === "s-profile" && !hasProfile())) APP.exitApp();
    else if(on.id === "s-w-find") document.querySelector("[data-wback]").click();
    else if(on.id === "s-friends") openWifi();
    else if(on.id === "s-words-cat") $("wordsBack").click();
    else if(on.id === "s-w-room") $("wLeave").click();
    else if(on.id.startsWith("s-pass") && on.id !== "s-pass-setup") document.querySelector("[data-quit-pass]").click();
    else show("s-home");
  });
}

renderHomeProfile();

// الموقع يخدم بلا إنترنت بعد أول زيارة
if(!NATIVE && location.protocol === "https:" && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// نبداو كي يكملو كل السكريبتات (online.js يجي من بعد app.js)
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
