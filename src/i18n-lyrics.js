/* Texte rund um die Liedtext-Quellen – Englisch und Deutsch, überschreiben die älteren Fassungen in i18n.js
   (die übrigen Sprachen nennen dort noch LRCLIB, NetEase und lyrics.ovh ohne Kugou und AMLL) */
export const LYRICS_TEXT = {
  en: {
    onlineLyricsHint: "If Spotify has no time-synced lyrics, Mirage asks LRCLIB, NetEase and Kugou at once, then lyrics.ovh – only title, artist, album and length are sent. For karaoke it also looks in the AMLL word-by-word collection on GitHub, which only gets the NetEase song number",
    lyrAutoHint: "Spotify first, then LRCLIB, NetEase, Kugou and lyrics.ovh",
    karaokeHint: "Words light up one after another – exact with word timing from Spotify, NetEase or AMLL, otherwise estimated",
  },
  de: {
    onlineLyricsHint: "Hat Spotify keinen zeitgenauen Liedtext, fragt Mirage gleichzeitig bei LRCLIB, NetEase und Kugou, danach bei lyrics.ovh – dafür gehen nur Titel, Künstler, Album und Länge raus. Für Karaoke schaut Mirage zusätzlich in die Wort-für-Wort-Sammlung AMLL auf GitHub, die nur die NetEase-Songnummer bekommt",
    lyrAutoHint: "Erst Spotify, dann LRCLIB, NetEase, Kugou und lyrics.ovh",
    karaokeHint: "Wörter leuchten nacheinander auf – mit Wortzeiten von Spotify, NetEase oder AMLL genau, sonst geschätzt",
  },
};
