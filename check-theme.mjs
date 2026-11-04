// Run: node check-theme.mjs [apk-path]
// Static checks only; KakaoTalk recognition must be tested on an Android device.
import fs from 'node:fs';
import path from 'node:path';
const file = process.argv[2] || 'template.apk';
const buf = fs.readFileSync(file);
const sig = Buffer.from([0x50,0x4b,0x05,0x06]);
const eocd = buf.lastIndexOf(sig);
if (eocd < 0) throw Error('ZIP EOCD not found');
const count = buf.readUInt16LE(eocd + 10);
let pos = buf.readUInt32LE(eocd + 16);
const entries = [];
for(let i=0;i<count;i++) {
 if(buf.readUInt32LE(pos)!==0x02014b50) throw Error('Invalid ZIP central directory');
 const n=buf.readUInt16LE(pos+28), x=buf.readUInt16LE(pos+30), c=buf.readUInt16LE(pos+32);
 entries.push(buf.subarray(pos+46,pos+46+n).toString('utf8'));
 pos+=46+n+x+c;
}
const required=['AndroidManifest.xml','resources.arsc'];
for(const n of required) if(!entries.includes(n)) throw Error(`Missing ${n}`);
console.log(`${file}: ${entries.length} ZIP entries; required base files present`);
console.log('WARNING: ZIP presence and installability do not establish KakaoTalk theme discovery.');
console.log('Inspect binary AndroidManifest.xml with Android SDK aapt2 and compare with a known working KakaoTalk theme.');
console.log('Check theme registration metadata, resources, APK signature and actual on-device discovery.');
