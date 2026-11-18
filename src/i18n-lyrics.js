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
  es: {
    onlineLyricsHint: "Si Spotify no tiene letra sincronizada, Mirage pregunta a la vez a LRCLIB, NetEase y Kugou, y luego a lyrics.ovh – solo se envían título, artista, álbum y duración. Para el karaoke también busca en la colección palabra por palabra AMLL de GitHub, que solo recibe el número de la canción en NetEase",
    lyrAutoHint: "Primero Spotify, luego LRCLIB, NetEase, Kugou y lyrics.ovh",
    karaokeHint: "Las palabras se iluminan una tras otra – exacto con los tiempos por palabra de Spotify, NetEase o AMLL; si no, estimado",
  },
  fr: {
    onlineLyricsHint: "Si Spotify n'a pas de paroles synchronisées, Mirage interroge en même temps LRCLIB, NetEase et Kugou, puis lyrics.ovh – seuls le titre, l'artiste, l'album et la durée sont envoyés. Pour le karaoké, il cherche aussi dans la collection mot à mot AMLL sur GitHub, qui ne reçoit que le numéro du titre chez NetEase",
    lyrAutoHint: "D'abord Spotify, puis LRCLIB, NetEase, Kugou et lyrics.ovh",
    karaokeHint: "Les mots s'allument l'un après l'autre – précis avec le timing des mots de Spotify, NetEase ou AMLL, sinon estimé",
  },
  it: {
    onlineLyricsHint: "Se Spotify non ha un testo sincronizzato, Mirage chiede contemporaneamente a LRCLIB, NetEase e Kugou, poi a lyrics.ovh – vengono inviati solo titolo, artista, album e durata. Per il karaoke cerca anche nella raccolta parola per parola AMLL su GitHub, che riceve solo il numero del brano su NetEase",
    lyrAutoHint: "Prima Spotify, poi LRCLIB, NetEase, Kugou e lyrics.ovh",
    karaokeHint: "Le parole si illuminano una dopo l'altra – precise con i tempi per parola di Spotify, NetEase o AMLL, altrimenti stimate",
  },
  ja: {
    onlineLyricsHint: "Spotify にタイム同期歌詞がない場合、Mirage は LRCLIB・NetEase・Kugou に同時に問い合わせ、次に lyrics.ovh を探します – 送信するのは曲名、アーティスト、アルバム、長さだけです。カラオケ用には GitHub の単語単位コレクション AMLL も探します（渡すのは NetEase の曲番号だけ）",
    lyrAutoHint: "まず Spotify、次に LRCLIB・NetEase・Kugou・lyrics.ovh",
    karaokeHint: "単語が順に光ります – Spotify・NetEase・AMLL の単語タイミングがあれば正確、なければ推定",
  },
  ko: {
    onlineLyricsHint: "Spotify에 시간 동기화 가사가 없으면 Mirage가 LRCLIB, NetEase, Kugou에 동시에 묻고, 그다음 lyrics.ovh를 찾아요 – 제목, 아티스트, 앨범, 길이만 전송돼요. 노래방용으로는 GitHub의 단어 단위 모음 AMLL도 찾아보는데, 여기에는 NetEase 곡 번호만 전달돼요",
    lyrAutoHint: "먼저 Spotify, 그다음 LRCLIB, NetEase, Kugou, lyrics.ovh",
    karaokeHint: "단어가 차례로 빛나요 – Spotify, NetEase, AMLL의 단어 타이밍이 있으면 정확하게, 없으면 추정",
  },
  nl: {
    onlineLyricsHint: "Heeft Spotify geen getimede songtekst, dan vraagt Mirage tegelijk LRCLIB, NetEase en Kugou, daarna lyrics.ovh – alleen titel, artiest, album en duur worden verstuurd. Voor karaoke kijkt Mirage ook in de woord-voor-woordcollectie AMLL op GitHub, die alleen het NetEase-nummer van het lied krijgt",
    lyrAutoHint: "Eerst Spotify, dan LRCLIB, NetEase, Kugou en lyrics.ovh",
    karaokeHint: "Woorden lichten na elkaar op – exact met woordtiming van Spotify, NetEase of AMLL, anders geschat",
  },
  pl: {
    onlineLyricsHint: "Jeśli Spotify nie ma tekstu zsynchronizowanego w czasie, Mirage pyta jednocześnie LRCLIB, NetEase i Kugou, a potem lyrics.ovh – wysyłane są tylko tytuł, wykonawca, album i długość. Dla karaoke szuka też w kolekcji AMLL słowo po słowie na GitHubie, która dostaje tylko numer utworu w NetEase",
    lyrAutoHint: "Najpierw Spotify, potem LRCLIB, NetEase, Kugou i lyrics.ovh",
    karaokeHint: "Słowa podświetlają się po kolei – dokładnie z czasami słów ze Spotify, NetEase lub AMLL, w przeciwnym razie szacunkowo",
  },
  pt: {
    onlineLyricsHint: "Se o Spotify não tiver letra sincronizada, o Mirage pergunta ao mesmo tempo ao LRCLIB, NetEase e Kugou, depois ao lyrics.ovh – só são enviados título, artista, álbum e duração. Para o karaoke procura também na coleção palavra a palavra AMLL no GitHub, que só recebe o número da música no NetEase",
    lyrAutoHint: "Primeiro Spotify, depois LRCLIB, NetEase, Kugou e lyrics.ovh",
    karaokeHint: "As palavras acendem uma após a outra – exato com os tempos por palavra do Spotify, NetEase ou AMLL, senão estimado",
  },
  ru: {
    onlineLyricsHint: "Если у Spotify нет синхронизированного текста, Mirage одновременно спрашивает LRCLIB, NetEase и Kugou, затем lyrics.ovh – передаются только название, исполнитель, альбом и длительность. Для караоке Mirage также ищет в пословной коллекции AMLL на GitHub, которая получает только номер песни в NetEase",
    lyrAutoHint: "Сначала Spotify, затем LRCLIB, NetEase, Kugou и lyrics.ovh",
    karaokeHint: "Слова подсвечиваются по очереди – точно, если есть тайминг слов из Spotify, NetEase или AMLL, иначе приблизительно",
  },
  tr: {
    onlineLyricsHint: "Spotify'da zamanlı söz yoksa Mirage aynı anda LRCLIB, NetEase ve Kugou'ya, ardından lyrics.ovh'a sorar – yalnızca şarkı adı, sanatçı, albüm ve süre gönderilir. Karaoke için ayrıca GitHub'daki kelime kelime AMLL koleksiyonuna bakar; ona yalnızca NetEase şarkı numarası gider",
    lyrAutoHint: "Önce Spotify, sonra LRCLIB, NetEase, Kugou ve lyrics.ovh",
    karaokeHint: "Kelimeler tek tek yanar – Spotify, NetEase ya da AMLL'den gelen kelime zamanlamasıyla tam, değilse tahmini",
  },
  uk: {
    onlineLyricsHint: "Якщо в Spotify немає синхронізованого тексту, Mirage одночасно питає LRCLIB, NetEase і Kugou, потім lyrics.ovh – передаються лише назва, виконавець, альбом і тривалість. Для караоке Mirage також шукає в пословній колекції AMLL на GitHub, яка отримує лише номер пісні в NetEase",
    lyrAutoHint: "Спершу Spotify, потім LRCLIB, NetEase, Kugou і lyrics.ovh",
    karaokeHint: "Слова підсвічуються по черзі – точно, якщо є таймінг слів зі Spotify, NetEase або AMLL, інакше приблизно",
  },
  zh: {
    onlineLyricsHint: "如果 Spotify 没有时间同步歌词，Mirage 会同时向 LRCLIB、NetEase 和 Kugou 查询，然后是 lyrics.ovh – 只发送歌名、艺人、专辑和时长。卡拉 OK 还会在 GitHub 上的逐字歌词库 AMLL 中查找，它只会收到 NetEase 的歌曲编号",
    lyrAutoHint: "先 Spotify，然后 LRCLIB、NetEase、Kugou 和 lyrics.ovh",
    karaokeHint: "歌词逐字亮起 – 有 Spotify、NetEase 或 AMLL 的逐字时间时精确，否则为估算",
  },
};
