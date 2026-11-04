/* 포켓몬 카톡 테마 만들기
   타입별 기본 테마(.ktheme)를 받아, 올린 사진으로 말풍선, 친구 목록 배경, 잠금 동그라미를 바꿔 다시 묶는다.
   사진은 기기 밖으로 나가지 않는다. */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const state = { types: [], type: null, zipBuf: {}, sprites: { me: null, friend: null }, assets: null };
const PT = 1.5;                      // 미리보기: 1pt = 1.5px (배경 600px @2x = 300pt 폭 -> 450px)

/* ---------- 공통 ---------- */
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const blobOf = (c) => new Promise((ok) => c.toBlob(ok, 'image/png'));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* 그림을 상자 안에 비율 유지로 넣는다. 아래쪽 가운데 정렬. 작은 도트 그림은 뭉개지지 않게 키운다 */
function drawFit(ctx, src, x, y, w, h, align = 'bottom') {
  const s = Math.min(w / src.width, h / src.height), dw = src.width * s, dh = src.height * s;
  ctx.imageSmoothingEnabled = s < 2.2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, x + (w - dw) / 2, align === 'bottom' ? y + h - dh : y + (h - dh) / 2, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

/* ---------- 1단계: 타입 ---------- */
async function initTypes() {
  state.types = await (await fetch('types.json')).json();
  const box = $('#types');
  state.types.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'type'; b.dataset.key = t.key;
    b.innerHTML = `<img src="thumb-${t.key}.jpg" alt=""><span>${t.name}</span>`;
    b.onclick = () => pickType(t.key);
    box.appendChild(b);
  });
  pickType('fire');
}
async function pickType(key) {
  state.type = state.types.find((t) => t.key === key);
  document.querySelectorAll('.type').forEach((b) => b.classList.toggle('on', b.dataset.key === key));
  document.documentElement.style.setProperty('--accent', state.type.main);
  const [r, g, b] = hexRgb(state.type.main);
  $('#ambient').style.background = `radial-gradient(40% 30% at 15% 10%, rgba(${r},${g},${b},.55), transparent 70%), radial-gradient(45% 35% at 90% 85%, rgba(${r},${g},${b},.35), transparent 70%), var(--bg)`;
  state.assets = null;
  try {
    if (!state.zipBuf[key]) state.zipBuf[key] = await (await fetch(`theme-${key}.ktheme`)).arrayBuffer();
    const zip = await JSZip.loadAsync(state.zipBuf[key]);
    const names = ['chatroomBgImage@2x', 'mainBgImage@2x', 'mainBgImage@3x', 'passcodeBgImage@2x', 'chatroomBubbleSend01@3x', 'chatroomBubbleReceive01@3x',
      'profileImg01@3x', 'maintabIcoFriendsSelected@3x', 'maintabIcoChats@3x', 'maintabIcoBrowse@3x', 'maintabIcoShopping@3x'];
    const a = {};
    await Promise.all(names.map(async (n) => {
      const blob = await zip.file(`Images/${n}.png`).async('blob');
      a[n] = await loadImg(URL.createObjectURL(blob));
    }));
    if (state.type.key !== key) return;            // 그 사이 다른 타입을 눌렀으면 버림
    state.assets = a;
  } catch (e) { toast('테마를 불러오지 못했습니다'); console.error(e); }
  render();
}

