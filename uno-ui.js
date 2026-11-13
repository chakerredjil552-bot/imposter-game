"use strict";
/* ============================================================
   أونو — الواجهة (عند كل لاعب): الغرفة، الطاولة، الرسوم المتحركة
   ============================================================ */
const ORIENT = NATIVE ? getPlugin("ScreenOrientation") : null;
const UNO_SYM = { skip: "⊘", rev: "⇄", d2: "+2", d4: "+4", skipall: "⊘⊘", discall: "🗑", w: "★", w4: "+4", wr4: "⇄4", w6: "+6", w10: "+10", wroul: "🎡", d1: "+1", d5: "+5", flip: "⟲", wd2: "+2", wdc: "+🎨" };
const UNO_KNAME = { skip: "تخطّي", rev: "عكس", d2: "+2", d4: "+4", skipall: "تخطّي الكل", discall: "رمي الكل", w: "جوكر", w4: "جوكر +4", wr4: "عكس +4", w6: "جوكر +6", w10: "جوكر +10", wroul: "روليت الألوان", d1: "+1", d5: "+5", flip: "فليب", wd2: "جوكر +2", wdc: "اسحب اللون" };
const UNO_HEX = { r: "#ef3b4c", y: "#f7c21a", g: "#2fbf5c", b: "#2e7fe8", p: "#ff4fa8", t: "#15c2bd", o: "#ff8a1f", v: "#8a4ff0" };
const UNO_MODES = { classic: "عادي", nomercy: "بلا رحمة 💀", flip: "فليب ⟲" };
const DARK_COLORS = ["p", "t", "o", "v"];

function unoCardHTML(f, extra = "", style = ""){
  if(!f) return `<div class="uc back ${extra}" style="${style}"><div class="mid"><span class="sym">أونو</span></div></div>`;
  const wild = f.k[0] === "w", s = f.k === "n" ? String(f.v) : UNO_SYM[f.k], small = s.length > 2 ? "sm" : "";
  const dk = wild && UNO.state && UNO.state.side === "D" ? "dk" : "";
  return `<div class="uc ${wild ? "wild " + dk : "c-" + f.c} ${extra}" data-id="${f.id || ""}" style="${style}"><span class="cor a">${s}</span><div class="mid"><span class="sym ${small}">${s}</span></div><span class="cor b">${s}</span></div>`;
}

