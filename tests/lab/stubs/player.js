// Attrappe für src/player.js
const lab = (globalThis.__labPlayer ||= { item: null, dur: 0 });
export const currentItem = () => lab.item;
export const titleOf = (i) => i?.name || i?.metadata?.title || "";
export const artistOf = (i) => i?.metadata?.artist_name || "";
export const PLR = { getDuration: () => lab.dur * 1000, getProgress: () => 0, isPlaying: () => true };
