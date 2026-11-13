"use strict";
/* ============================================================
   سين جيم — فريقين، 6 فئات، 36 سؤال (200/400/600)، 3 وسائل مساعدة
   القائد هو الحكم: يشوف الجواب ويقرر شكون جاوب صح
   ============================================================ */
const SJ_POINTS = [200, 200, 400, 400, 600, 600];
const SJ_HELP = { two: ["✌️", "جوابين"], pit: ["🕳️", "الحفرة"], time: ["⏱️", "وقت زايد"] };
const SJ_TEAMC = ["#ff5d73", "#4aa8ff"];

class SJRoom {
  constructor(name){
    this.game = "sj"; this.roomName = name; this.ips = [];
    this.players = [{ id: myId, name, online: true, host: true, team: -1 }];
    this.settings = Object.assign({ cats: [], timer: 60, steal: 30, helpers: true, names: ["الفريق الأحمر", "الفريق الأزرق"] }, store.get("sjSettings", {}));
    this.settings.cats = (this.settings.cats || []).filter(id => SJ_CATS.some(c => c.id === id)).slice(0, 6);
    this.phase = "lobby"; this.pending = false; this.pfps = {}; if(myPfp){ this.pfps[myId] = myPfp; pfpCache[myId] = myPfp; }
    this.tick = setInterval(() => this.onTick(), 400);
  }
  destroy(){ clearInterval(this.tick); }
  player(id){ return this.players.find(p => p.id === id); }
  onServer(m){
    if(m.t === "join"){
      setTimeout(() => { for(const [id, data] of Object.entries(this.pfps)) net.send({ to: m.id, d: { type: "pfp", id, data } }); }, 300);
      const p = this.player(m.id);
      if(p){ p.online = true; p.name = m.name || p.name; }
      else {
        // الفريق اللي فيه أقل لاعبين
        const a = this.players.filter(x => x.team === 0).length, b = this.players.filter(x => x.team === 1).length;
        this.players.push({ id: m.id, name: (m.name || "لاعب").slice(0, 14), online: true, team: a <= b ? 0 : 1 });
        toast("👋 " + (m.name || "لاعب") + " دخل"); vibe(15);
      }
      this.sync();
    } else if(m.t === "leave"){
      const p = this.player(m.id); if(!p) return;
      if(this.phase === "lobby") this.players = this.players.filter(x => x.id !== m.id); else p.online = false;
      this.sync();
    } else if(m.t === "msg"){
      const p = this.player(m.from); if(p) this.action(p, m.d || {});
    }
  }
  setPfp(id, data){ if(data) this.pfps[id] = data; else delete this.pfps[id]; for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "pfp", id, data: data || null } }); pfpCache[id] = data || null; this.sync(); }
  setSettings(fn){ fn(this.settings); store.set("sjSettings", this.settings); this.sync(); }
  kick(id){ const p = this.player(id); if(!p || p.host) return; this.players = this.players.filter(x => x.id !== id); net.send({ t: "kick", id }); this.sync(); }
  setTeam(id){ const p = this.player(id); if(!p) return; p.team = p.team === 0 ? 1 : p.team === 1 ? (p.host ? -1 : 0) : 0; this.sync(); }
  start(){
    let cats = this.settings.cats.slice();
    const rest = shuffle(SJ_CATS.map(c => c.id).filter(id => !cats.includes(id)));
    while(cats.length < 6) cats.push(rest.shift());
    // نختارو سؤالين لكل مستوى، ونتفاداو اللي تعاودو
    const used = store.get("sjUsed", []);
    this.board = cats.map(cid => {
      const c = SJ_CATS.find(x => x.id === cid);
      const cells = [];
      for(const pts of [200, 400, 600]){
        let pool = c.q[pts].map((qa, i) => ({ qa, key: cid + pts + i }));
        let fresh = pool.filter(x => !used.includes(x.key)); if(fresh.length < 2) fresh = pool;
        shuffle(fresh).slice(0, 2).forEach(x => { cells.push({ pts, q: x.qa[0], a: x.qa[1], key: x.key, done: null }); used.push(x.key); });
      }
      return { id: cid, name: c.name, icon: c.icon, cells };
    });
    store.set("sjUsed", used.slice(-300));
    this.teams = [0, 1].map(i => ({ name: this.settings.names[i], score: 0, help: { two: true, pit: true, time: true } }));
    this.turn = Math.random() < .5 ? 0 : 1;
    this.phase = "board"; this.q = null; this.last = null; this.round = (this.round || 0) + 1;
    this.sync();
  }
  action(p, d){
    if(d.a === "me" || d.a === "bye"){ if(d.a === "bye"){ this.players = this.players.filter(x => x !== p); } return this.sync(); }
    if(d.a === "pfp"){ const ok = typeof d.data === "string" && d.data.startsWith("data:image/") && d.data.length < 80000; return this.setPfp(p.id, ok ? d.data : null); }
    const judge = p.host;
    if(d.a === "pick" && this.phase === "board"){
      // يختار الفريق اللي عندو الدور (ولا القائد)
      if(!judge && p.team !== this.turn) return;
      const col = this.board[d.c], cell = col && col.cells[d.i];
      if(!cell || cell.done) return;
      this.q = { c: d.c, i: d.i, team: this.turn, stage: "main", deadline: Date.now() + this.settings.timer * 1000, total: this.settings.timer * 1000, used: [] };
      this.phase = "q"; this.sync();
    } else if(d.a === "help" && this.phase === "q" && this.q.stage === "main" && this.settings.helpers){
      if(!judge && p.team !== this.q.team) return;
      const t = this.teams[this.q.team];
      if(!t.help[d.h] || this.q.used.includes(d.h)) return;
      t.help[d.h] = false; this.q.used.push(d.h);
      if(d.h === "time"){ this.q.deadline += 30000; this.q.total += 30000; }
      this.sync();
    } else if(d.a === "judge" && judge && (this.phase === "q")){
      const cell = this.board[this.q.c].cells[this.q.i], pts = cell.pts, team = this.q.team, other = 1 - team;
      let res;
      if(d.r === "ok"){ this.teams[team].score += pts; if(this.q.used.includes("pit")) this.teams[other].score -= pts; res = { team, pts, pit: this.q.used.includes("pit") }; cell.done = team; }
      else if(d.r === "steal" && this.q.stage === "main"){ this.q.stage = "steal"; this.q.deadline = Date.now() + this.settings.steal * 1000; this.q.total = this.settings.steal * 1000; return this.sync(); }
      else if(d.r === "stealok"){ this.teams[other].score += pts; res = { team: other, pts, steal: true }; cell.done = other; }
      else { res = { team: -1, pts }; cell.done = -1; }
      this.last = { ...res, q: cell.q, a: cell.a, seq: Date.now() };
      this.q = null; this.turn = other;
      this.phase = this.board.every(col => col.cells.every(c => c.done !== null)) ? "over" : "board";
      this.sync();
    } else if(d.a === "end" && judge){ this.phase = "over"; this.q = null; this.sync(); }
  }
  onTick(){
    if(this.phase !== "q" || !this.q || !this.q.deadline) return;
    if(Date.now() > this.q.deadline && !this.q.timeUp){ this.q.timeUp = true; this.sync(); }
  }
  snapshot(pid){
    const me = this.player(pid), judge = me && me.host;
    const s = { game: "sj", phase: this.phase, roomName: this.roomName, ips: this.ips, settings: this.settings, round: this.round,
      players: this.players.map(p => ({ id: p.id, name: p.name, host: !!p.host, online: p.online, team: p.team })) };
    if(this.phase === "lobby") return s;
    s.teams = this.teams; s.turn = this.turn; s.last = this.last;
    s.board = this.board.map(col => ({ name: col.name, icon: col.icon, cells: col.cells.map(c => ({ pts: c.pts, done: c.done })) }));
    if(this.q){
      const cell = this.board[this.q.c].cells[this.q.i], col = this.board[this.q.c];
      s.q = { c: this.q.c, i: this.q.i, cat: col.name, icon: col.icon, pts: cell.pts, text: cell.q, team: this.q.team, stage: this.q.stage, used: this.q.used,
        timeLeft: Math.max(0, this.q.deadline - Date.now()), total: this.q.total, answer: judge ? cell.a : null };
    }
    return s;
  }
  sync(){
    if(this.pending) return; this.pending = true;
    queueMicrotask(() => { this.pending = false; for(const p of this.players) if(!p.host && p.online) net.send({ to: p.id, d: { type: "sj", s: this.snapshot(p.id) } }); SJ.onState(this.snapshot(myId)); });
  }
}