/* ---------- 2단계: 사진과 배경 지우기 ---------- */
const MAXSIDE = 480;
function setupSlot(slot) {
  const who = slot.dataset.who, box = $('.canvasbox', slot), cv = $('canvas', box), input = $('input', slot);
  const eraseBtn = $('.erase', slot), undoBtn = $('.undo', slot);
  const ed = { work: null, undo: [], erasing: false };
  const show = () => {
    cv.width = ed.work.width; cv.height = ed.work.height;
    cv.getContext('2d').drawImage(ed.work, 0, 0);
    $('.empty', box).style.display = 'none';
    undoBtn.disabled = ed.undo.length === 0; eraseBtn.disabled = false;
    state.sprites[who] = trim(ed.work);
    render();
  };
  const snapshot = () => { const d = ed.work.getContext('2d').getImageData(0, 0, ed.work.width, ed.work.height); ed.undo.push(d); if (ed.undo.length > 12) ed.undo.shift(); };
  box.onclick = (e) => {
    if (!ed.work || !ed.erasing) { input.click(); return; }
    const r = cv.getBoundingClientRect(), s = Math.min(r.width / cv.width, r.height / cv.height);
    const ox = (r.width - cv.width * s) / 2, oy = (r.height - cv.height * s) / 2;
    const x = Math.floor((e.clientX - r.left - ox) / s), y = Math.floor((e.clientY - r.top - oy) / s);
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return;
    snapshot();
    const n = floodErase(ed.work, [[x, y]]);
    if (!n) { ed.undo.pop(); toast('이미 지워진 자리입니다'); return; }
    show();
  };
  eraseBtn.onclick = () => { ed.erasing = !ed.erasing; eraseBtn.classList.toggle('on', ed.erasing); box.classList.toggle('erasing', ed.erasing); if (ed.erasing) toast('지울 부분을 눌러 주십시오'); };
  undoBtn.onclick = () => { const d = ed.undo.pop(); if (!d) return; ed.work.getContext('2d').putImageData(d, 0, 0); show(); };
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    const img = await loadImg(URL.createObjectURL(f));
    const s = Math.min(1, MAXSIDE / Math.max(img.width, img.height));
    ed.work = canvas(img.width * s, img.height * s);
    const ctx = ed.work.getContext('2d'); ctx.imageSmoothingEnabled = s < 1; ctx.drawImage(img, 0, 0, ed.work.width, ed.work.height);
    ed.undo = [];
    autoRemove(ed.work);
    show();
    input.value = '';
  };
}

/* 가장자리에서 시작해 비슷한 색을 따라 번지며 지운다 (배경 지우기) */
function floodErase(cv, seeds, tolStep = 26, tolSeed = 64) {
  const w = cv.width, h = cv.height, ctx = cv.getContext('2d'), img = ctx.getImageData(0, 0, w, h), d = img.data;
  const seen = new Uint8Array(w * h), sr = new Uint8Array(w * h), sg = new Uint8Array(w * h), sb = new Uint8Array(w * h);
  const q = new Int32Array(w * h); let qh = 0, qt = 0, n = 0;
  const dist = (i, r, g, b) => Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
  for (const [x, y] of seeds) {
    const p = y * w + x; if (seen[p] || d[p * 4 + 3] < 10) continue;
    seen[p] = 1; sr[p] = d[p * 4]; sg[p] = d[p * 4 + 1]; sb[p] = d[p * 4 + 2]; q[qt++] = p;
  }
  while (qh < qt) {
    const p = q[qh++], i = p * 4, x = p % w, y = (p / w) | 0;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i + 3] = 0; n++;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const m of nb) {
      if (m < 0 || seen[m]) continue;
      const j = m * 4; if (d[j + 3] < 10) { seen[m] = 1; continue; }
      if (dist(j, r, g, b) < tolStep && dist(j, sr[p], sg[p], sb[p]) < tolSeed) {
        seen[m] = 1; sr[m] = sr[p]; sg[m] = sg[p]; sb[m] = sb[p]; q[qt++] = m;
      }
    }
  }
  // 지운 자리와 맞닿은 가장자리 한 줄은 반투명으로 (계단 테두리 완화)
  for (let p = 0; p < w * h; p++) {
    if (d[p * 4 + 3] === 0) continue;
    const x = p % w, y = (p / w) | 0;
    if ((x > 0 && seen[p - 1] && d[(p - 1) * 4 + 3] === 0) || (x < w - 1 && seen[p + 1] && d[(p + 1) * 4 + 3] === 0) ||
        (y > 0 && seen[p - w] && d[(p - w) * 4 + 3] === 0) || (y < h - 1 && seen[p + w] && d[(p + w) * 4 + 3] === 0)) d[p * 4 + 3] = Math.min(d[p * 4 + 3], 170);
  }
  ctx.putImageData(img, 0, 0);
  return n;
}
function autoRemove(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const border = [];
  for (let x = 0; x < w; x++) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) border.push([0, y], [w - 1, y]);
  const clear = border.filter(([x, y]) => d[(y * w + x) * 4 + 3] < 20).length;
  if (clear > border.length * 0.3) return;          // 이미 배경이 투명한 그림
  floodErase(cv, border);
}
function trim(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const c = canvas(x1 - x0 + 1, y1 - y0 + 1); c.getContext('2d').drawImage(cv, -x0, -y0); return c;
}

