// Krypto-Bausteine des DTLS-Clients (overlay/dtls.js) gegen veröffentlichte Testvektoren.
// Aufruf: node tests/dtls/vectors.test.js
const assert = require("assert");
const { spawnSync } = require("child_process");
const d = require("../../overlay/dtls.js");

const hex = (s) => Buffer.from(s.replace(/\s+/g, ""), "hex");

/* ---- TLS 1.2 PRF mit SHA-256: der übliche Vektor von der IETF-TLS-Mailingliste (Secret, Seed, „test label“,
   100 Byte Ausgabe) */
const SECRET = hex("9b be 43 6b a9 40 f0 17 b1 76 52 84 9a 71 db 35");
const SEED = hex("a0 ba 9f 93 6c da 31 18 27 a6 f7 96 ff d5 19 8c");
const OUT = hex(`e3 f2 29 ba 72 7b e1 7b 8d 12 26 20 55 7c d4 53 c2 aa b2 1d 07 c3 d4 95 32 9b 52 d4 e6 1e db 5a
  6b 30 17 91 e9 0d 35 c9 c9 a4 6b 4e 14 ba f9 af 0f a0 22 f7 07 7d ef 17 ab fd 37 97 c0 56 4b ab 4f bc 91 66 6e 9d
  ef 9b 97 fc e3 4f 79 67 89 ba a4 80 82 d1 22 ee 42 c5 a7 2e 5a 51 10 ff f7 01 87 34 7b 66`);
assert.deepStrictEqual(d.prf(SECRET, "test label", SEED, 100), OUT);
// kürzere Ausgabe ist ein Anfang der längeren
assert.deepStrictEqual(d.prf(SECRET, "test label", SEED, 12), OUT.subarray(0, 12));
// unabhängig gegengerechnet mit OpenSSLs TLS1-PRF, wenn ein OpenSSL 3 da ist
{
  const r = spawnSync(process.env.OPENSSL || "openssl", ["kdf", "-keylen", "100", "-kdfopt", "digest:SHA256", "-kdfopt", "hexsecret:" + SECRET.toString("hex"), "-kdfopt", "hexseed:" + Buffer.concat([Buffer.from("test label"), SEED]).toString("hex"), "TLS1-PRF"], { encoding: "utf8" });
  if (r.status === 0) assert.strictEqual(r.stdout.trim().replace(/:/g, "").toLowerCase(), OUT.toString("hex"));
  else console.log("vectors: OpenSSL kdf nicht verfügbar – nur der veröffentlichte Vektor geprüft");
}

/* ---- AES-128-GCM: NIST/McGrew-Viega Testfall 4 (60 Byte Klartext, 20 Byte AAD). Die 12-Byte-Nonce wird wie in
   DTLS aus 4 Byte festem Teil und 8 Byte ausdrücklichem Teil zusammengesetzt. */
{
  const K = hex("feffe9928665731c6d6a8f9467308308");
  const P = hex("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39");
  const A = hex("feedfacedeadbeeffeedfacedeadbeefabaddad2");
  const IV = hex("cafebabefacedbaddecaf888");
  const C = hex("42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091");
  const T = hex("5bc94fbc3221a5db94fae95ae7121a47");
  const sealed = d.gcmSeal(K, IV.subarray(0, 4), IV.subarray(4), A, P);
  assert.deepStrictEqual(sealed, Buffer.concat([C, T]));
  assert.deepStrictEqual(d.gcmOpen(K, IV.subarray(0, 4), IV.subarray(4), A, sealed), P);
  // ein umgekipptes Bit im Geheimtext, in der AAD oder im Prüfwert: abgelehnt
  const bad = Buffer.from(sealed);
  bad[3] ^= 1;
  assert.strictEqual(d.gcmOpen(K, IV.subarray(0, 4), IV.subarray(4), A, bad), null);
  assert.strictEqual(d.gcmOpen(K, IV.subarray(0, 4), IV.subarray(4), Buffer.concat([A.subarray(1), Buffer.from([0])]), sealed), null);
  assert.strictEqual(d.gcmOpen(K, IV.subarray(0, 4), IV.subarray(4), A, sealed.subarray(0, 10)), null);
}

/* ---- Aufbau nach den RFCs */
{
  // RFC 4279: uint16 N, N Nullbytes, uint16 N, PSK
  assert.deepStrictEqual(d.pskPremaster(hex("aabb")), hex("0002 0000 0002 aabb"));
  // AAD: epoch(2) seq(6) type(1) version FEFD(2) length(2)
  assert.deepStrictEqual(d.aadOf(1, 0x0102030405, 23, 300), hex("0001 000102030405 17 fefd 012c"));
  assert.deepStrictEqual(d.seqBytes(1, 7), hex("0001 000000000007"));
  // Datensatz-Kopf und Handshake-Kopf (12 Byte, unfragmentiert)
  assert.deepStrictEqual(d.record(22, 0, 5, hex("abcd")), hex("16 fefd 0000 000000000005 0002 abcd"));
  assert.deepStrictEqual(d.hsMessage(16, 2, hex("aa")), hex("10 000001 0002 000000 000001 aa"));
  assert.deepStrictEqual(d.parseRecords(Buffer.concat([d.record(20, 0, 1, hex("01")), d.record(23, 1, 9, hex("beef")), hex("1600")])).map((r) => [r.type, r.epoch, r.seq, r.body.toString("hex")]), [[20, 0, 1, "01"], [23, 1, 9, "beef"]]);
  // ClientHello: Version FEFD, 32 Byte Zufall, leere Sitzung, Cookie, Verfahren 0x00A8 (+ SCSV), keine Kompression
  const ch = d.clientHello(Buffer.alloc(32, 7), hex("c0ffee"));
  assert.deepStrictEqual(ch.subarray(0, 2), hex("fefd"));
  assert.deepStrictEqual(ch.subarray(34), hex("00 03 c0ffee 0004 00a8 00ff 01 00"));
  assert.strictEqual(d.SUITE, 0x00a8);
  // Schlüsselblock: 2 × 16 Byte Schlüssel + 2 × 4 Byte fester Nonce-Teil, aus dem PRF in dieser Reihenfolge
  const m = Buffer.alloc(48, 1), cr = Buffer.alloc(32, 2), sr = Buffer.alloc(32, 3), kb = d.prf(m, "key expansion", Buffer.concat([sr, cr]), 40), k = d.keyBlock(m, cr, sr);
  assert.deepStrictEqual(Buffer.concat([k.cKey, k.sKey, k.cIv, k.sIv]), kb);
}

console.log("dtls vectors: ok");
