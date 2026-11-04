// 안드로이드 테마(.apk)를 브라우저에서 조립한다.
// 빈 템플릿 앱(template.apk)에 타입별 그림 묶음(android-{타입}.zip)과
// 사진으로 만든 그림(말풍선, 친구 목록 배경, 잠금 동그라미)을 끼우고,
// 색 42칸과 테마 이름을 같은 길이로 덮어쓴 뒤 다시 서명한다.
// 조립, 서명 코드는 Ruminem/kakaotalk-theme (Apache-2.0) 의 zip.js, apksign.js, apkmix.js 를 쓴다.
import { readZip, writeZip, crc32, inflate } from './zip.js';
import { resign } from './apksign.js';

import { CERT, PUBKEY, PRIVKEY } from './customkey.js';

export const DIR = 'res/drawable-xxhdpi-v4/';
const ARSC = 'resources.arsc';

/* PNG 조각 하나 (길이 + 종류 + 내용 + CRC) */
function chunk(type, data) {
  const t = new TextEncoder().encode(type), out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set(t, 4); out.set(data, 8);
  const body = new Uint8Array(4 + data.length); body.set(t, 0); body.set(data, 4);
  dv.setUint32(8 + data.length, crc32(body) >>> 0);
  return out;
}

/* 컴파일된 9-patch: 테두리 없이 npTc 조각에 늘어날 줄(3px)과 글자 여백을 담는다.
   cap: [왼쪽, 위] pt, pad: [왼, 오른, 위, 아래] pt. 그림은 3배(xxhdpi) */
export function ninePatch(png, cap, pad) {
  const n = new Uint8Array(84), dv = new DataView(n.buffer);
  n.set([0, 2, 2, 9]);
  dv.setUint32(4, 32, true); dv.setUint32(8, 40, true);
  pad.forEach((p, i) => dv.setInt32(12 + i * 4, p * 3));
  dv.setUint32(28, 48, true);
  dv.setInt32(32, cap[0] * 3); dv.setInt32(36, cap[0] * 3 + 3);
  dv.setInt32(40, cap[1] * 3); dv.setInt32(44, cap[1] * 3 + 3);
  for (let i = 0; i < 9; i++) dv.setUint32(48 + i * 4, 1);
  const ol = new Uint8Array(24); ol[20] = 255;
  const head = png.slice(0, 33), rest = png.slice(33);          // 8바이트 서명 + IHDR 25바이트 뒤에 끼운다
  const a = chunk('npOl', ol), b = chunk('npTc', n);
  const out = new Uint8Array(head.length + a.length + b.length + rest.length);
  out.set(head, 0); out.set(a, head.length); out.set(b, head.length + a.length); out.set(rest, head.length + a.length + b.length);
  return out;
}

/**
 * @param {ArrayBuffer} template 템플릿 APK
 * @param {ArrayBuffer} base 타입별 그림 묶음 zip
 * @param {object} info template.json ({marks, filler})
 * @param {string[]} colors 색 42칸 (#AARRGGBB)
 * @param {string} name 테마 이름
 * @param {Object<string, Uint8Array>} extra 사진으로 만든 그림 (경로: PNG 바이트)
 */
