// Attrappe für src/lyrics.js: synchronisierter Liedtext, falls das Labor einen hat (sonst keiner)
export const getLyrics = async () => globalThis.__labLyrics || null;
