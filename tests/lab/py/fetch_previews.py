"""Holt offizielle 30-s-Vorschauen (Deezer-API, iTunes-Search-API) fuer das Testlabor.
Hoeflich: hoechstens ~4 Anfragen/s, Wiederholung mit Backoff, neutraler User-Agent.
Aufruf: python -I fetch_previews.py <outdir> [--harmonix metadata.csv] [--max N]
Schreibt <outdir>/manifest.jsonl (eine Zeile je Song) und <outdir>/audio/<id>.(mp3|m4a)."""
import json, os, sys, time, random, urllib.request, urllib.parse, csv

UA = "audio-lab/1.0 (research test harness)"
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
MAN = os.path.join(OUT, "manifest.jsonl")
_last = [0.0]


def get(url, binary=False, tries=5):
    for k in range(tries):
        wait = 0.26 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
            if binary:
                return data
            j = json.loads(data)
            if isinstance(j, dict) and j.get("error"):
                # Deezer-Quota: kurz warten
                time.sleep(2 + 3 * k)
                continue
            return j
        except Exception as e:  # noqa
            time.sleep(1.5 * (2 ** k) + random.random())
    return None


seen = set()
if os.path.exists(MAN):
    for line in open(MAN, encoding="utf8"):
        try:
            seen.add(json.loads(line)["id"])
        except Exception:
            pass
man = open(MAN, "a", encoding="utf8")
count = [len(seen)]
LIMIT = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 5000


def save(rec, url, ext):
    if rec["id"] in seen or not url or count[0] >= LIMIT:
        return False
    path = os.path.join(OUT, "audio", rec["id"] + ext)
    if not os.path.exists(path):
        b = get(url, binary=True)
        if not b or len(b) < 20000:
            return False
        open(path, "wb").write(b)
    rec["file"] = os.path.basename(path)
    man.write(json.dumps(rec, ensure_ascii=False) + "\n")
    man.flush()
    seen.add(rec["id"])
    count[0] += 1
    return True


def dz_rec(t, genre, src):
    return {"id": "dz" + str(t["id"]), "src": src, "title": t.get("title", ""), "artist": (t.get("artist") or {}).get("name", ""),
            "dzGenre": genre, "rank": t.get("rank", 0), "dzId": t["id"]}


def harmonix(csv_path):
    rows = list(csv.DictReader(open(csv_path, encoding="utf8")))
    for r in rows:
        if count[0] >= LIMIT:
            break
        rid = "hx_" + r["File"]
        if rid in seen:
            continue
        q = 'artist:"%s" track:"%s"' % (r["Artist"], r["Title"])
        res = get("https://api.deezer.com/search?" + urllib.parse.urlencode({"q": q, "limit": 5}))
        hit = (res or {}).get("data") or []
        hit = [h for h in hit if h.get("preview")]
        if not hit:
            res = get("https://api.deezer.com/search?" + urllib.parse.urlencode({"q": r["Artist"] + " " + r["Title"], "limit": 5}))
            hit = [h for h in ((res or {}).get("data") or []) if h.get("preview")]
        if hit:
            t = hit[0]
            full = get("https://api.deezer.com/track/%d" % t["id"]) or {}
            rec = {"id": rid, "src": "harmonix-deezer", "title": r["Title"], "artist": r["Artist"], "hxGenre": r["Genre"], "hxBpm": float(r["BPM"] or 0),
                   "dzId": t["id"], "dzBpm": full.get("bpm", 0), "dzDuration": full.get("duration", 0), "hxDuration": float(r["Duration"] or 0)}
            save(rec, t["preview"], ".mp3")
            continue
        res = get("https://itunes.apple.com/search?" + urllib.parse.urlencode({"term": r["Artist"] + " " + r["Title"], "media": "music", "entity": "song", "limit": 5}))
        hit = [h for h in ((res or {}).get("results") or []) if h.get("previewUrl")]
        if hit:
            t = hit[0]
            rec = {"id": rid, "src": "harmonix-itunes", "title": r["Title"], "artist": r["Artist"], "hxGenre": r["Genre"], "hxBpm": float(r["BPM"] or 0),
                   "apple": t.get("primaryGenreName", ""), "hxDuration": float(r["Duration"] or 0), "itDuration": (t.get("trackTimeMillis") or 0) / 1000}
            save(rec, t["previewUrl"], ".m4a")