const SJ = {
  state: null,
  openStart(){
    currentGame = "sj";
    $("sjHello").textContent = profile ? profile.nick : "";
    $("sjHost").classList.toggle("hidden", !CAN_LEAD);
    $("sjWebNote").classList.toggle("hidden", CAN_LEAD);
    $("sjJoin").className = CAN_LEAD ? "btn ghost" : "btn";
    show("s-sj-start");
  },
  async host(){
    const name = needName(); if(!name) return;
    $("sjHost").disabled = true;
    try{
      const { url, ips } = await openRoomServer(name, "❓");
      isHost = true; room = new SJRoom(name); room.ips = ips;
      net = new Link(url, m => room.onServer(m), st => connStatus(st));
      keepAwake(true); room.sync();
    }catch(e){ toast("ما قدرناش نفتحو الغرفة"); }
    $("sjHost").disabled = false;
  },
  left(){ this.state = null; },
  send(d){ if(isHost && room) room.action(room.player(myId), d); else if(net) net.send({ d }); },
  me(){ return this.state && this.state.players.find(p => p.id === myId); },
  onState(s){ const prev = this.state; this.state = s; this.recvAt = Date.now(); this.render(false, prev); },
  render(force, prev){
    const s = this.state; if(!s) return;
    if(s.phase === "lobby"){ if(!$("s-sj-lobby").classList.contains("on")) show("s-sj-lobby"); return this.renderLobby(s, force); }
    if(!$("s-sj-game").classList.contains("on")) show("s-sj-game");
    this.renderGame(s, prev);
  },
  renderLobby(s, force){
    document.querySelectorAll("#s-sj-lobby .host-only").forEach(e => e.classList.toggle("hidden", !isHost));
    document.querySelectorAll("#s-sj-lobby .guest-only").forEach(e => e.classList.toggle("hidden", isHost));
    const host = s.players.find(p => p.host);
    $("sjRoomChip").textContent = "❓ غرفة " + (host ? host.name : "");
    $("sjCodeBox").classList.toggle("hidden", !isHost || !s.ips.length);
    $("sjCode").textContent = s.ips.join("  •  ");
    const link = isHost && webLinks[0];
    $("sjWebBox").classList.toggle("hidden", !link);
    if(link && $("sjLink").textContent !== link){
      $("sjLink").textContent = link;
      try{ const q = qrcode(0, "M"); q.addData(link); q.make(); $("sjQr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }catch(e){}
    }
    const st = s.settings;
    const teamBox = t => s.players.filter(p => p.team === t).map(p => `<div class="pl" data-pid="${p.id}">${avatarHTML(p.id, p.name)}<span class="n">${esc(p.name)}${p.id === myId ? " (أنت)" : ""}</span>${isHost ? `<button class="kick" data-swap="${p.id}">⇄</button>` : ""}</div>`).join("") || `<div class="small">ما كاين حتى واحد</div>`;
    $("sjTeams").innerHTML = [0, 1].map(t => `<div class="sj-team" style="border-color:${SJ_TEAMC[t]}"><div class="label" style="color:${SJ_TEAMC[t]}">${esc(st.names[t])}</div><div class="plist">${teamBox(t)}</div></div>`).join("") +
      `<div class="sj-team judge"><div class="label">👑 الحكم (يشوف الجواب)</div><div class="plist">${teamBox(-1)}</div></div>`;
    if(isHost) $("sjTeams").querySelectorAll("[data-swap]").forEach(b => b.onclick = () => room.setTeam(b.dataset.swap));
    // الفئات
    const sel = st.cats;
    $("sjCats").innerHTML = SJ_CATS.map(c => `<button class="cat ${sel.includes(c.id) ? "sel" : ""}" data-id="${c.id}"><span class="ic">${c.icon}</span><span class="nm">${esc(c.name)}</span></button>`).join("");
    $("sjCats").classList.toggle("readonly", !isHost);
    $("sjCatInfo").textContent = sel.length === 6 ? "✔ 6 فئات" : `${sel.length}/6 — الباقي يتختار عشوائياً`;
    if(isHost) $("sjCats").querySelectorAll(".cat").forEach(b => b.onclick = () => room.setSettings(x => { const id = b.dataset.id; if(x.cats.includes(id)) x.cats = x.cats.filter(y => y !== id); else if(x.cats.length < 6) x.cats.push(id); else toast("6 فئات برك"); }));
    const dis = isHost ? "" : "disabled";
    $("sjSet").innerHTML = `<div class="label">⏱️ وقت الجواب</div><div class="pick-row">${[30, 45, 60, 90].map(v => `<button ${dis} class="${st.timer === v ? "on" : ""}" data-t="${v}">${v}ث</button>`).join("")}</div>
      <div class="row set-row"><div><div class="label">🛟 وسائل المساعدة</div><div class="small">✌️ جوابين • 🕳️ الحفرة • ⏱️ وقت زايد (مرة وحدة لكل فريق)</div></div><button ${dis} class="toggle ${st.helpers ? "on" : ""}" id="sjHelpT"></button></div>`;
    if(isHost){ $("sjSet").querySelectorAll("[data-t]").forEach(b => b.onclick = () => room.setSettings(x => x.timer = +b.dataset.t)); $("sjHelpT").onclick = () => room.setSettings(x => x.helpers = !x.helpers); }
    const a = s.players.filter(p => p.team === 0).length, b = s.players.filter(p => p.team === 1).length;
    $("sjStart").disabled = !(a && b);
    $("sjStart").textContent = a && b ? "ابدأ سين جيم ▶" : "لازم لاعب على الأقل في كل فريق";
  },
  timeLeft(){ const q = this.state && this.state.q; return q ? Math.max(0, q.timeLeft - (Date.now() - this.recvAt)) : 0; },
  renderGame(s, prev){
    const me = this.me(), judge = me && me.host, myTeam = me ? me.team : -1;
    $("sjScores").innerHTML = s.teams.map((t, i) => `<div class="sj-score ${s.turn === i && s.phase === "board" ? "turn" : ""}" style="--tc:${SJ_TEAMC[i]}"><b>${t.score}</b><span>${esc(t.name)}</span>
      <div class="sj-helps">${Object.entries(SJ_HELP).map(([k, [ic]]) => `<i class="${t.help[k] && s.settings.helpers ? "" : "used"}">${ic}</i>`).join("")}</div></div>`).join("");
    const board = $("sjBoard"), qv = $("sjQ"), over = $("sjOver");
    board.classList.toggle("hidden", s.phase !== "board");
    qv.classList.toggle("hidden", s.phase !== "q");
    over.classList.toggle("hidden", s.phase !== "over");
    if(s.phase === "board"){
      const canPick = judge || myTeam === s.turn;
      $("sjTurn").innerHTML = `${canPick ? "👆 " : "⏳ "}دور <b style="color:${SJ_TEAMC[s.turn]}">${esc(s.teams[s.turn].name)}</b> يختار سؤال`;
      board.querySelector(".sj-grid").innerHTML = s.board.map((col, c) => `<div class="sj-col"><div class="sj-ch"><span>${col.icon}</span>${esc(col.name)}</div>${col.cells.map((cell, i) =>
        `<button class="sj-cell ${cell.done !== null ? "done" : ""}" ${cell.done !== null || !canPick ? "disabled" : ""} data-c="${c}" data-i="${i}" style="${cell.done !== null && cell.done >= 0 ? `background:${SJ_TEAMC[cell.done]}55` : ""}">${cell.done === null ? cell.pts : cell.done >= 0 ? "✔" : "✖"}</button>`).join("")}</div>`).join("");
      board.querySelectorAll(".sj-cell:not([disabled])").forEach(b => b.onclick = () => { vibe(12); this.send({ a: "pick", c: +b.dataset.c, i: +b.dataset.i }); });
      // نتيجة السؤال اللي فات
      if(s.last && (!prev || !prev.last || prev.last.seq !== s.last.seq)){
        const L = s.last;
        toast(L.team >= 0 ? `✅ ${s.teams[L.team].name} +${L.pts}${L.pit ? " 🕳️ والآخرين −" + L.pts : ""}${L.steal ? " (سرقة!)" : ""}` : `❌ حتى واحد — الجواب: ${L.a}`);
        if(L.team >= 0 && L.team === myTeam) confetti();
      }
    }
    if(s.phase === "q"){
      const q = s.q, isTurnTeam = myTeam === q.team, other = 1 - q.team;
      $("sjQCat").innerHTML = `${q.icon} ${esc(q.cat)} • <b>${q.pts}</b>`;
      $("sjQText").textContent = q.text;
      $("sjQWho").innerHTML = q.stage === "steal" ? `↪️ فرصة <b style="color:${SJ_TEAMC[other]}">${esc(s.teams[other].name)}</b> (سرقة)` : `🎯 يجاوب <b style="color:${SJ_TEAMC[q.team]}">${esc(s.teams[q.team].name)}</b>`;
      $("sjQUsed").innerHTML = q.used.map(h => `<span class="chip">${SJ_HELP[h][0]} ${SJ_HELP[h][1]}</span>`).join(" ");
      const t = s.teams[q.team], canHelp = s.settings.helpers && q.stage === "main" && (isTurnTeam || judge);
      $("sjHelpers").innerHTML = canHelp ? Object.entries(SJ_HELP).map(([k, [ic, nm]]) => `<button class="sj-help" ${t.help[k] ? "" : "disabled"} data-h="${k}">${ic}<small>${nm}</small></button>`).join("") : "";
      $("sjHelpers").querySelectorAll("[data-h]").forEach(b => b.onclick = async () => { if(await ask(`تستعمل ${SJ_HELP[b.dataset.h][1]}؟ مرة وحدة برك في اللعبة`)) this.send({ a: "help", h: b.dataset.h }); });
      $("sjAnswer").classList.toggle("hidden", !judge);
      $("sjAnswer").innerHTML = judge ? `<div class="small">الجواب (يشوفو الحكم برك):</div><div class="sj-ans">${esc(q.answer || "")}</div>` : "";
      $("sjJudge").classList.toggle("hidden", !judge);
      $("sjJudge").innerHTML = judge ? (q.stage === "main"
        ? `<button class="btn" data-r="ok">✅ صح</button><button class="btn ghost" data-r="steal">↪️ غالط: للفريق الآخر</button><button class="btn red" data-r="none">❌ حتى واحد</button>`
        : `<button class="btn" data-r="stealok">✅ سرقوها صح</button><button class="btn red" data-r="none">❌ حتى واحد</button>`) : "";
      $("sjJudge").querySelectorAll("[data-r]").forEach(b => b.onclick = () => { vibe(15); this.send({ a: "judge", r: b.dataset.r }); });
      if(!this.timerOn){ this.timerOn = true; const loop = () => { const st = this.state; if(!st || st.phase !== "q"){ this.timerOn = false; return; } const left = this.timeLeft(), tot = st.q.total || 1; $("sjTime").textContent = Math.ceil(left / 1000); $("sjRing").style.background = `conic-gradient(${left < 10000 ? "#ff5d73" : "#ffcf3f"} ${left / tot * 360}deg, rgba(255,255,255,.1) 0)`; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    }
    if(s.phase === "over"){
      const [a, b] = s.teams, win = a.score === b.score ? -1 : a.score > b.score ? 0 : 1;
      over.innerHTML = `<div class="emoji">${win < 0 ? "🤝" : "🏆"}</div><div class="big">${win < 0 ? "تعادل!" : `ربح <span style="color:${SJ_TEAMC[win]}">${esc(s.teams[win].name)}</span>`}</div>
        <div class="sj-final">${s.teams.map((t, i) => `<div style="--tc:${SJ_TEAMC[i]}"><b>${t.score}</b><span>${esc(t.name)}</span></div>`).join("")}</div>
        ${judge ? `<button class="btn" id="sjAgain">لعبة جديدة 🔁</button><button class="btn ghost" id="sjToLobby">رجوع للغرفة</button>` : `<div class="wait">⏳ في انتظار القائد…</div>`}`;
      if(win === myTeam && (!prev || prev.phase !== "over")) confetti();
      if(judge){ $("sjAgain").onclick = () => room.start(); $("sjToLobby").onclick = () => { room.phase = "lobby"; room.sync(); }; }
    }
  }
};
$("sjHost").onclick = () => SJ.host();
$("sjJoin").onclick = () => { openWifi(); $("wJoin").click(); };
$("sjLeave").onclick = async () => { if(await ask(isHost ? "تسكّر الغرفة؟" : "تخرج من اللعبة؟")) leaveRoom(true); };
document.querySelectorAll(".sjLeave2").forEach(b => b.onclick = () => $("sjLeave").click());
$("sjStart").onclick = () => room && room.start && room.start();
$("sjCode").onclick = () => copyCode(SJ.state);
$("sjCopy").onclick = () => copyCode(SJ.state);
$("sjInvite").onclick = () => sendInvite(SJ.state, "سين جيم ❓");
$("sjEnd").onclick = async () => { if(isHost && await ask("تكمّل اللعبة دوك وتشوفو النتيجة؟")) SJ.send({ a: "end" }); };
