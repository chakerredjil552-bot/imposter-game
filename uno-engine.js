"use strict";
/* ============================================================
   أونو — محرك اللعبة (يخدم عند القائد فقط، هو اللي يقرر كلش)
   الأنماط: classic (عادي) • nomercy (بلا رحمة) • flip (فليب)
   الكارطات لا نهائية: كل كارطة تتولد عشوائياً حسب تركيبة الباكو
   ============================================================ */
const UNO_COLORS = { L: ["r", "y", "g", "b"], D: ["p", "t", "o", "v"] };
const UNO_CNAME = { r: "أحمر", y: "أصفر", g: "أخضر", b: "أزرق", p: "وردي", t: "فيروزي", o: "برتقالي", v: "بنفسجي" };
const UNO_DRAW = { d2: 2, d4: 4, w4: 4, wr4: 4, w6: 6, w10: 10, d1: 1, d5: 5, wd2: 2 };
const unoIsWild = k => k[0] === "w";
const UNO_HARD_MAX = 300;   // سقف أمان: حتى "بلا حد" ما يفوتش 300 كارطة في اليد
const unoRand = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const UNO_DEFAULTS = {
  classic: { limit: 0, rule70: false, drawUntil: false },
  nomercy: { limit: 25, rule70: true, drawUntil: true },
  flip: { limit: 0, rule70: false, drawUntil: false }
};
function unoDefaultSettings(){
  return { mode: "classic", start: 7, maxPlayers: 10, limit: 0, stack: true, plus4on2: false, challenge: true,
    rule70: false, multi: true, drawUntil: false, teams: false, timer: 20, aggr: 1 };
}
// تركيبة الباكو الرسمية لكل نمط [وجه، عدد]
function unoComposition(mode, side){
  const out = [], cols = mode === "flip" ? UNO_COLORS[side] : UNO_COLORS.L;
  for(const c of cols){
    if(mode === "classic"){
      out.push([{ k: "n", c, v: 0 }, 1]);
      for(let v = 1; v <= 9; v++) out.push([{ k: "n", c, v }, 2]);
      out.push([{ k: "skip", c }, 2], [{ k: "rev", c }, 2], [{ k: "d2", c }, 2]);
    } else if(mode === "nomercy"){
      for(let v = 0; v <= 9; v++) out.push([{ k: "n", c, v }, 2]);
      out.push([{ k: "skip", c }, 3], [{ k: "rev", c }, 3], [{ k: "d2", c }, 3], [{ k: "d4", c }, 2], [{ k: "discall", c }, 3], [{ k: "skipall", c }, 2]);
    } else {
      for(let v = 1; v <= 9; v++) out.push([{ k: "n", c, v }, 2]);
      out.push([{ k: "rev", c }, 2], [{ k: "flip", c }, 2]);
      if(side === "L") out.push([{ k: "d1", c }, 2], [{ k: "skip", c }, 2]);
      else out.push([{ k: "d5", c }, 2], [{ k: "skipall", c }, 2]);
    }
  }
  if(mode === "classic") out.push([{ k: "w" }, 4], [{ k: "w4" }, 4]);
  else if(mode === "nomercy") out.push([{ k: "wr4" }, 8], [{ k: "w6" }, 4], [{ k: "w10" }, 4], [{ k: "wroul" }, 8]);
  else if(side === "L") out.push([{ k: "w" }, 4], [{ k: "wd2" }, 4]);
  else out.push([{ k: "w" }, 4], [{ k: "wdc" }, 4]);
  return out;
}
const unoSameFace = (a, b) => a.k === b.k && (a.k !== "n" || a.v === b.v);

class UnoRoom {
  constructor(name){
    this.game = "uno";
    this.roomName = name;
    this.ips = [];
    this.players = [{ id: myId, name, online: true, host: true, full: profile ? profile.name : "", stats: getStats(), hand: [] }];
    this.settings = Object.assign(unoDefaultSettings(), store.get("unoSettings", {}));
    this.phase = "lobby";
    this.pfps = {}; if(myPfp){ this.pfps[myId] = myPfp; pfpCache[myId] = myPfp; }
    this.seq = 0; this.cardSeq = 0; this.events = []; this.round = 0;
    this.pending = false;
    this.tick = setInterval(() => this.onTick(), 300);
  }
  destroy(){ clearInterval(this.tick); }
  player(id){ return this.players.find(p => p.id === id); }

