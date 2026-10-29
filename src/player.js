import { SEL } from "./selectors.js";
import { S } from "./core.js";

/* ---------------------------------------------------------------- Player-Anbindung */
function currentItem() {
  return S.Player.data?.item || S.Player.data?.track || null;
}
const toHttp = (u) => (u && u.startsWith("spotify:image:") ? "https://i.scdn.co/image/" + u.slice(14) : u || "");
// klein = sofort da (die Leiste unten nutzt es schon), groß = scharf
function covers(item) {
  const m = item?.metadata || {};
  const imgs = item?.images || [];
  const domImg = document.querySelector(SEL.nowPlayingCover)?.src;
  const big = toHttp(m.image_xlarge_url || m.image_large_url || imgs[0]?.url);
  const small = toHttp(m.image_url || m.image_small_url || imgs[imgs.length - 1]?.url) || domImg || big;
  return { small, big: big || small };
}
function titleOf(item) {
  return item?.metadata?.title || item?.name || "";
}
function artistOf(item) {
  const m = item?.metadata || {};
  if (m.artist_name) {
    const more = Object.keys(m)
      .filter((k) => /^artist_name:\d+$/.test(k))
      .map((k) => m[k]);
    return [m.artist_name, ...more].join(", ");
  }
  return (item?.artists || []).map((a) => a.name).join(", ");
}

export { currentItem, toHttp, covers, titleOf, artistOf };
