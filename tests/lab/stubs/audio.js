// Attrappe für src/audio.js: das Labor legt die Taktdaten direkt hinein
export const audio = (globalThis.__labAudio ||= { uri: "", data: null });
export const beat = { read: () => 0, sync() {}, level: 0 };
