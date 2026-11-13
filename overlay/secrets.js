/* ------------------------------------------------------------------ Zugangsdaten sicher ablegen */
// Hue-Schlüssel, Hue-Entertainment-Schlüssel und Home-Assistant-Token liegen nicht im Klartext in der
// Einstellungsdatei, sondern verschlüsselt über Electrons safeStorage (Windows DPAPI, macOS-Schlüsselbund,
// Linux libsecret/kwallet). Im Speicher des Hauptprozesses bleiben sie Klartext – nur dort werden sie gebraucht.
// Eigene Datei ohne Electron-Abhängigkeit, damit sich das mit einem nachgebauten safeStorage testen lässt.
const SECRET = ["hueUser", "hueClientKey", "haToken"];
// Feld in der Einstellungsdatei: { hueUser: "<base64>", … }
const FIELD = "secrets";

function createSecrets(safeStorage) {
  // Blobs, die sich gerade nicht entschlüsseln lassen (Schlüsselbund gesperrt, anderer Nutzer): nicht
  // wegwerfen, sondern unverändert zurückschreiben – beim nächsten Start klappt es vielleicht wieder
  let kept = {};
  // LINUX: „basic_text“ heißt, es gibt keinen Schlüsselbund – das wäre nur verschleiert, nicht verschlüsselt
  function available() {
    try {
      if (!safeStorage?.isEncryptionAvailable()) return false;
      return safeStorage.getSelectedStorageBackend?.() !== "basic_text";
    } catch {
      return false;
    }
  }
  // gelesene Datei → Einstellungen im Speicher (Klartext). migrated: es lagen noch Klartext-Werte in der
  // Datei, die jetzt verschlüsselt werden können – der Aufrufer speichert dann gleich neu.
  function open(saved) {
    const out = { ...saved }, ok = available();
    const blobs = saved && typeof saved[FIELD] === "object" && saved[FIELD] && !Array.isArray(saved[FIELD]) ? saved[FIELD] : {};
    delete out[FIELD];
    kept = {};
    let migrated = false;
    for (const k of SECRET) {
      const plain = typeof out[k] === "string" ? out[k] : "";
      if (plain) {
        // Klartext aus einer älteren Version (oder von einem Rechner ohne Schlüsselbund)
        if (ok) migrated = true;
        continue;
      }
      if (typeof blobs[k] !== "string" || !blobs[k]) continue;
      let value = "";
      if (ok) {
        try {
          value = safeStorage.decryptString(Buffer.from(blobs[k], "base64"));
        } catch {}
      }
      if (value) out[k] = value;
      else kept[k] = blobs[k];
    }
    return { cfg: out, migrated };
  }
  // Einstellungen im Speicher → Objekt für die Datei. Ohne Verschlüsselung bleibt es beim alten Verhalten
  // (Klartext-Felder), damit die Lampen trotzdem funktionieren; die Einstellungen weisen darauf hin.
  function seal(cfg) {
    const out = { ...cfg }, ok = available(), blobs = {};
    for (const k of SECRET) {
      const v = typeof out[k] === "string" ? out[k] : "";
      if (v && ok) {
        try {
          blobs[k] = safeStorage.encryptString(v).toString("base64");
          delete out[k];
          continue;
        } catch {}
      }
      // kein neuer Wert: einen nicht lesbaren alten Blob behalten
      if (!v && kept[k]) blobs[k] = kept[k];
      if (!v) delete out[k];
    }
    if (Object.keys(blobs).length) out[FIELD] = blobs;
    return out;
  }
  // liegen Zugangsdaten gerade im Klartext in der Datei? (für den Hinweis in den Einstellungen)
  const plain = (cfg) => !available() && SECRET.some((k) => !!cfg[k]);
  return { available, open, seal, plain };
}

/* ---- Zugangsdaten gehören zu einer Adresse: der Hue-Schlüssel zu genau dieser Bridge, das Token zu genau
   diesem Home Assistant. Ändert sich die Adresse, ohne dass zugleich neue Zugangsdaten kommen, ginge der alte
   Schlüssel bei der nächsten Party an die neue Adresse – etwa nach dem Import einer fremden Einstellungsdatei. */
const BOUND = { hueIp: ["hueUser", "hueClientKey"], haUrl: ["haToken"] };
const addr = (v) => String(v ?? "").trim().replace(/\/+$/, "").toLowerCase();
const moved = (patch, cfg, key) => key in patch && addr(patch[key]) !== addr(cfg[key]);

// Import: neue Adresse → die Zugangsdaten dazu leeren. cleared: welche Adressen betroffen sind („hueIp“, „haUrl“),
// damit die Einstellungen sagen können, was neu gekoppelt bzw. eingegeben werden muss
function rebind(patch, cfg) {
  const out = { ...patch }, cleared = [];
  for (const [key, secrets] of Object.entries(BOUND)) {
    if (!moved(out, cfg, key) || secrets.some((s) => s in patch)) continue;
    if (!secrets.some((s) => cfg[s])) continue;
    for (const s of secrets) out[s] = "";
    cleared.push(key);
  }
  return { patch: out, cleared };
}

// Änderung aus einem Fenster („set“): Zugangsdaten setzt dort nur, wer ein neues Home-Assistant-Token eintippt –
// nie der Platzhalter „set“ zurück, nie die Hue-Schlüssel (die kommen nur vom Koppeln). Adressen mit Schlüssel
// dürfen nur aus dem Einstellungsfenster kommen (trusted); von woanders werden sie verworfen. dropped: verworfene
// Adressen (für das Protokoll)
function cleanPatch(patch, cfg, trusted) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { patch: {}, dropped: [] };
  const p = { ...patch }, dropped = [];
  // hueCertPin (Fingerabdruck des Bridge-Zertifikats) merkt sich nur der Hauptprozess selbst
  for (const k of ["hueUser", "hueClientKey", FIELD, "secretsPlain", "hueCertPin"]) delete p[k];
  if (p.haToken === "set" || (!trusted && "haToken" in p)) delete p.haToken;
  if (!trusted) {
    for (const key of Object.keys(BOUND)) {
      if (moved(p, cfg, key)) dropped.push(key);
      delete p[key];
    }
  }
  return { patch: p, dropped };
}

// Kommt eine IPC-Nachricht (e) aus dem Hauptframe dieses Fensters (win), und zeigt es die erwartete eigene
// Seite (page)? Alle Fenster teilen sich preload.js – erst das Fenster entscheidet, wer was darf.
function senderIs(e, win, page) {
  if (!e || !win || win.isDestroyed() || e.sender !== win.webContents) return false;
  const f = e.senderFrame;
  return !!f && f === e.sender.mainFrame && /^file:\/\//i.test(f.url) && f.url.split(/[?#]/)[0].endsWith("/" + page);
}

module.exports = { createSecrets, SECRET, BOUND, rebind, cleanPatch, senderIs };