/* ---------- 테마 그림 만들기 ---------- */
/* 포켓몬이 걸터앉은 첫 말풍선: 게임 대화창식 유리 판 (왼쪽 위, 오른쪽 아래는 직각)
   포켓몬을 먼저 그리고 판을 덮어서 발이 판 뒤로 숨는다 */
const CB = { TOP: 40, H: 84, BOX: 40, W: { Send: 56, Receive: 62 } };   // 포켓몬 자리 40pt (10% 키움)
const RAD = 12;
function boxPath(ctx, x0, y0, x1, y1, s) {
  ctx.beginPath();
  ctx.moveTo(x0 * s, y0 * s);
  ctx.lineTo((x1 - RAD) * s, y0 * s);
  ctx.arc((x1 - RAD) * s, (y0 + RAD) * s, RAD * s, -Math.PI / 2, 0);
  ctx.lineTo(x1 * s, y1 * s);
  ctx.lineTo((x0 + RAD) * s, y1 * s);
  ctx.arc((x0 + RAD) * s, (y1 - RAD) * s, RAD * s, Math.PI / 2, Math.PI);
  ctx.closePath();
}
function glassFill(side) {
  if (side === 'Receive') return 'rgba(255,255,255,0.47)';
  const [r, g, b] = hexRgb(state.type.main), m = (v) => Math.round(v + (255 - v) * 0.35);
  return `rgba(${m(r)},${m(g)},${m(b)},0.745)`;
}
function charBubble(side, spr, scale) {
  const W = CB.W[side], c = canvas(W * scale, CB.H * scale), ctx = c.getContext('2d'), s = scale;
  if (spr) {
    const bx = side === 'Send' ? W - CB.BOX - 2 : 2;
    drawFit(ctx, spr, bx * s, 0, CB.BOX * s, (CB.TOP + 5) * s);
  }
  const x0 = 0.8, y0 = CB.TOP + 0.8, x1 = W - 0.8, y1 = CB.H - 0.8;
  boxPath(ctx, x0, y0, x1, y1, s); ctx.fillStyle = glassFill(side); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.96)'; ctx.lineWidth = 1.5 * s; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.moveTo(x0 * s, y0 * s); ctx.lineTo((x0 + 5) * s, y0 * s); ctx.lineTo(x0 * s, (y0 + 5) * s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x1 * s, y1 * s); ctx.lineTo((x1 - 5) * s, y1 * s); ctx.lineTo(x1 * s, (y1 - 5) * s); ctx.fill();
  const cx = x1 - 12, cy = y1 - 10;                       // 오른쪽 아래 ∨
  ctx.strokeStyle = side === 'Send' ? '#FFFFFF' : '#464240'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo((cx - 4) * s, (cy - 2.2) * s); ctx.lineTo(cx * s, (cy + 2) * s); ctx.lineTo((cx + 4) * s, (cy - 2.2) * s); ctx.stroke();
  return c;
}
const CAP = { Send: [13, 54], Receive: [43, 54] };      // 늘어나는 한 줄의 위치 (왼쪽, 위) pt
const INSET = { Send: '52px 16px 12px 26px', Receive: '52px 24px 12px 26px' };
const PLAIN = { W: 32, H: 40, CAP: [13, 14] };

