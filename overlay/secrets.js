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

module.exports = { createSecrets, SECRET };