const UNO = {
  state: null, lastSeq: 0, sel: [], sortBy: store.get("unoSort", "color"), shownRound: -1, pendingRects: null,

  openStart(){
    currentGame = "uno";
    $("unoHello").textContent = profile ? profile.nick : "";
    $("unoHost").classList.toggle("hidden", !CAN_LEAD);
    $("unoWebNote").classList.toggle("hidden", CAN_LEAD);
    $("unoJoin").className = CAN_LEAD ? "btn ghost" : "btn";
    show("s-uno-start");
  },
  async host(){
    const name = needName(); if(!name) return;
    $("unoHost").disabled = true;
    try{
      const { url, ips } = await openRoomServer(name, "🃏");
      isHost = true; room = new UnoRoom(name); room.ips = ips;
      net = new Link(url, m => room.onServer(m), st => connStatus(st));
      keepAwake(true);
      room.sync();
    }catch(e){ toast("ما قدرناش نفتحو الطاولة. تأكد من الواي فاي"); }
    $("unoHost").disabled = false;
  },
  left(){
    this.state = null; this.lastSeq = 0; this.sel = []; this.shownRound = -1;
    this.lockOrientation(false);
    $("utModal").innerHTML = "";
  },
  lockOrientation(landscape){
    if(!ORIENT) return;
    try{ ORIENT.lock({ orientation: landscape ? "landscape" : "portrait" }).catch(() => {}); }catch(e){}
  },
  me(){ return this.state && this.state.players.find(p => p.id === myId); },
  send(d){ if(isHost && room) room.action(room.player(myId), d); else if(net) net.send({ d }); },

  // ---------- الحالة ----------
  onState(s){
    const prev = this.state; this.state = s; this.recvAt = Date.now();
    if(s.phase === "lobby"){
      this.lockOrientation(false);
      if(!$("s-uno-lobby").classList.contains("on")) show("s-uno-lobby");
      return this.renderLobby(s);
    }
    if(!$("s-uno-table").classList.contains("on")){ show("s-uno-table"); this.lockOrientation(true); this.startBg(); }
    if(this.shownRound !== s.round){ this.shownRound = s.round; this.lastSeq = 0; this.sel = []; $("utModal").innerHTML = ""; }
    this.render(false, prev);
  },
  render(force, prev){
    const s = this.state; if(!s) return;
    if(s.phase === "lobby") return this.renderLobby(s, force);
    const newEvents = (s.events || []).filter(e => e.seq > this.lastSeq);
    this.lastSeq = s.seq || this.lastSeq;
    this.renderTable(s, force);
    this.playEvents(newEvents, s);
  },

  // ---------- الغرفة قبل اللعب ----------
  renderLobby(s, force){
    document.querySelectorAll("#s-uno-lobby .host-only").forEach(e => e.classList.toggle("hidden", !isHost));
    document.querySelectorAll("#s-uno-lobby .guest-only").forEach(e => e.classList.toggle("hidden", isHost));
    const host = s.players.find(p => p.host);
    $("unoRoomChip").textContent = "🃏 طاولة " + (host ? host.name : s.roomName);
    const online = s.players.filter(p => p.online).length, maxP = s.settings.maxPlayers;
    $("unoCount").textContent = `👥 ${online}/${maxP}`;
    $("unoCodeBox").classList.toggle("hidden", !isHost || !s.ips.length);
    $("unoCode").textContent = s.ips.join("  •  ");
    const link = isHost && webLinks[0];
    $("unoWebBox").classList.toggle("hidden", !link);
    if(link && $("unoLink").textContent !== link){
      $("unoLink").textContent = link;
      try{ const q = qrcode(0, "M"); q.addData(link); q.make(); $("unoQr").innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }catch(e){}
    }
    $("unoPInfo").textContent = online < 2 ? "لازم 2 على الأقل" : `${online} لاعبين`;
    const key = isHost + "|" + s.players.map(p => p.id + p.online + p.name + (pfpCache[p.id] ? 1 : 0) + p.watch).join("|");
    const list = $("unoPlayers");
    if(force || list.dataset.key !== key){
      list.dataset.key = key;
      list.innerHTML = s.players.map(p => `<div class="pl ${p.online ? "" : "off"}">${avatarHTML(p.id, p.name)}
        <span class="n">${esc(p.name)}${p.id === myId ? " (أنت)" : ""}<span class="stats-mini">${p.watch ? "👀 يتفرج (الطاولة عامرة)" : ""}</span></span>
        <span class="tag">${p.host ? "👑 القائد" : ""}</span>${isHost && !p.host ? `<button class="kick" data-kick="${p.id}">✕</button>` : ""}</div>`).join("");
      list.querySelectorAll("[data-kick]").forEach(b => b.onclick = async () => { const p = s.players.find(x => x.id === b.dataset.kick); if(p && await ask(`تخرّج ${p.name}؟`)) room.kick(p.id); });
    }
    this.renderSettings(s.settings);
    $("unoStart").disabled = online < 2;
    $("unoStart").textContent = online < 2 ? "في انتظار اللاعبين… (2 على الأقل)" : `ابدأ أونو مع ${Math.min(online, maxP)} لاعبين ▶`;
  },
  renderSettings(st){
    const ed = isHost, dis = ed ? "" : "disabled";
    const pick = (key, opts) => `<div class="pick-row">${opts.map(([v, l]) => `<button ${dis} class="${st[key] === v ? "on" : ""}" data-set="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
    const tog = (key, label, note) => `<div class="row set-row"><div><div class="label">${label}</div>${note ? `<div class="small">${note}</div>` : ""}</div><button ${dis} class="toggle ${st[key] ? "on" : ""}" data-tog="${key}"></button></div>`;
    const step = (key, label, min, max, fmt) => `<div class="row set-row"><div class="label">${label}</div><div class="stepper"><button ${dis} data-step="${key}" data-d="1" data-min="${min}" data-max="${max}">+</button><b>${fmt ? fmt(st[key]) : st[key]}</b><button ${dis} data-step="${key}" data-d="-1" data-min="${min}" data-max="${max}">−</button></div></div>`;
    $("unoSettings").innerHTML = `
      <div class="label">🎮 نوع اللعبة</div>${pick("mode", [["classic", "عادي"], ["nomercy", "بلا رحمة 💀"], ["flip", "فليب ⟲"]])}
      <div class="set-note">${st.mode === "nomercy" ? "168 كارطة: +6، +10، عكس +4، روليت، تخطّي الكل، رمي الكل" : st.mode === "flip" ? "جهة فاتحة (+1، جوكر +2) وجهة مظلمة (+5، تخطّي الكل، اسحب اللون)" : "الأونو الكلاسيكي: +2، +4، تخطّي، عكس، جوكر"}</div>
      <div class="label" style="margin-top:12px">🔥 قداش اللعبة عدوانية</div>${pick("aggr", [[0.5, "هادية"], [1, "عادية"], [1.8, "عدوانية"], [3, "جنون 🔥"]])}
      ${step("start", "🃏 كارطات البداية", 3, 15)}
      ${step("maxPlayers", "👥 أكثر عدد لاعبين", 2, 16)}
      ${step("limit", "💀 حد الكارطات (اللي يفوتو يخرج)", 0, 60, v => v ? v : "بلا حد")}
      <div class="label" style="margin-top:12px">⏱️ وقت كل لاعب</div>${pick("timer", [[0, "بلا"], [10, "10ث"], [15, "15ث"], [20, "20ث"], [30, "30ث"], [45, "45ث"]])}
      ${tog("stack", "📚 التكديس (+2 فوق +2…)", "ما تقدرش تحط رقم صغير فوق رقم كبير")}
      ${tog("plus4on2", "⬆️ +4 السوداء فوق +2", "إذا مطفي: غير +4 من نفس اللون")}
      ${tog("challenge", "⚔️ التحدي على الكارطة السوداء", "إذا كان عندو اللون اللي قبل، هو اللي ياكلها")}
      ${tog("rule70", "🔄 قانون 7 و 0", "7: تبدّل كارطاتك • 0: الكل يعطي كارطاتو")}
      ${tog("multi", "🃏🃏 تحط كارطات نفس الرقم مع بعض", "و كارطات التخطّي: يتخطاو عدد اللاعبين")}
      ${tog("drawUntil", "🎣 تسحب حتى تلقى كارطة تلعبها")}
      ${tog("teams", "🤝 فرق (2 و 2)", "الشريك يشوف كارطات شريكو، ويربحو مع بعض")}`;
    if(!ed) return;
    $("unoSettings").querySelectorAll("[data-set]").forEach(b => b.onclick = () => { const k = b.dataset.set, v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; room.setSettings(s => s[k] = v); });
    $("unoSettings").querySelectorAll("[data-tog]").forEach(b => b.onclick = () => room.setSettings(s => s[b.dataset.tog] = !s[b.dataset.tog]));
    $("unoSettings").querySelectorAll("[data-step]").forEach(b => b.onclick = () => room.setSettings(s => { const k = b.dataset.step; s[k] = Math.min(+b.dataset.max, Math.max(+b.dataset.min, s[k] + (+b.dataset.d) * (k === "limit" ? 5 : 1))); }));
  },

  // ---------- الطاولة ----------
  sortHand(hand){
    const cOrder = s => "rygbptov".indexOf(s.c || "z"), kOrder = f => f.k === "n" ? f.v : 10 + Object.keys(UNO_SYM).indexOf(f.k);
    const h = hand.slice();
    if(this.sortBy === "color") h.sort((a, b) => (a.k[0] === "w") - (b.k[0] === "w") || cOrder(a) - cOrder(b) || kOrder(a) - kOrder(b));
    else h.sort((a, b) => (a.k[0] === "w") - (b.k[0] === "w") || kOrder(a) - kOrder(b) || cOrder(a) - cOrder(b));
    return h;
  },
  renderTable(s, force){
    const me = this.me(), myTurn = s.turn === myId && s.phase === "play";
    $("s-uno-table").classList.toggle("dark", s.side === "D");
    $("utMode").textContent = "🃏 " + UNO_MODES[s.mode];
    $("utSide").textContent = s.mode === "flip" ? (s.side === "D" ? "🌑 الجهة المظلمة" : "☀️ الجهة الفاتحة") : (s.settings.limit ? `💀 حد ${s.settings.limit}` : "♾️ بلا حد");
    // اللاعبين الآخرين بالترتيب من بعدي
    const order = (s.order || []).filter(Boolean), mi = order.indexOf(myId);
    const others = mi >= 0 ? order.slice(mi + 1).concat(order.slice(0, mi)) : order;
    const left = this.timeLeft(), total = s.timeTotal || 1;
    $("utOpps").innerHTML = others.map(id => {
      const p = s.players.find(x => x.id === id); if(!p) return "";
      const turn = s.turn === id && s.phase === "play", mate = s.settings.teams && me && p.team === me.team;
      const ring = turn && s.timeLeft ? `<div class="ring" style="background:conic-gradient(var(--accent) ${left / total * 360}deg,transparent 0);-webkit-mask:radial-gradient(circle,transparent 21px,#000 22px);mask:radial-gradient(circle,transparent 21px,#000 22px)"></div>` : "";
      const fan = Array.from({ length: Math.min(p.n, 9) }, () => "<i></i>").join("");
      const teamDot = s.settings.teams && p.team !== null ? `<span class="tdot" style="background:${["#ffcf3f", "#3fe0a5", "#ff8da0", "#6fd3ff", "#9d8bff", "#ffa95c", "#c6f26b", "#f39cff"][p.team % 8]}"></span>` : "";
      const lim = s.settings.limit;
      return `<div class="opp ${turn ? "turn" : ""} ${p.out ? "out" : ""} ${p.online ? "" : "off"} ${mate ? "mate" : ""}" data-pid="${id}">${ring}${avatarHTML(p.id, p.name)}${teamDot}
        <span class="cnt ${lim && p.n >= lim - 3 ? "warn" : p.n <= 1 ? "warn" : ""}">${p.out ? "💀" : p.n}</span>
        <span class="nm">${esc(p.name)}</span><div class="fan">${fan}</div>
        ${p.uno && p.n <= 2 ? `<span class="badge uno">أونو!</span>` : ""}
        ${p.catchable ? `<button class="catch" data-catch="${id}">📢 امسكو +2</button>` : ""}</div>`;
    }).join("");
    $("utOpps").querySelectorAll("[data-catch]").forEach(b => b.onclick = e => { e.stopPropagation(); this.send({ a: "catch", id: b.dataset.catch }); vibe(30); });
    // الكومة
    const disc = s.discard || [];
    $("utPile").innerHTML = disc.map((f, i) => { const r = ((f.id * 47) % 50) - 25, x = ((f.id * 31) % 16) - 8; return unoCardHTML(f, "", `transform:translate(${x}px,${(f.id * 13) % 10 - 5}px) rotate(${r}deg);z-index:${i}`); }).join("");
    const col = UNO_HEX[s.color] || "#fff";
    $("utGlow").style.boxShadow = `0 0 60px 20px ${col}aa, inset 0 0 40px ${col}88`;
    $("utGlow").style.background = `radial-gradient(circle, ${col}33, transparent 65%)`;
    $("utDir").classList.toggle("ccw", s.dir < 0);
    $("utPend").classList.toggle("hidden", !s.pending);
    $("utPend").textContent = "+" + s.pending;
    // الباكو
    if(!$("utDeck").dataset.built){ $("utDeck").dataset.built = 1; $("utDeck").insertAdjacentHTML("afterbegin", [0, 1, 2, 3].map(i => unoCardHTML(null, s.side === "D" ? "dk" : "", `transform:translate(${-i * 2}px,${-i * 2}px)`)).join("")); }
    $("utDeck").querySelectorAll(".uc").forEach(c => c.classList.toggle("dk", s.side === "D"));
    const canAct = myTurn && !s.pick;
    const playable = new Set(s.playable || []);
    const noneToPlay = canAct && !playable.size && !s.drew;
    $("utDeck").classList.toggle("hint", noneToPlay || (canAct && s.pending > 0 && !playable.size));
    $("utDeckLbl").classList.toggle("hidden", !(noneToPlay || (canAct && s.pending > 0)));
    $("utDeckLbl").textContent = s.pending > 0 && canAct ? `👆 اسحب +${s.pending}` : "👆 اسحب كارطة";
    // يدي
    this.renderHand(s, playable, canAct, force);
    // الأزرار
    const n = me ? me.n : 0;
    $("utUno").classList.toggle("ready", !!me && n <= 2 && n > 0 && !me.uno);
    $("utUno").textContent = me && me.uno && n <= 2 ? "✔ أونو" : "أونو!";
    $("utChallenge").classList.toggle("hidden", !(canAct && s.canChallenge));
    $("utTake").classList.toggle("hidden", !(canAct && (s.pending > 0 || (!s.drew && !playable.size))));
    $("utTake").textContent = s.pending > 0 ? `🃏 اسحب +${s.pending}` : "🃏 اسحب";
    $("utPass").classList.toggle("hidden", !(canAct && s.drew));
    this.updatePlayBtn();
    // رسالة الدور
    const tp = s.players.find(p => p.id === s.turn);
    const msg = $("utTurnMsg");
    if(s.phase === "over") msg.textContent = "🏁 اللعبة كملت";
    else if(me && me.out) msg.textContent = "💀 خرجت! فتّ حد الكارطات… تفرّج";
    else if(me && !me.inGame) msg.textContent = "👀 راك تتفرج، تدخل في الجولة الجاية";
    else if(myTurn) msg.textContent = s.pick ? (s.pick.type === "seven" ? "🔄 اختار مع شكون تبدّل" : "🎡 اختار لون") : s.pending ? (s.canChallenge ? `⚔️ تحدّى ولا اسحب +${s.pending}` : playable.size ? `📚 كدّس ولا اسحب +${s.pending}` : `🃏 لازم تسحب +${s.pending}`) : playable.size ? "🔥 دورك! اختار كارطة" : "🃏 ما عندك والو… اسحب";
    else msg.textContent = tp ? `⏳ دور ${tp.name}` : "";
    msg.classList.toggle("me", myTurn);
    // الشريك
    const mates = s.mates || [];
    const mateNames = mates.map(m => { const p = s.players.find(x => x.id === m.id); return p ? p.name : ""; });
    $("utMateBtn").classList.toggle("hidden", !mates.length);
    $("utMateBtn").classList.toggle("mate-on", !!this.showMates);
    $("utMateBtn").textContent = "🤝 " + mateNames.join("، ");
    const showM = mates.length && this.showMates && s.phase === "play";
    $("utMates").classList.toggle("hidden", !showM);
    if(showM){ const k = JSON.stringify(mates); if(force || $("utMates").dataset.k !== k){ $("utMates").dataset.k = k; $("utMates").innerHTML = mates.map((m, i) => `<b>🤝 كارطات ${esc(mateNames[i])} (${m.hand.length})</b>${this.sortHand(m.hand).map(f => unoCardHTML(f)).join("")}`).join(""); } }
    // نوافذ الاختيار
    this.renderPicks(s, myTurn);
    if(s.phase === "over") this.showResults(s);
  },
  renderHand(s, playable, canAct, force){
    const box = $("utHand"), hand = this.sortHand(s.hand || []);
    this.sel = this.sel.filter(id => hand.some(f => f.id === id));
    // كي تكثر الكارطات بزاف: نجمعو الكارطات المتشابهة في كومة وحدة (×عدد) باش اليد تبقى خفيفة
    const grouped = hand.length > 30;
    let items;
    if(grouped){
      const m = new Map();
      for(const f of hand){ const k = f.k + (f.c || "") + (f.k === "n" ? f.v : ""); if(!m.has(k)) m.set(k, { f, ids: [] }); m.get(k).ids.push(f.id); }
      items = [...m.values()];
    } else items = hand.map(f => ({ f, ids: [f.id] }));
    this.groups = items;
    const W = box.clientWidth || 600, H = box.clientHeight || 150, n = items.length;
    // حساب المقاس: سطر وحد، ولا سطرين/ثلاثة كي تكثر الكارطات
    let rows = 1, cw = Math.min(H / 1.48 * 0.86, 96), step = 0;
    for(rows = 1; rows <= 3; rows++){
      cw = Math.min((H / (1 + (rows - 1) * 0.55)) / 1.48 * 0.9, 96);
      const per = Math.ceil(n / rows);
      step = per > 1 ? Math.min(cw * 1.05, (W - cw - 8) / (per - 1)) : 0;
      if(step >= cw * 0.36 || rows === 3) break;
    }
    const per = Math.ceil(n / rows), minStep = Math.max(step, 16);
    const rowW = per > 1 ? cw + (per - 1) * minStep : cw;
    const key = items.map(it => it.ids.join(".")).join(",") + "|" + rows + "|" + Math.round(cw) + "|" + Math.round(W);
    if(force || box.dataset.key !== key){
      box.dataset.key = key;
      box.innerHTML = `<div style="position:relative;width:${Math.max(W, rowW + 8)}px;height:100%">` + items.map((it, i) => {
        const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per);
        const rw = inRow > 1 ? cw + (inRow - 1) * minStep : cw;
        const x = (Math.max(W, rowW) - rw) / 2 + c * minStep, y = (H - cw * 1.48) - (rows - 1 - r) * cw * 1.48 * 0.55;
        const tilt = (c - (inRow - 1) / 2) * (rows === 1 ? Math.min(2.5, 30 / inRow) : 0);
        const html = unoCardHTML(it.f, it.ids.length > 1 ? "grp" : "", `--cw:${cw}px;left:${x}px;top:${y + Math.abs(tilt) * 1.2}px;transform:rotate(${tilt}deg);z-index:${i + 1}`);
        const out = html.replace('data-id=', `data-g="${i}" data-id=`);
        return it.ids.length > 1 ? out.slice(0, -6) + `<span class="cntb">×${it.ids.length}</span></div>` : out;
      }).join("") + "</div>";
      box.querySelectorAll(".uc").forEach(el => el.onclick = e => {
        if(e.target.closest(".addb")) return this.addFromGroup(+el.dataset.g);
        this.tapCard(+el.dataset.id, +el.dataset.g);
      });
    }
    // تلوين: اللي تقدر تلعبها + الاقتراح
    const sug = this.suggest(s, hand, playable);
    box.querySelectorAll(".uc").forEach(el => {
      const it = items[+el.dataset.g]; if(!it) return;
      const id = it.ids[0], nSel = it.ids.filter(x => this.sel.includes(x)).length;
      el.classList.toggle("ok", canAct && playable.has(id));
      el.classList.toggle("no", canAct && !playable.has(id) && !this.canAddToSel(id, hand));
      el.classList.toggle("sel", nSel > 0);
      const cb = el.querySelector(".cntb"); if(cb) cb.textContent = nSel ? `${nSel}/${it.ids.length}` : "×" + it.ids.length;
      // زر +1: تزيد كارطة أخرى من نفس الكومة
      const add = el.querySelector(".addb"), wantAdd = nSel > 0 && nSel < it.ids.length && this.state.settings.multi;
      if(wantAdd && !add) el.insertAdjacentHTML("beforeend", `<span class="addb">+1</span>`); else if(!wantAdd && add) add.remove();
      const has = el.querySelector(".sug");
      if(canAct && it.ids.includes(sug) && !this.sel.length){ if(!has) el.insertAdjacentHTML("beforeend", `<span class="sug">👆</span>`); }
      else if(has) has.remove();
    });
  },
  addFromGroup(g){
    const s = this.state, it = this.groups && this.groups[g]; if(!s || !it || s.turn !== myId) return;
    const next = it.ids.find(x => !this.sel.includes(x)); if(!next) return;
    if(this.sel.length && !this.canAddToSel(next, s.hand || [])) return;
    this.sel.push(next); vibe(8);
    this.renderHand(s, new Set(s.playable || []), true); this.updatePlayBtn();
  },
  cardEl(id){
    const box = $("utHand"), direct = box.querySelector(`[data-id="${id}"]`); if(direct) return direct;
    const g = (this.groups || []).findIndex(it => it.ids.includes(id));
    return g >= 0 ? box.querySelector(`[data-g="${g}"]`) : null;
  },
  // اقتراح: نفس اللون أولاً، والجوكر في الأخير (ولا كارطة تكديس)
  suggest(s, hand, playable){
    const ok = hand.filter(f => playable.has(f.id)); if(!ok.length) return null;
    const score = f => (f.k[0] === "w" ? 50 : 0) + (f.c === s.color ? 0 : 10) + (f.k === "n" ? 0 : 5) - (s.pending ? (f.k[0] === "w" ? 0 : 20) : 0);
    return ok.sort((a, b) => score(a) - score(b))[0].id;
  },
  canAddToSel(id, hand){
    if(!this.sel.length || !this.state.settings.multi) return false;
    const a = hand.find(f => f.id === this.sel[0]), b = hand.find(f => f.id === id);
    return a && b && a.k === b.k && (a.k !== "n" || a.v === b.v);
  },
  tapCard(id, g){
    const s = this.state; if(!s || s.turn !== myId || s.pick || s.phase !== "play") return;
    const hand = s.hand || [], playable = new Set(s.playable || []);
    vibe(8);
    // كومة: إذا فيها كارطة مختارة، الضغطة الثانية = العب
    const it = this.groups && this.groups[g];
    if(it && it.ids.length > 1){
      if(it.ids.some(x => this.sel.includes(x))) return this.playSelected();
      id = it.ids[0];
    }
    if(this.sel.includes(id)){
      // ضغطة ثانية على نفس الكارطة = العب
      if(this.sel[this.sel.length - 1] === id) return this.playSelected();
      this.sel = this.sel.filter(x => x !== id);
    } else if(this.sel.length && this.canAddToSel(id, hand)) this.sel.push(id);
    else if(playable.has(id)) this.sel = [id];
    else { toast("ما تقدرش تلعب هذي 🙅"); return; }
    this.renderHand(s, playable, true);
    this.updatePlayBtn();
  },
  updatePlayBtn(){
    const n = this.sel.length;
    $("utPlay").classList.toggle("hidden", !n);
    $("utPlay").textContent = n > 1 ? `العب ${n} ✔` : "العب ✔";
  },
  async playSelected(){
    const s = this.state; if(!this.sel.length) return;
    const hand = s.hand || [], last = hand.find(f => f.id === this.sel[this.sel.length - 1]);
    let color = null;
    if(last && last.k[0] === "w" && last.k !== "wroul") color = await this.pickColor(last.k === "wdc" ? "اختار اللون اللي يسحب عليه 🎨" : "اختار اللون 🎨");
    if(last && last.k[0] === "w" && last.k !== "wroul" && !color) return;
    // نحفظو بلاصة الكارطات باش نطيروهم للكومة
    this.pendingRects = this.sel.map(id => { const el = this.cardEl(id); return el ? { r: el.getBoundingClientRect(), html: el.outerHTML.replace(/<span class="(cntb|addb|sug)">[^<]*<\/span>/g, "") } : null; }).filter(Boolean);
    const ids = this.sel.slice(); this.sel = [];
    // أونو: إذا رايح تبقى بكارطة وحدة وما ضغطتش
    this.send({ a: "play", ids, color });
    vibe(20);
  },
  pickColor(title){
    return new Promise(res => {
      const cols = this.state.side === "D" ? DARK_COLORS : ["r", "y", "g", "b"];
      $("utModal").innerHTML = `<div class="u-modal"><div class="u-box"><h3>${title}</h3><div class="colors4">${cols.map(c => `<button data-c="${c}" style="background:${UNO_HEX[c]}">${UNO_CNAME[c]}</button>`).join("")}</div><button class="link" style="margin-top:14px" data-c="">رجوع</button></div></div>`;
      $("utModal").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { $("utModal").innerHTML = ""; res(b.dataset.c || null); });
    });
  },
  renderPicks(s, myTurn){
    const pick = s.pick, modal = $("utModal");
    const need = myTurn && pick ? pick.type : "";
    if(modal.dataset.need === need + s.seq && need) return;
    if(!need){ if(modal.dataset.need && modal.dataset.need !== "res") { modal.innerHTML = ""; modal.dataset.need = ""; } return; }
    modal.dataset.need = need + s.seq;
    if(need === "seven"){
      const ps = s.players.filter(p => p.inGame && !p.out && p.id !== myId);
      modal.innerHTML = `<div class="u-modal"><div class="u-box"><h3>🔄 7: مع شكون تبدّل كارطاتك؟</h3><div class="plist7">${ps.map(p => `<button data-p="${p.id}">${avatarHTML(p.id, p.name)}<span>${esc(p.name)} • ${p.n} 🃏</span></button>`).join("")}</div></div></div>`;
      modal.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { modal.innerHTML = ""; this.send({ a: "pick7", id: b.dataset.p }); });
    } else if(need === "roul"){
      const cols = s.side === "D" ? DARK_COLORS : ["r", "y", "g", "b"];
      modal.innerHTML = `<div class="u-modal"><div class="u-box"><h3>🎡 روليت! اختار لون… وتسحب حتى يجي</h3><div class="colors4">${cols.map(c => `<button data-c="${c}" style="background:${UNO_HEX[c]}">${UNO_CNAME[c]}</button>`).join("")}</div></div></div>`;
      modal.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { modal.innerHTML = ""; this.send({ a: "roul", color: b.dataset.c }); });
    }
  },
  showResults(s){
    const modal = $("utModal");
    if(modal.dataset.need === "res" + s.round) return;
    modal.dataset.need = "res" + s.round;
    const w = s.winner || {}, winTeam = s.settings.teams && w.team !== null && w.team !== undefined;
    const rows = s.players.filter(p => p.inGame).map(p => ({ p, win: winTeam ? p.team === w.team : p.id === w.id })).sort((a, b) => b.win - a.win || (a.p.out - b.p.out) || a.p.n - b.p.n);
    const iWon = rows.some(r => r.win && r.p.id === myId);
    modal.innerHTML = `<div class="u-modal"><div class="u-box"><h3 style="font-size:30px">${iWon ? "🏆 ربحت!" : "🏁 كملت الجولة"}</h3>
      <div class="u-res">${rows.map((r, i) => `<div class="r ${r.win ? "win" : ""}">${avatarHTML(r.p.id, r.p.name)}<span style="flex:1">${r.win ? "🏆 " : r.p.out ? "💀 " : ""}${esc(r.p.name)}</span><span>${r.p.out ? "خرج" : r.p.n + " 🃏"}</span></div>`).join("")}</div>
      <div style="display:flex;gap:10px;margin-top:14px">${isHost ? `<button class="btn" id="utAgain">جولة جديدة 🔁</button><button class="btn ghost" id="utLobby">الإعدادات</button>` : `<div class="wait" style="flex:1">⏳ في انتظار القائد…</div>`}</div></div></div>`;
    if(iWon){ confetti(); vibe([40, 60, 40]); }
    if(isHost){ $("utAgain").onclick = () => { modal.innerHTML = ""; room.newRound(); }; $("utLobby").onclick = () => { modal.innerHTML = ""; room.toLobby(); }; }
  },
  timeLeft(){ const s = this.state; return s && s.timeLeft ? Math.max(0, s.timeLeft - (Date.now() - this.recvAt)) : 0; },

  // ---------- الرسوم المتحركة ----------
  rectOf(pid){
    if(pid === myId) return $("utHand").getBoundingClientRect();
    const el = $("utOpps").querySelector(`[data-pid="${pid}"]`);
    return el ? el.getBoundingClientRect() : $("utMain").getBoundingClientRect();
  },
  fly(html, from, to, opts = {}){
    const el = document.createElement("div");
    el.className = "ut-fly"; el.innerHTML = html;
    const w = opts.w || 70;
    el.style.left = (from.left + from.width / 2 - w / 2) + "px"; el.style.top = (from.top + from.height / 2 - w * .74) + "px";
    el.firstElementChild.style.setProperty("--cw", w + "px");
    el.firstElementChild.style.position = "relative"; el.firstElementChild.style.left = el.firstElementChild.style.top = "0";
    document.body.appendChild(el);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const rot = opts.rot || (Math.random() * 40 - 20);
    const a = el.animate([
      { transform: `translate(0,0) rotate(0) scale(${opts.s0 || 1})`, opacity: 1 },
      { transform: `translate(${dx * .55}px,${dy * .55 - 40}px) rotate(${rot * .6}deg) scale(${(opts.s1 || 1) * 1.15})`, offset: .6 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${opts.s1 || 1})`, opacity: opts.fade ? 0 : 1 }
    ], { duration: opts.dur || 460, delay: opts.delay || 0, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });
    a.onfinish = () => el.remove();
  },
  banner(text, color = "#fff", big = 1){
    const el = document.createElement("div");
    el.className = "ut-banner"; el.textContent = text; el.style.color = color;
    el.style.fontSize = `min(${15 * big}vh, ${86 * big}px)`;
    $("s-uno-table").appendChild(el);
    const a = el.animate([
      { transform: "translate(-50%,-50%) scale(.2) rotate(-12deg)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(1.15) rotate(3deg)", opacity: 1, offset: .25 },
      { transform: "translate(-50%,-50%) scale(1) rotate(0)", opacity: 1, offset: .7 },
      { transform: "translate(-50%,-60%) scale(1.05)", opacity: 0 }
    ], { duration: 1100, easing: "ease-out", fill: "both" });
    a.onfinish = () => el.remove();
  },
  shake(){ const m = $("utMain"); m.classList.remove("ut-shake"); void m.offsetWidth; m.classList.add("ut-shake"); },
  playEvents(evs, s){
    const pile = $("utPile").getBoundingClientRect(), deck = $("utDeck").getBoundingClientRect();
    const name = id => { const p = s.players.find(x => x.id === id); return p ? p.name : ""; };
    let delay = 0;
    for(const e of evs){
      if(e.t === "play"){
        if(e.p === myId && this.pendingRects){
          this.pendingRects.forEach((pr, i) => this.fly(pr.html.replace("sel", ""), pr.r, pile, { delay: i * 70, w: pr.r.width }));
          this.pendingRects = null;
        } else {
          const from = this.rectOf(e.p);
          e.faces.forEach((f, i) => this.fly(unoCardHTML(f), from, pile, { delay: i * 80, s0: .5 }));
          if(e.p !== myId) vibe(6);
        }
        const f = e.faces[e.faces.length - 1];
        if(e.faces.length > 1) setTimeout(() => this.banner(`×${e.faces.length}`, "#ffcf3f", .8), 300);
        if(f.k[0] === "w" && f.k !== "w") setTimeout(() => this.shake(), 380);
      }
      else if(e.t === "draw"){
        const to = this.rectOf(e.p), k = Math.min(e.n, 7);
        for(let i = 0; i < k; i++) this.fly(unoCardHTML(null, s.side === "D" ? "dk" : ""), deck, to, { delay: delay + i * 70, s1: e.p === myId ? 1 : .4, dur: 420 });
        if(e.n >= 4) setTimeout(() => { this.banner(`+${e.n} لـ ${e.p === myId ? "أنت 😱" : name(e.p)}`, "#ff5d73", .6); if(e.p === myId) vibe([40, 40, 80]); }, 200);
        delay += 120;
      }
      else if(e.t === "attack"){ if(e.to === myId){ this.banner(`+${e.total}!`, "#ff5d73"); vibe([30, 30, 60]); this.shake(); } else this.banner(`+${e.total} ➜ ${name(e.to)}`, "#ff8da0", .55); }
      else if(e.t === "skip"){ this.banner(e.ps.length > 1 ? `⊘ ×${e.ps.length}` : `⊘ ${name(e.ps[0])}`, "#ffcf3f", .7); e.ps.forEach(id => { const el = $("utOpps").querySelector(`[data-pid="${id}"]`); if(el) el.animate([{ transform: "scale(1)" }, { transform: "scale(.8) rotate(-8deg)", filter: "grayscale(1)" }, { transform: "scale(1)" }], { duration: 700 }); }); if(e.ps.includes(myId)) vibe(40); }
      else if(e.t === "skipall") this.banner("⊘⊘ تخطّي الكل!", "#ffcf3f", .7);
      else if(e.t === "rev"){ this.banner("⇄", "#6fd3ff"); $("utDir").animate([{ transform: "rotate(0) scale(1)" }, { transform: `rotate(${e.dir * 540}deg) scale(1.3)` }, { transform: "rotate(0) scale(1)" }], { duration: 900, easing: "ease-in-out" }); }
      else if(e.t === "flip"){ this.banner("FLIP ⟲", e.side === "D" ? "#ff4fa8" : "#ffcf3f"); const m = $("utMain"); m.classList.remove("ut-flipfx"); void m.offsetWidth; m.classList.add("ut-flipfx"); vibe([30, 60, 30]); }
      else if(e.t === "uno"){ const r = this.rectOf(e.p); this.banner(`أونو! ${e.p === myId ? "" : "— " + name(e.p)}`, "#ffcf3f", .7); confettiAt(r); }
      else if(e.t === "forgot" && e.p !== myId) toast(`📢 ${name(e.p)} نسى يقول أونو! امسكو`);
      else if(e.t === "caught") this.banner(e.p === myId ? "😂 تمسكت! +2" : `😂 ${name(e.p)} تمسك +2`, "#ff5d73", .6);
      else if(e.t === "challenge") this.banner(e.ok ? `⚔️ نجح التحدي! ${name(e.by)} ياكل +${e.n}` : `⚔️ فشل التحدي… ${name(e.p)} ياكل +${e.n}`, e.ok ? "#3fe0a5" : "#ff5d73", .45);
      else if(e.t === "swap") this.banner(`🔄 ${name(e.a)} ⇄ ${name(e.b)}`, "#9d8bff", .5);
      else if(e.t === "rotate") this.banner("🔄 الكل يعطي كارطاتو!", "#9d8bff", .5);
      else if(e.t === "discall") this.banner(`🗑 رمى ${e.n} كارطات`, "#3fe0a5", .5);
      else if(e.t === "roul") this.banner(`🎡 ${UNO_CNAME[e.color]}`, UNO_HEX[e.color], .7);
      else if(e.t === "out"){ this.banner(`💀 ${name(e.p)} خرج!`, "#ff5d73", .6); if(e.p === myId) vibe([80, 60, 80]); }
      else if(e.t === "win"){ this.banner("🏆 " + name(e.p), "#ffcf3f"); }
      else if(e.t === "timeout" && e.p === myId) toast("⏰ كمل الوقت!");
      else if(e.t === "deal"){ const k = Math.min(((s.hand || []).length), 10); for(let i = 0; i < k; i++) this.fly(unoCardHTML(null), deck, $("utHand").getBoundingClientRect(), { delay: i * 90, dur: 500 }); }
    }
  },
  // الخلفية: جزيئات تتحرك
  startBg(){
    if(this.bgOn) return; this.bgOn = true;
    const cv = $("utCanvas"), ctx = cv.getContext("2d");
    const dots = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: .02 + Math.random() * .05, c: ["#ffcf3f", "#ff5d73", "#3fe0a5", "#6fd3ff", "#ffffff"][Math.floor(Math.random() * 5)] }));
    const loop = () => {
      if(!$("s-uno-table").classList.contains("on")){ this.bgOn = false; return; }
      const w = cv.width = cv.clientWidth, h = cv.height = cv.clientHeight, t = performance.now() / 1000;
      ctx.clearRect(0, 0, w, h);
      for(const d of dots){
        const y = ((d.y - d.v * t) % 1 + 1) % 1, x = d.x + Math.sin(t * .6 + d.r) * .02;
        ctx.globalAlpha = .25 + .3 * Math.sin(t * 2 + d.r * 3) ** 2; ctx.fillStyle = d.c; ctx.shadowColor = d.c; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x * w, y * h, d.r, 0, 6.283); ctx.fill();
      }
      // الوقت: نحدثو الحلقة والشريط
      const s = this.state;
      if(s && s.phase === "play"){
        const left = this.timeLeft(), total = s.timeTotal || 1;
        $("utBar").style.width = (s.turn === myId && s.timeLeft ? left / total * 100 : 0) + "%";
        const ring = $("utOpps").querySelector(".opp.turn .ring");
        if(ring) ring.style.background = `conic-gradient(var(--accent) ${left / total * 360}deg,transparent 0)`;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
};
function confettiAt(r){ try{ confetti(); }catch(e){} }

// ---------- الأزرار ----------
$("unoHost").onclick = () => UNO.host();
$("unoJoin").onclick = () => { openWifi(); $("wJoin").click(); };
$("unoLeave").onclick = async () => { if(await ask(isHost ? "تسكّر الطاولة؟ كل اللاعبين يخرجو." : "تخرج من الطاولة؟")) leaveRoom(true); };
$("utLeave").onclick = async () => { if(await ask(isHost ? "تسكّر الطاولة؟ كل اللاعبين يخرجو." : "تخرج من اللعبة؟")) leaveRoom(true); };
$("unoStart").onclick = () => room && room.start && room.start();
$("unoCode").onclick = () => copyCode(UNO.state);
$("unoCopy").onclick = () => copyCode(UNO.state);
$("unoInvite").onclick = () => sendInvite(UNO.state, "أونو 🃏");
$("utPlay").onclick = () => UNO.playSelected();
$("utDeck").onclick = () => { const s = UNO.state; if(s && s.turn === myId && !s.pick && !s.drew) { UNO.sel = []; UNO.send({ a: "draw" }); vibe(15); } };
$("utTake").onclick = () => { UNO.sel = []; UNO.send({ a: "draw" }); vibe(15); };
$("utPass").onclick = () => UNO.send({ a: "pass" });
$("utChallenge").onclick = async () => { if(await ask("تتحدّى؟ إذا كان عندو اللون اللي قبل هو ياكلها… وإلا انت تاكل +2 زايدين")) UNO.send({ a: "challenge" }); };
$("utUno").onclick = () => { UNO.send({ a: "uno" }); vibe(25); };
$("utMateBtn").onclick = () => { UNO.showMates = !UNO.showMates; UNO.render(true); };
$("utMates").onclick = () => { UNO.showMates = false; UNO.render(true); };
$("utSortC").onclick = () => { UNO.sortBy = "color"; store.set("unoSort", "color"); UNO.render(true); };
$("utSortN").onclick = () => { UNO.sortBy = "num"; store.set("unoSort", "num"); UNO.render(true); };
window.addEventListener("resize", () => { if(UNO.state && UNO.state.phase !== "lobby") UNO.render(true); });