/* 친구 목록 배경: 오른쪽 아래 구석에 내 포켓몬 */
function listBg(base, spr) {
  const c = canvas(base.width, base.height), ctx = c.getContext('2d'); ctx.drawImage(base, 0, 0);
  if (!spr) return c;
  const w = c.width, h = c.height, box = w * 0.30, x = w - box - w * 0.05, y = h - box - h * 0.10;   // 탭바(아래 약 13%)가 발끝을 아주 살짝 가리게
  ctx.save(); ctx.filter = `blur(${w * 0.012}px)`; ctx.fillStyle = 'rgba(60,30,20,.18)';
  ctx.beginPath(); ctx.ellipse(x + box / 2, y + box, box * 0.38, box * 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  drawFit(ctx, spr, x, y, box, box);
  return c;
}

/* 잠금 동그라미: 빈 자리는 크림 동그라미, 채운 자리는 포켓몬 (친구, 나, 친구, 나) */
function bullet(scale, filled, spr) {
  const s = 18 * scale, c = canvas(s, s), ctx = c.getContext('2d');
  if (filled && spr) { drawFit(ctx, spr, 0, 0, s, s, 'center'); return c; }
  ctx.fillStyle = state.type.cream; ctx.strokeStyle = state.type.main; ctx.lineWidth = 1.6 * scale;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, 4.6 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  return c;
}
const BULLET_WHO = ['friend', 'me', 'friend', 'me'], SLOTS = ['first', 'second', 'third', 'fourth'];

/* ---------- 4단계: 파일 묶기 ---------- */
async function buildTheme() {
  const T = state.type, sp = state.sprites;
  const zip = await JSZip.loadAsync(state.zipBuf[T.key]);
  let css = await zip.file('KakaoTalkTheme.css').async('string');
  const put = async (name, c) => zip.file(`Images/${name}.png`, await blobOf(c));

  for (const side of ['Send', 'Receive']) {
    const spr = side === 'Send' ? sp.me : sp.friend;
    for (const sc of [2, 3]) await put(`chatroomBubble${side}Char@${sc}x`, charBubble(side, spr, sc));
    const [cl, ct] = CAP[side];
    css = css.replace(new RegExp(`(MessageCellStyle-${side} \\{[\\s\\S]*?)\\n\\}`), (blk) => blk
      .replace(/-ios-background-image: '[^']+' \d+px \d+px;/, `-ios-background-image: 'chatroomBubble${side}Char.png' ${cl}px ${ct}px;`)
      .replace(/-ios-selected-background-image: '[^']+' \d+px \d+px;/, `-ios-selected-background-image: 'chatroomBubble${side}Char.png' ${cl}px ${ct}px;`)
      .replace(/-ios-title-edgeinsets: [^;]+;/, `-ios-title-edgeinsets: ${INSET[side]};`));
  }
  for (const sc of [2, 3]) {
    const base = await loadImg(URL.createObjectURL(await zip.file(`Images/mainBgImage@${sc}x.png`).async('blob')));
    await put(`mainBgImage@${sc}x`, listBg(base, sp.me));
  }
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const nm = `passcodeImgCode${String(i + 1).padStart(2, '0')}`;
    for (const sc of [2, 3]) {
      await put(`${nm}@${sc}x`, bullet(sc, false));
      await put(`${nm}Selected@${sc}x`, bullet(sc, true, sp[BULLET_WHO[i]]));
    }
    lines.push(`    -ios-bullet-${SLOTS[i]}-image: '${nm}.png';`, `    -ios-bullet-selected-${SLOTS[i]}-image: '${nm}Selected.png';`);
  }
  css = css.replace(/(PasscodeStyle \{[^}]*?)\n\}/, (m, body) => `${body}\n${lines.join('\n')}\n}`);
  const tag = Math.random().toString(36).slice(2, 8);
  css = css.replace(/-kakaotalk-theme-name: '[^']*';/, `-kakaotalk-theme-name: '포켓몬 ${T.name} 커스텀';`)
           .replace(/-kakaotalk-theme-id: '[^']*';/, `-kakaotalk-theme-id: 'com.kakao.talk.theme.poke${T.key}c${tag}';`);
  zip.file('KakaoTalkTheme.css', css);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream', compression: 'DEFLATE' });
}
async function getIos() {
  const btn = $('#getIos'); btn.disabled = true; btn.textContent = '만드는 중';
  try {
    const blob = await buildTheme(), name = `pokemon-${state.type.key}-custom.ktheme`;
    const file = new File([blob], name, { type: 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      toast('파일을 받았습니다');
    }
  } catch (e) { console.error(e); toast('만들지 못했습니다. 다시 눌러 주십시오'); }
  btn.textContent = '아이폰용 받기'; updateButtons();
}
function updateButtons() {
  const ok = !!(state.assets && state.sprites.me && state.sprites.friend);
  $('#getIos').disabled = !ok; $('#getAnd').disabled = !ok;
}

/* ---------- 안드로이드 (.apk) ---------- */
const bytesOf = async (c) => new Uint8Array(await (await blobOf(c)).arrayBuffer());
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.arrayBuffer(); };
const andCache = {};
const PAD = { Send: [16, 26, CB.TOP + 12, 12], Receive: [24, 26, CB.TOP + 12, 12] };
async function getAnd() {
  if (/KAKAOTALK/i.test(navigator.userAgent)) { toast('카톡 안에서는 파일이 안 받아집니다. 크롬으로 열어 주십시오'); return; }
  const btn = $('#getAnd'); btn.disabled = true; btn.textContent = '만드는 중';
  try {
    const T = state.type, sp = state.sprites;
    const mod = await import('./android.js');
    andCache.tpl ||= await fetchBuf('template.apk');
    andCache.info ||= await (await fetch('template.json')).json();
    const baseKey = `base-${T.key}`; andCache[baseKey] ||= await fetchBuf(`android-${T.key}.zip`);
    const D = mod.DIR, extra = {};
    for (const [side, who] of [['Send', 'me'], ['Receive', 'you']]) {
      const png = await bytesOf(charBubble(side, side === 'Send' ? sp.me : sp.friend, 3));
      extra[`${D}theme_chatroom_bubble_${who}_01_image.9.png`] = mod.ninePatch(png, CAP[side], PAD[side]);
    }
    const bz = await JSZip.loadAsync(andCache[baseKey]);
    const listImg = await loadImg(URL.createObjectURL(await bz.file(`${D}theme_background_image.png`).async('blob')));
    extra[`${D}theme_background_image.png`] = await bytesOf(listBg(listImg, sp.me));
    for (let i = 0; i < 4; i++) extra[`${D}theme_passcode_0${i + 1}_checked_image.png`] = await bytesOf(bullet(3, true, sp[BULLET_WHO[i]]));
    const apk = await mod.buildApk(andCache.tpl, andCache[baseKey], andCache.info, T.android, `포켓몬 ${T.name} 커스텀`, extra);
    const blob = new Blob([apk], { type: 'application/vnd.android.package-archive' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pokemon-${T.key}-custom.apk`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('파일을 받았습니다. 알림에서 눌러 설치해 주십시오');
  } catch (e) { console.error(e); toast('만들지 못했습니다. 다시 눌러 주십시오'); }
  btn.textContent = '안드로이드용 받기'; updateButtons();
}

/* ---------- 3단계: 미리보기 ---------- */
function nine(ctx, img, scale, capL, capT, x, y, w, h) {   // 카톡처럼 한 줄만 늘이기
  const L = capL * scale, Tt = capT * scale, W = img.width, H = img.height, f = PT / scale;
  const sx = [0, L, L + 1, W], sy = [0, Tt, Tt + 1, H];
  const dx = [x, x + L * f, x + w - (W - L - 1) * f, x + w], dy = [y, y + Tt * f, y + h - (H - Tt - 1) * f, y + h];
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) ctx.drawImage(img, sx[i], sy[j], sw, sh, dx[i], dy[j], dw, dh);
  }
  ctx.imageSmoothingEnabled = true;
}
const FONT = (px, wt = 400) => `${wt} ${px}px "Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", sans-serif`;
function roundClip(ctx, w, h, r) { ctx.beginPath(); ctx.roundRect(0, 0, w, h, r); ctx.clip(); }

function render() {
  updateButtons();
  const A = state.assets, T = state.type; if (!A) return;
  const sp = state.sprites;
  // 채팅방
  { const c = $('#pvChat'), ctx = c.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 450, 975); roundClip(ctx, 450, 975, 36);
    ctx.drawImage(A['chatroomBgImage@2x'], 0, 0, 450, 975);
    let y = 70; ctx.font = FONT(22);
    const msg = (side, txt, first) => {
      const tw = ctx.measureText(txt).width;
      if (first) {
        const ch = charBubble(side, side === 'Send' ? sp.me : sp.friend, 3), [cl, ct] = CAP[side];
        const ins = side === 'Send' ? [16, 26] : [24, 26]; const w = Math.max(CB.W[side] * PT, tw + (ins[0] + ins[1]) * PT), h = CB.H * PT;
        const x = side === 'Send' ? 450 - 14 - w : 62;
        if (side === 'Receive') { ctx.save(); ctx.beginPath(); ctx.roundRect(12, y + CB.TOP * PT, 42, 42, 15); ctx.clip(); ctx.drawImage(A['profileImg01@3x'], 12, y + CB.TOP * PT, 42, 42); ctx.restore(); }
        nine(ctx, ch, 3, cl, ct, x, y, w, h); ctx.fillStyle = T.text; ctx.fillText(txt, x + ins[0] * PT, y + (CB.TOP + 12) * PT + 17); y += h + 8;
      } else {
        const img = A[`chatroomBubble${side}01@3x`], w = Math.max(PLAIN.W * PT, tw + 42 * PT), h = 42 * PT;
        const x = side === 'Send' ? 450 - 14 - w : 62;
        nine(ctx, img, 3, PLAIN.CAP[0], PLAIN.CAP[1], x, y, w, h); ctx.fillStyle = T.text; ctx.fillText(txt, x + 16 * PT, y + 12 * PT + 22); y += h + 14;
      }
    };
    msg('Receive', '테마 바꿨어?', true); msg('Receive', '포켓몬이 앉아 있네', false);
    msg('Send', 'ㅇㅇ 내가 만듦', true); msg('Send', '너도 해 봐', false);
    msg('Receive', 'ㅋㅋㅋ', true);
    ctx.restore(); }
  // 친구 목록
  { const c = $('#pvList'), ctx = c.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 450, 975); roundClip(ctx, 450, 975, 36);
    ctx.drawImage(listBg(A['mainBgImage@3x'], sp.me), 0, 0, 450, 975);
    ctx.fillStyle = T.text; ctx.font = FONT(28, 800); ctx.fillText('친구', 26, 62);
    ['나', '김민수', '이서연', '박지훈', '최유나', '정하늘'].forEach((n, i) => {
      const y = 96 + i * 100; ctx.save(); ctx.beginPath(); ctx.roundRect(26, y, 68, 68, 25); ctx.clip(); ctx.drawImage(A['profileImg01@3x'], 26, y, 68, 68); ctx.restore();
      ctx.fillStyle = T.text; ctx.font = FONT(22, 500); ctx.fillText(n, 112, y + 30); ctx.fillStyle = T.sub; ctx.font = FONT(16); ctx.fillText('상태메시지', 112, y + 56);
    });
    const px = ctx.getImageData(225, 850, 1, 1).data; ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`; ctx.fillRect(0, 860, 450, 115);   // 탭바는 배경 맨 아래 색
    ['maintabIcoFriendsSelected@3x', 'maintabIcoChats@3x', 'maintabIcoBrowse@3x', 'maintabIcoShopping@3x'].forEach((k, i) => ctx.drawImage(A[k], 56 + i * 112 - 21, 878, 42, 42));
    ctx.restore(); }
  // 잠금화면 (두 자리 입력한 모습)
  { const c = $('#pvLock'), ctx = c.getContext('2d'); ctx.save(); ctx.clearRect(0, 0, 450, 975); roundClip(ctx, 450, 975, 36);
    ctx.drawImage(A['passcodeBgImage@2x'], 0, 0, 450, 975);
    ctx.fillStyle = T.text; ctx.font = FONT(22, 700); ctx.textAlign = 'center'; ctx.fillText('암호를 입력해 주세요', 225, 170);
    for (let i = 0; i < 4; i++) { const b = bullet(3, i < 2, sp[BULLET_WHO[i]]); ctx.drawImage(b, 225 - 120 + i * 60, 200, 54, 54); }
    ctx.fillStyle = T.cream; ctx.fillRect(0, 640, 450, 335); ctx.fillStyle = T.text; ctx.font = FONT(30);
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←'].forEach((k, i) => ctx.fillText(k, 75 + (i % 3) * 150, 700 + Math.floor(i / 3) * 75));
    ctx.restore(); }
}

/* ---------- 시작 ---------- */
if (/KAKAOTALK/i.test(navigator.userAgent)) setTimeout(() => { $('#inapp').hidden = false; }, 1500);   // 자동으로 안 넘어갔을 때만 보임
document.querySelectorAll('.slot').forEach(setupSlot);
$('#getIos').onclick = getIos;
$('#getAnd').onclick = getAnd;
initTypes();
document.fonts && document.fonts.ready.then(render);
