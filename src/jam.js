import { S } from "./core.js";

/* ---------------------------------------------------------------- Jam-Teilnehmer */
// Spotify Jam (gemeinsame Session): Spotify führt die Mitglieder in SocialConnectAPI. Mirage liest sie
// nur, um sie im Party-Modus anzuzeigen – nichts wird gesendet oder gespeichert.
let me = null;
async function myself() {
  if (me) return me;
  try {
    const u = await S.Platform?.UserAPI?.getUser?.();
    if (u) me = { username: u.username || "", name: u.displayName || u.username || "", img: u.images?.[0]?.url || u.avatarUrl || "" };
  } catch {}
  return me;
}
// [{ id, name, img, me, host }] – leer, wenn kein Jam läuft oder niemand außer dir drin ist
async function jamMembers() {
  let s = null;
  try {
    s = S.Platform?.SocialConnectAPI?.getCurrentSession?.() || null;
  } catch {}
  const list = (s?.sessionMembers || []).filter((m) => m && !m.isAnonymous);
  if (!list.length) return [];
  const self = await myself();
  const out = list.map((m) => ({
    id: String(m.id || m.username || m.displayName),
    name: m.displayName || m.username || "",
    img: m.largeImageUrl || m.imageUrl || "",
    me: !!self && !!m.username && m.username === self.username,
    host: !!s.sessionOwnerId && m.id === s.sessionOwnerId,
  }));
  // du selbst auch dann, wenn Spotify dich nicht in der Liste führt
  if (self && !out.some((m) => m.me)) out.unshift({ id: "me", name: self.name, img: self.img, me: true, host: !!s.isSessionOwner });
  // nur anzeigen, wenn wirklich jemand dabei ist
  return out.length > 1 ? out : [];
}

export { jamMembers };