  // ---------- الكارطات ----------
  buildWeights(){
    const a = this.settings.aggr || 1;
    this.weights = {};
    for(const side of (this.settings.mode === "flip" ? ["L", "D"] : ["L"])){
      const list = unoComposition(this.settings.mode, side).map(([f, n]) => [f, n * (f.k === "n" ? 1 : a)]);
      this.weights[side] = { list, total: list.reduce((s, x) => s + x[1], 0) };
    }
  }
  pickFace(side){
    const W = this.weights[side]; let r = Math.random() * W.total;
    for(const [f, w] of W.list){ if((r -= w) < 0) return { ...f }; }
    return { ...W.list[0][0] };
  }
  newCard(){
    const id = ++this.cardSeq;
    return this.settings.mode === "flip" ? { id, L: this.pickFace("L"), D: this.pickFace("D") } : { id, f: this.pickFace("L") };
  }
  face(c){ return c.f || c[this.side]; }
  colors(){ return UNO_COLORS[this.settings.mode === "flip" ? this.side : "L"]; }

  // ---------- أحداث للرسوم المتحركة ----------
  ev(e){ e.seq = ++this.seq; this.events.push(e); if(this.events.length > 40) this.events.shift(); }

  // ---------- من السيرفر ----------
  onServer(m){
    if(m.t === "join"){
      setTimeout(() => this.sendAllPfps(m.id), 300);
      const p = this.player(m.id);
      if(p){ p.online = true; p.name = m.name || p.name; }
      else {
        const watching = this.phase !== "lobby" || this.players.length >= this.settings.maxPlayers;
        this.players.push({ id: m.id, name: (m.name || "لاعب").slice(0, 14), online: true, hand: [], watch: watching });
        toast("👋 " + (m.name || "لاعب") + " دخل للطاولة"); vibe(15);
      }
      this.sync();
    } else if(m.t === "leave"){
      const p = this.player(m.id); if(!p) return;
      if(this.phase === "lobby"){ this.players = this.players.filter(x => x.id !== m.id); toast("🚪 " + p.name + " خرج"); }
      else { p.online = false; if(this.cur() === p) this.deadline = Math.min(this.deadline || Infinity, Date.now() + 3000); }
      this.sync();
    } else if(m.t === "msg"){
      const p = this.player(m.from); if(!p) return;
      this.action(p, m.d || {});
    }
  }
  setPfp(id, data){
    if(data) this.pfps[id] = data; else delete this.pfps[id];
    for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "pfp", id, data: data || null } });
    pfpCache[id] = data || null; this.sync();
  }
  sendAllPfps(to){ for(const [id, data] of Object.entries(this.pfps)) net.send({ to, d: { type: "pfp", id, data } }); }

  // ---------- أوامر القائد ----------
  setSettings(fn){
    const before = this.settings.mode;
    fn(this.settings);
    if(this.settings.mode !== before) Object.assign(this.settings, UNO_DEFAULTS[this.settings.mode]);
    store.set("unoSettings", this.settings); this.sync();
  }
  kick(id){
    const p = this.player(id); if(!p || p.host) return;
    this.players = this.players.filter(x => x.id !== id);
    net.send({ t: "kick", id });
    if(this.phase === "play" && this.active().length < 2) this.finish(this.active()[0]);
    this.sync();
  }
  seated(){ return this.players.filter(p => !p.watch); }
  active(){ return this.players.filter(p => p.inGame && !p.out); }
  cur(){ return this.players[this.turn]; }

  start(){
    const st = this.settings;
    this.players.forEach(p => { if(p.watch && this.players.filter(x => !x.watch).length < st.maxPlayers) p.watch = false; });
    const seats = this.players.filter(p => !p.watch && p.online);
    if(seats.length < 2){ toast("لازم 2 لاعبين على الأقل"); return; }
    this.buildWeights();
    this.side = "L"; this.dir = 1; this.round++;
    this.pendingDraw = 0; this.pendTop = 0; this.lastAttack = null; this.drew = false; this.pick = null; this.winner = null; this.ranks = [];
    // الفرق: الشركاء قدام بعضاهم
    const teamCount = st.teams ? Math.ceil(seats.length / 2) : 0;
    this.players.forEach(p => { p.inGame = false; p.out = false; p.hand = []; p.unoCalled = false; p.catchable = false; p.team = null; });
    seats.forEach((p, i) => { p.inGame = true; p.team = st.teams ? i % teamCount : null; for(let k = 0; k < st.start; k++) p.hand.push(this.newCard()); });
    // الكارطة الأولى: رقم عادي
    let top; do { top = this.newCard(); } while(this.face(top).k !== "n");
    this.top = top; this.discard = [top]; this.color = this.face(top).c;
    this.order = seats.map(p => this.players.indexOf(p));
    this.turn = this.order[unoRand(this.order.length)];
    this.phase = "play";
    this.events = []; this.ev({ t: "deal" });
    this.resetTimer();
    this.sync();
  }
  newRound(){ this.start(); }
  toLobby(){ this.phase = "lobby"; this.players = this.players.filter(p => p.online); this.players.forEach(p => { p.watch = false; p.hand = []; }); this.sync(); }

  // ---------- الدور ----------
  nextIdx(from, steps = 1){
    let i = from; const n = this.players.length;
    for(let s = 0; s < steps; s++){ let g = 0; do { i = (i + this.dir + n) % n; } while((!this.players[i].inGame || this.players[i].out) && ++g < n); }
    return i;
  }
  resetTimer(){ this.deadline = this.settings.timer ? Date.now() + this.settings.timer * 1000 : 0; const p = this.cur(); if(p && !p.online) this.deadline = Date.now() + 3000; }
  advance(from, skips = 0){
    const others = this.active().length - 1;
    skips = Math.min(skips, others);
    const skipped = [];
    let i = from;
    for(let s = 0; s < skips; s++){ i = this.nextIdx(i); skipped.push(this.players[i].id); }
    if(skipped.length) this.ev({ t: "skip", ps: skipped });
    this.turn = skips >= others && skips > 0 ? from : this.nextIdx(i);
    this.drew = false;
    this.resetTimer();
  }

  // ---------- قواعد اللعب ----------
  playable(card){
    const f = this.face(card), t = this.face(this.top);
    if(this.pendingDraw > 0) return this.stackOk(f);
    if(unoIsWild(f.k)) return true;
    if(f.c === this.color) return true;
    if(f.k === "n") return t.k === "n" && f.v === t.v;
    return f.k === t.k;
  }
  // التكديس: ما تقدرش تحط رقم صغير فوق رقم كبير
  stackOk(f){
    if(!this.settings.stack) return false;
    const dv = UNO_DRAW[f.k]; if(!dv) return false;
    if(dv < this.pendTop) return false;
    if(dv === this.pendTop) return true;
    if(!unoIsWild(f.k)) return f.c === this.color;        // +4 ملونة فوق +2: لازم نفس اللون
    if(f.k === "w4" || f.k === "wr4") return !!this.settings.plus4on2;   // +4 السوداء فوق +2 (حسب القائد)
    return true;
  }
  hasColor(hand, color){ return hand.some(c => { const f = this.face(c); return !unoIsWild(f.k) && f.c === color; }); }
  give(p, n, why){
    const got = [];
    for(let i = 0; i < n && p.hand.length < UNO_HARD_MAX; i++){ const c = this.newCard(); p.hand.push(c); got.push(c.id); }
    if(p.hand.length > 2) p.unoCalled = false;
    this.ev({ t: "draw", p: p.id, n, why });
    this.mercy(p);
    return got;
  }
  // سحب حتى يجي لون معين (روليت / اسحب لون)
  giveUntilColor(p, color){
    let n = 0;
    for(let i = 0; i < 40 && p.hand.length < UNO_HARD_MAX; i++){ const c = this.newCard(); p.hand.push(c); n++; const f = this.face(c); if(!unoIsWild(f.k) && f.c === color) break; }
    p.unoCalled = false;
    this.ev({ t: "draw", p: p.id, n, why: "color" });
    this.mercy(p);
  }
  // حد الكارطات: اللي يفوت الحد يخرج
  mercy(p){
    const lim = this.settings.limit;
    if(!lim || p.out || p.hand.length <= lim) return;
    p.out = true; p.hand = []; this.ranks.unshift(p.id);
    this.ev({ t: "out", p: p.id });
    const act = this.active();
    if(act.length === 1) this.finish(act[0]);
    else if(this.cur() === p) this.advance(this.turn);
  }
  finish(winner){
    if(!winner || this.phase === "over") return;
    this.phase = "over"; this.deadline = 0;
    const team = winner.team;
    this.winner = { id: winner.id, team };
    this.ev({ t: "win", p: winner.id, team });
    countUnoWin(this, winner);
  }

  action(p, d){
    if(d.a === "me"){ p.full = String(d.full || "").slice(0, 20); p.stats = cleanStats(d.stats); return this.sync(); }
    if(d.a === "pfp"){ const ok = typeof d.data === "string" && d.data.startsWith("data:image/") && d.data.length < 80000; return this.setPfp(p.id, ok ? d.data : null); }
    if(d.a === "bye"){ this.players = this.players.filter(x => x !== p); if(this.phase === "play"){ if(this.active().length < 2) this.finish(this.active()[0]); else if(this.cur() === p) this.advance(this.turn); } return this.sync(); }
    if(this.phase !== "play" || !p.inGame || p.out) return;
    const idx = this.players.indexOf(p), myTurn = idx === this.turn;
    if(d.a === "uno"){
      if(p.hand.length <= 2 && !p.unoCalled){ p.unoCalled = true; p.catchable = false; this.ev({ t: "uno", p: p.id }); this.sync(); }
      return;
    }
    if(d.a === "catch"){
      const t = this.player(d.id);
      if(t && t.catchable && t !== p){ t.catchable = false; this.give(t, 2, "caught"); this.ev({ t: "caught", p: t.id, by: p.id }); this.sync(); }
      return;
    }
    if(!myTurn) return;
    if(this.pick && d.a !== "pick7" && d.a !== "roul") return;
    // أي حركة من اللاعب تسكر فرصة "امسكو" على اللي قبلو
    for(const o of this.players) if(o !== p) o.catchable = false;
    if(d.a === "play") this.doPlay(p, idx, d.ids || [], d.color);
    else if(d.a === "draw") this.doDraw(p, idx);
    else if(d.a === "pass"){ if(this.drew){ this.ev({ t: "pass", p: p.id }); this.advance(idx); } }
    else if(d.a === "challenge") this.doChallenge(p, idx);
    else if(d.a === "pick7") this.doPick7(p, idx, d.id);
    else if(d.a === "roul") this.doRoul(p, idx, d.color);
    this.sync();
  }

  doPlay(p, idx, ids, color){
    if(!ids.length) return;
    if(ids.length > 1 && !this.settings.multi) return;
    const cards = ids.map(id => p.hand.find(c => c.id === id));
    if(cards.some(c => !c)) return;
    const faces = cards.map(c => this.face(c));
    if(!faces.every(f => unoSameFace(f, faces[0]))) return;
    if(!this.playable(cards[0])) return;
    const f = faces[faces.length - 1], n = cards.length, prevColor = this.color;
    p.hand = p.hand.filter(c => !ids.includes(c.id));
    const hadColor = this.hasColor(p.hand, prevColor);
    this.top = cards[cards.length - 1];
    this.discard.push(...cards); if(this.discard.length > 14) this.discard.splice(0, this.discard.length - 14);
    const cols = this.colors();
    if(unoIsWild(f.k)) this.color = cols.includes(color) ? color : cols[unoRand(4)];
    else this.color = f.c;
    this.ev({ t: "play", p: p.id, faces, color: this.color });
    this.drew = false;
    // فاز؟
    if(p.hand.length === 0){
      if(UNO_DRAW[f.k]){ const t = this.players[this.nextIdx(idx)]; this.give(t, faces.reduce((s, x) => s + (UNO_DRAW[x.k] || 0), 0) + this.pendingDraw, "attack"); }
      this.pendingDraw = 0;
      return this.finish(p);
    }
    if(p.hand.length === 1 && !p.unoCalled){ p.catchable = true; this.ev({ t: "forgot", p: p.id }); }
    if(p.hand.length > 2) p.unoCalled = false;
    const k = f.k;
    // أرقام: قاعدة 7 و 0
    if(k === "n"){
      if(this.settings.rule70 && f.v === 7){
        const others = this.active().filter(o => o !== p);
        if(others.length === 1){ this.swap(p, others[0]); if(this.phase === "play" && !p.out) this.advance(idx); return; }
        this.pick = { type: "seven", by: p.id }; this.resetTimer(); return;
      }
      if(this.settings.rule70 && f.v === 0){ this.rotateHands(); return this.advance(idx); }
      return this.advance(idx);
    }
    if(k === "skip") return this.advance(idx, n);
    if(k === "skipall"){ this.ev({ t: "skipall", p: p.id }); this.drew = false; return this.resetTimer(); }
    if(k === "rev"){
      if(n % 2) this.dir *= -1;
      this.ev({ t: "rev", dir: this.dir });
      if(this.active().length === 2) return this.advance(idx, 1);
      return this.advance(idx);
    }
    if(k === "discall"){
      const gone = p.hand.filter(c => { const ff = this.face(c); return !unoIsWild(ff.k) && ff.c === f.c; });
      p.hand = p.hand.filter(c => !gone.includes(c));
      if(gone.length) this.ev({ t: "discall", p: p.id, n: gone.length });
      if(p.hand.length === 0) return this.finish(p);
      return this.advance(idx);
    }
    if(k === "flip"){
      if(n % 2){ this.side = this.side === "L" ? "D" : "L"; const tf = this.face(this.top); this.color = unoIsWild(tf.k) ? this.colors()[unoRand(4)] : tf.c; }
      this.ev({ t: "flip", side: this.side, color: this.color });
      return this.advance(idx);
    }
    if(k === "wroul"){
      const t = this.nextIdx(idx);
      this.turn = t; this.pick = { type: "roul", by: this.players[t].id }; this.resetTimer();
      return;
    }
    if(k === "wdc"){
      const t = this.players[this.nextIdx(idx)];
      this.giveUntilColor(t, this.color);
      if(this.phase !== "play") return;
      return this.advance(idx, t.out ? 0 : 1);
    }
    if(UNO_DRAW[k]){
      if(k === "wr4" && n % 2){ this.dir *= -1; this.ev({ t: "rev", dir: this.dir }); }
      const total = faces.reduce((s, x) => s + UNO_DRAW[x.k], 0);
      this.pendingDraw += total; this.pendTop = UNO_DRAW[k];
      const tIdx = this.nextIdx(idx);
      this.lastAttack = unoIsWild(k) && this.settings.challenge ? { by: p.id, target: this.players[tIdx].id, prevColor, hadColor } : null;
      this.ev({ t: "attack", p: p.id, to: this.players[tIdx].id, total: this.pendingDraw });
      if(!this.settings.stack){
        const t = this.players[tIdx];
        if(this.lastAttack){ this.turn = tIdx; this.drew = false; this.resetTimer(); return; }   // يقدر يتحدى قبل ما يسحب
        this.give(t, this.pendingDraw, "attack"); this.pendingDraw = 0; this.pendTop = 0;
        if(this.phase !== "play") return;
        return this.advance(idx, t.out ? 0 : 1);
      }
      this.turn = tIdx; this.drew = false; this.resetTimer();
      return;
    }
    // جوكر عادي
    return this.advance(idx);
  }
  swap(a, b){ const h = a.hand; a.hand = b.hand; b.hand = h; [a, b].forEach(x => { x.unoCalled = false; x.catchable = false; }); this.ev({ t: "swap", a: a.id, b: b.id }); [a, b].forEach(x => this.mercy(x)); }
  rotateHands(){
    const act = this.order.map(i => this.players[i]).filter(p => p.inGame && !p.out);
    const hands = act.map(p => p.hand);
    act.forEach((p, i) => { p.hand = hands[(i - this.dir + act.length) % act.length]; p.unoCalled = false; p.catchable = false; });
    this.ev({ t: "rotate", dir: this.dir });
  }
  doPick7(p, idx, targetId){
    if(!this.pick || this.pick.type !== "seven" || this.pick.by !== p.id) return;
    const t = this.player(targetId); if(!t || t === p || !t.inGame || t.out) return;
    this.pick = null; this.swap(p, t); if(this.phase === "play" && !p.out) this.advance(idx);
  }
  doRoul(p, idx, color){
    if(!this.pick || this.pick.type !== "roul" || this.pick.by !== p.id) return;
    const cols = this.colors(); if(!cols.includes(color)) color = cols[unoRand(4)];
    this.pick = null; this.color = color;
    this.ev({ t: "roul", p: p.id, color });
    this.giveUntilColor(p, color);
    if(this.phase === "play" && !p.out) this.advance(idx);
  }
  doDraw(p, idx){
    if(this.pendingDraw > 0){
      const n = this.pendingDraw; this.pendingDraw = 0; this.pendTop = 0; this.lastAttack = null;
      this.give(p, n, "attack");
      if(this.phase === "play" && !p.out) this.advance(idx);
      return;
    }
    if(this.drew) return;
    if(this.settings.drawUntil){
      let n = 0;
      for(let i = 0; i < 40 && p.hand.length < UNO_HARD_MAX; i++){ const c = this.newCard(); p.hand.push(c); n++; if(this.playable(c)) break; }
      p.unoCalled = false;
      this.ev({ t: "draw", p: p.id, n, why: "until" });
      this.mercy(p);
    } else this.give(p, 1, "draw");
    if(this.phase !== "play" || p.out) return;
    this.drew = true;
    if(!p.hand.some(c => this.playable(c))){ this.ev({ t: "pass", p: p.id }); this.advance(idx); }
    else this.deadline = this.settings.timer ? Date.now() + Math.min(this.settings.timer, 10) * 1000 : 0;
  }
  // التحدي على الكارطة السوداء: إذا كان عندو اللون اللي قبل، هو اللي ياكلها
  doChallenge(p, idx){
    const la = this.lastAttack;
    if(!la || la.target !== p.id || this.pendingDraw <= 0) return;
    const attacker = this.player(la.by), n = this.pendingDraw;
    this.lastAttack = null; this.pendingDraw = 0; this.pendTop = 0;
    if(la.hadColor && attacker){
      this.ev({ t: "challenge", ok: true, p: p.id, by: attacker.id, n });
      this.give(attacker, n, "challenge");
      if(this.phase === "play" && this.cur() === p){ this.drew = false; this.resetTimer(); }
    } else {
      this.ev({ t: "challenge", ok: false, p: p.id, by: la.by, n: n + 2 });
      this.give(p, n + 2, "challenge");
      if(this.phase === "play" && !p.out) this.advance(idx);
    }
  }
  // الوقت كمل: اللعبة تتصرف بلاصتو
  onTick(){
    if(this.phase !== "play" || !this.deadline || Date.now() < this.deadline) return;
    const p = this.cur(); if(!p) return;
    const idx = this.turn;
    if(this.pick){
      if(this.pick.type === "seven"){ const others = this.active().filter(o => o !== p); this.doPick7(p, idx, others[unoRand(others.length)].id); }
      else this.doRoul(p, idx, this.colors()[unoRand(4)]);
    } else if(this.drew){ this.ev({ t: "pass", p: p.id }); this.advance(idx); }
    else this.doDraw(p, idx);
    this.ev({ t: "timeout", p: p.id });
    this.sync();
  }

  // ---------- الحالة لكل لاعب ----------
  snapshot(pid){
    const me = this.player(pid), base = {
      game: "uno", phase: this.phase, roomName: this.roomName, ips: this.ips, round: this.round,
      settings: this.settings,
      players: this.players.map(p => ({ id: p.id, name: p.name, host: !!p.host, online: p.online, full: p.full || "", stats: p.stats || cleanStats(),
        watch: !!p.watch, inGame: !!p.inGame, out: !!p.out, n: p.hand ? p.hand.length : 0, team: p.team, uno: !!p.unoCalled, catchable: !!p.catchable }))
    };
    if(this.phase === "lobby") return base;
    const myIdx = this.players.indexOf(me), myTurn = myIdx === this.turn;
    const faceOf = c => ({ id: c.id, ...this.face(c), back: this.settings.mode === "flip" ? (c.L === this.face(c) ? c.D : c.L) : null });
    Object.assign(base, {
      mode: this.settings.mode, side: this.side, color: this.color, dir: this.dir,
      top: faceOf(this.top), discard: this.discard.slice(-6).map(faceOf),
      pending: this.pendingDraw, turn: this.players[this.turn] ? this.players[this.turn].id : null,
      timeLeft: this.deadline ? Math.max(0, this.deadline - Date.now()) : 0, timeTotal: (this.drew ? Math.min(this.settings.timer, 10) : this.settings.timer) * 1000,
      order: this.order.map(i => this.players[i] && this.players[i].id),
      pick: this.pick, winner: this.winner, events: this.events.slice(-30), seq: this.seq
    });
    if(me && me.inGame){
      base.hand = me.hand.map(faceOf);
      if(myTurn && !this.pick){
        base.playable = me.hand.filter(c => this.playable(c)).map(c => c.id);
        base.drew = this.drew;
        base.canChallenge = !!(this.lastAttack && this.lastAttack.target === me.id && this.pendingDraw > 0);
      }
      // الفرق: نشوفو كارطات الشريك
      if(this.settings.teams && me.team !== null) base.mates = this.players.filter(o => o !== me && o.inGame && o.team === me.team).map(o => ({ id: o.id, hand: o.hand.map(faceOf) }));
    }
    return base;
  }
  sync(){
    if(this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "uno", s: this.snapshot(p.id) } });
      UNO.onState(this.snapshot(myId));
    });
  }
}
// الإحصائيات: الربح في أونو (تتحسب عند كل واحد في هاتفو)
function countUnoWin(room, winner){}