def deezer_charts(per):
    genres = (get("https://api.deezer.com/genre") or {}).get("data") or []
    for g in genres:
        if g["id"] in (0, 457):  # „Alle“, Hoerbuecher
            continue
        ch = (get("https://api.deezer.com/chart/%d/tracks?limit=100" % g["id"]) or {}).get("data") or []
        n = 0
        for t in ch:
            if n >= per:
                break
            if save(dz_rec(t, g["name"], "deezer-chart"), t.get("preview"), ".mp3"):
                n += 1
        # dazu die Top-Songs einiger Kuenstler des Genres (mehr Breite als nur die Charts)
        arts = (get("https://api.deezer.com/genre/%d/artists" % g["id"]) or {}).get("data") or []
        for a in arts[:25]:
            if n >= per * 2:
                break
            top = (get("https://api.deezer.com/artist/%d/top?limit=3" % a["id"]) or {}).get("data") or []
            for t in top[:2]:
                if save(dz_rec(t, g["name"], "deezer-artist"), t.get("preview"), ".mp3"):
                    n += 1


# iTunes: Genres, Regionen und Jahrzehnte, die Mirage kennt (Suchbegriffe, kein Scraping)
IT_TERMS = [
    ("techno", "DE"), ("house music", "US"), ("trance", "NL"), ("drum and bass", "GB"), ("dubstep", "GB"), ("hardstyle", "NL"), ("eurodance", "DE"),
    ("trap", "US"), ("drill", "GB"), ("boom bap", "US"), ("deutschrap", "DE"), ("rap francais", "FR"), ("k-pop", "KR"), ("j-pop", "JP"),
    ("city pop", "JP"), ("mandopop", "TW"), ("bollywood", "IN"), ("punjabi", "IN"), ("reggaeton", "MX"), ("salsa", "US"), ("bachata", "US"),
    ("cumbia", "MX"), ("banda", "MX"), ("corridos", "MX"), ("samba", "BR"), ("sertanejo", "BR"), ("funk carioca", "BR"), ("bossa nova", "BR"),
    ("forro", "BR"), ("afrobeats", "NG"), ("amapiano", "ZA"), ("highlife", "GB"), ("reggae", "JM"), ("dancehall", "JM"), ("ska", "GB"),
    ("flamenco", "ES"), ("fado", "PT"), ("chanson", "FR"), ("schlager", "DE"), ("volksmusik", "AT"), ("polka", "US"), ("klezmer", "US"),
    ("celtic", "IE"), ("bluegrass", "US"), ("country", "US"), ("americana", "US"), ("blues", "US"), ("jazz", "US"), ("bebop", "US"), ("swing", "US"),
    ("smooth jazz", "US"), ("soul", "US"), ("funk", "US"), ("disco", "US"), ("gospel", "US"), ("r&b", "US"), ("classic rock", "US"), ("punk", "GB"),
    ("grunge", "US"), ("metal", "US"), ("death metal", "SE"), ("black metal", "NO"), ("metalcore", "US"), ("indie rock", "GB"), ("shoegaze", "GB"),
    ("emo", "US"), ("pop punk", "US"), ("synthwave", "US"), ("lofi", "US"), ("ambient", "GB"), ("classical", "DE"), ("opera", "IT"), ("baroque", "DE"),
    ("piano", "US"), ("soundtrack", "US"), ("anime", "JP"), ("enka", "JP"), ("arabic", "EG"), ("rai", "FR"), ("turkish pop", "TR"), ("greek", "GR"),
    ("balkan", "RS"), ("persian", "US"), ("qawwali", "PK"), ("kids songs", "US"), ("christmas", "US"), ("worship", "US"), ("80s hits", "US"),
    ("70s hits", "US"), ("60s", "US"), ("90s dance", "DE"), ("2000s pop", "US"), ("italo disco", "IT"), ("tango", "AR"), ("mariachi", "MX"),
    ("zouk", "FR"), ("soca", "TT"), ("kizomba", "PT"), ("hyperpop", "US"), ("phonk", "US"), ("drum & bass liquid", "GB"), ("psytrance", "IL"),
]


def itunes(per):
    for term, cc in IT_TERMS:
        res = get("https://itunes.apple.com/search?" + urllib.parse.urlencode({"term": term, "media": "music", "entity": "song", "limit": 50, "country": cc}))
        n = 0
        for t in (res or {}).get("results") or []:
            if n >= per:
                break
            rec = {"id": "it" + str(t.get("trackId")), "src": "itunes", "title": t.get("trackName", ""), "artist": t.get("artistName", ""),
                   "apple": t.get("primaryGenreName", ""), "term": term, "country": cc, "year": (t.get("releaseDate") or "")[:4]}
            if save(rec, t.get("previewUrl"), ".m4a"):
                n += 1


mode = sys.argv[2] if len(sys.argv) > 2 else "all"
if mode in ("harmonix", "all") and "--harmonix" in sys.argv:
    harmonix(sys.argv[sys.argv.index("--harmonix") + 1])
if mode in ("deezer", "all"):
    deezer_charts(int(os.environ.get("PER_GENRE", "60")))
if mode in ("itunes", "all"):
    itunes(int(os.environ.get("PER_TERM", "18")))
print("songs", count[0])
