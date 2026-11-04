// 안드로이드 테마(.apk)를 브라우저에서 조립한다.
// 빈 템플릿 앱(template.apk, 저장소의 make_template.py 를 GitHub Actions 가 구운 것)에 타입별 그림 묶음(android-{타입}.zip)과
// 사진으로 만든 그림(말풍선, 친구 목록 배경, 잠금 동그라미)을 끼우고,
// 색 42칸과 테마 이름을 같은 길이로 덮어쓴 뒤 다시 서명한다.
// 조립, 서명 코드는 Ruminem/kakaotalk-theme (Apache-2.0) 의 zip.js, apksign.js, apkmix.js 를 쓴다.
import { readZip, writeZip, crc32 } from './zip.js';
import { resign } from './apksign.js';
import { patchColors, patchName } from './apkmix.js';
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
export async function buildApk(template, base, info, colors, name, extra) {
  const tpl = readZip(template), bz = readZip(base), items = [];
  for (const [path, rec] of tpl) {
    let src = rec;
    if (bz.has(path)) src = bz.get(path);
    if (extra[path]) { const d = extra[path]; src = { method: 0, crc: crc32(d) >>> 0, csize: d.length, usize: d.length, data: d }; }
    if (path === ARSC) {
      const arsc = rec.data.slice();
      patchColors(arsc, info.marks, colors);
      patchName(arsc, info.filler, name);
      src = { method: 0, crc: crc32(arsc) >>> 0, csize: arsc.length, usize: arsc.length, data: arsc };
    }
    items.push({ name: path, method: src.method, crc: src.crc, csize: src.csize, usize: src.usize, data: src.data });
  }
  return resign(writeZip(items, 4), { cert: CERT, pubkey: PUBKEY, privkey: PRIVKEY });
}