// Reference app identity must not leak into generated themes. All replacements
// are length-preserving so the compiled Android string pools stay valid.
const OLD_PACKAGE = 'com.kakao.talk.theme.mayimessage1';
const NEW_PACKAGE = 'com.kakao.talk.theme.pokecustom01';
const OLD_LABEL = '아이메세지_카톡테마_블루';
function replaceExact(bytes, from, to, encoding = 'utf8') {
  const encode = (s) => encoding === 'utf16' ? Uint8Array.from([...s].flatMap(c => [c.charCodeAt(0) & 255, c.charCodeAt(0) >>> 8])) : new TextEncoder().encode(s);
  const a = encode(from), b = encode(to);
  if (a.length !== b.length) throw new Error('APK 문자열 길이가 다릅니다');
  const out = bytes.slice(); let count = 0;
  for (let i = 0; i <= out.length - a.length; i++) {
    if (a.every((v, j) => out[i+j] === v)) { out.set(b, i); count++; i += a.length - 1; }
  }
  return { data: out, count };
}
function fixDexChecksum(dex) {
  // DEX header: SHA-1 signature [12..32], Adler32 checksum [8..12].
  return crypto.subtle.digest('SHA-1', dex.subarray(32)).then(hash => {
    dex.set(new Uint8Array(hash), 12);
    let a = 1, b = 0;
    for (let i = 12; i < dex.length; i++) { a = (a + dex[i]) % 65521; b = (b + a) % 65521; }
    new DataView(dex.buffer, dex.byteOffset).setUint32(8, ((b << 16) | a) >>> 0, true);
    return dex;
  });
}
// Android binary XML string pool: change the theme author without corrupting offsets.
function setManifestAuthor(input, author = 'geonho') {
  const dv = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const u16 = p => dv.getUint16(p, true), u32 = p => dv.getUint32(p, true);
  if (u16(0) !== 3 || u16(8) !== 1) throw new Error('지원하지 않는 AndroidManifest 형식');
  const start = 8, header = u16(start + 2), size = u32(start + 4);
  const count = u32(start + 8), flags = u32(start + 16), stringsStart = u32(start + 20);
  if (flags & 0x100) throw new Error('UTF-8 Manifest 문자열 풀은 별도 처리가 필요합니다');
  const offsetBase = start + header, dataBase = start + stringsStart;
  const old = new Uint8Array(input), edits = [];
  for (let i = 0; i < count; i++) {
    const offset = u32(offsetBase + i * 4), at = dataBase + offset, length = u16(at);
    if (length === 0xffff) continue;
    const bytes = old.slice(at + 2, at + 2 + length * 2);
    const value = new TextDecoder('utf-16le').decode(bytes);
    if (value !== 'may') continue;
    const encoded = new TextEncoder(); // UTF-16LE code units written explicitly below
    const newBytes = new Uint8Array(2 + author.length * 2 + 2);
    const nd = new DataView(newBytes.buffer);
    nd.setUint16(0, author.length, true);
    for (let j = 0; j < author.length; j++) nd.setUint16(2 + j * 2, author.charCodeAt(j), true);
    edits.push({ at, oldLength: 2 + length * 2 + 2, bytes: newBytes });
  }
  if (edits.length !== 1) throw new Error('제작자 may 문자열을 찾지 못했습니다');
  const e = edits[0], delta = e.bytes.length - e.oldLength;
  const out = new Uint8Array(old.length + delta);
  out.set(old.subarray(0, e.at), 0); out.set(e.bytes, e.at);
  out.set(old.subarray(e.at + e.oldLength), e.at + e.bytes.length);
  const od = new DataView(out.buffer);
  od.setUint32(4, u32(4) + delta, true);
  od.setUint32(start + 4, size + delta, true);
  for (let i = 0; i < count; i++) {
    const pos = offsetBase + i * 4, off = u32(pos);
    if (dataBase + off > e.at) od.setUint32(pos, off + delta, true);
  }
  return out;
}
// Verified against the bundled reference template.apk resource table.
// Values are compiled ARGB color entries (not text or PNG pixels).
const COLOR_OFFSETS = {
  theme_background_color: 0x21fc, theme_body_cell_border_color: 0x220c,
  theme_body_cell_color: 0x221c, theme_body_cell_pressed_color: 0x222c,
  theme_body_secondary_cell_color: 0x223c, theme_chatroom_background_color: 0x224c,
  theme_chatroom_bubble_me_color: 0x225c, theme_chatroom_bubble_you_color: 0x226c,
  theme_chatroom_input_bar_background_color: 0x227c, theme_chatroom_input_bar_color: 0x228c,
  theme_chatroom_input_bar_menu_icon_color: 0x229c, theme_chatroom_input_bar_send_button_color: 0x22ac,
  theme_chatroom_input_bar_send_icon_color: 0x22bc, theme_chatroom_unread_count_color: 0x22cc,
  theme_description_color: 0x22dc, theme_description_pressed_color: 0x22fc,
  theme_direct_share_background_color: 0x230c, theme_direct_share_button_color: 0x231c,
  theme_direct_share_color: 0x232c, theme_feature_browse_tab_color: 0x233c,
  theme_feature_browse_tab_focused_color: 0x234c, theme_feature_primary_color: 0x237c,
  theme_feature_primary_pressed_color: 0x239c, theme_header_cell_color: 0x23ac,
  theme_header_color: 0x23bc, theme_maintab_cell_color: 0x23cc,
  theme_notification_background_color: 0x23dc, theme_notification_background_pressed_color: 0x23ec,
  theme_notification_color: 0x23fc, theme_paragraph_color: 0x240c,
  theme_paragraph_pressed_color: 0x242c, theme_passcode_background_color: 0x243c,
  theme_passcode_color: 0x244c, theme_passcode_keypad_background_color: 0x245c,
  theme_passcode_keypad_color: 0x246c, theme_passcode_keypad_pressed_background_color: 0x248c,
  theme_passcode_keypad_pressed_color: 0x249c, theme_passcode_pattern_line_color: 0x24ac,
  theme_section_title_color: 0x24bc, theme_title_color: 0x24cc,
  theme_title_pressed_color: 0x24ec
};
function applyThemeColors(data, info, colors) {
  const out = data.slice(), dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  if (dv.getUint16(0, true) !== 2 || out.length < 0x2500)
    throw new Error('호환되지 않는 APK 리소스 테이블입니다');
  const map = Object.fromEntries((info.names || []).map((n, i) => [n, colors[i]]));
  // List rows are rendered over theme_background_image.png; opaque row colors
  // would conceal the image. Keep foreground/text colors untouched.
  for (const key of ['theme_body_cell_color', 'theme_body_cell_pressed_color',
                     'theme_body_secondary_cell_color', 'theme_body_cell_border_color',
                     'theme_header_cell_color', 'theme_maintab_cell_color']) map[key] = '#00000000';
  let changed = 0;
  for (const [key, pos] of Object.entries(COLOR_OFFSETS)) {
    const value = map[key];
    if (!value) continue;
    if (!/^#[0-9a-fA-F]{8}$/.test(value)) throw new Error('잘못된 테마 색상: ' + key);
    if (pos + 4 > out.length || ![0x1c, 0x1d, 0x1e, 0x1f].includes(out[pos - 1]))
      throw new Error('템플릿 리소스 구조가 달라졌습니다: ' + key);
    dv.setUint32(pos, parseInt(value.slice(1), 16) >>> 0, true);
    changed++;
  }
  if (changed < 30) throw new Error('테마 색상 리소스 매핑이 부족합니다');
  return out;
}
function zipRecord(data) { return { method: 0, crc: crc32(data) >>> 0, csize: data.length, usize: data.length, data }; }
function themeLabel(name) {
  const max = new TextEncoder().encode(OLD_LABEL).length;
  while (new TextEncoder().encode(name).length > max) name = name.slice(0, -1);
  return name + ' '.repeat(max - new TextEncoder().encode(name).length);
}

export async function buildApk(template, base, info, colors, name, extra) {
  const tpl = readZip(template), bz = readZip(base), items = [];
  // Use a complete, known-installable theme application as the base.
  // Its compiled manifest, dex and resources remain intact.  This compatibility
  // path changes PNGs only; legacy resource-color markers do not exist here.
  if (!tpl.has('classes.dex') || !tpl.has('AndroidManifest.xml') || !tpl.has('resources.arsc')) {
    throw new Error('THEME_TEMPLATE_INVALID: 완전한 카카오톡 테마 APK가 필요합니다.');
  }
  const label = themeLabel(name);
  for (const [path, rec] of tpl) {
    let src = rec;
    if (path === 'AndroidManifest.xml') {
      const changed = replaceExact(await inflate(rec), OLD_PACKAGE, NEW_PACKAGE, 'utf16');
      if (!changed.count) throw new Error('APK 매니페스트 패키지 교체 실패');
      src = zipRecord(setManifestAuthor(changed.data));
    }
    if (path === 'resources.arsc') {
      let changed = replaceExact(await inflate(rec), OLD_PACKAGE, NEW_PACKAGE, 'utf16');
      if (!changed.count) throw new Error('APK 리소스 패키지 교체 실패');
      changed = replaceExact(changed.data, OLD_LABEL, label);
      if (!changed.count) throw new Error('APK 테마 이름 교체 실패');
      src = zipRecord(applyThemeColors(changed.data, info, colors));
    }
    if (path === 'classes.dex') {
      const changed = replaceExact(await inflate(rec), OLD_PACKAGE, NEW_PACKAGE);
      if (!changed.count) throw new Error('APK 실행 코드 패키지 교체 실패');
      src = zipRecord(await fixDexChecksum(changed.data));
    }
    if (bz.has(path) && path.startsWith(DIR)) src = bz.get(path);
    if (extra[path]) src = zipRecord(extra[path]);
    // The reference APK does not contain our marker colors/name slot.
    // Never corrupt its compiled resource table with an incompatible patch.
    items.push({ name: path, method: src.method, crc: src.crc, csize: src.csize, usize: src.usize, data: src.data });
  }
  return resign(writeZip(items, 4), { cert: CERT, pubkey: PUBKEY, privkey: PRIVKEY });
}
