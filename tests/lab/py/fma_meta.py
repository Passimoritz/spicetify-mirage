"""FMA-Metadaten -> {"fma<id>": {genreTop, fmaGenres[...], title, artist, year}} nur fuer die Teilmenge "small"."""
import csv, json, sys, ast
tracks, genres, out = sys.argv[1], sys.argv[2], sys.argv[3]
gt = {r["genre_id"]: r["title"] for r in csv.DictReader(open(genres, encoding="utf8"))}
rd = csv.reader(open(tracks, encoding="utf8"))
h1, h2 = next(rd), next(rd)
next(rd)
cols = {(a, b): i for i, (a, b) in enumerate(zip(h1, h2))}
res = {}
for r in rd:
    if r[cols[("set", "subset")]] != "small":
        continue
    tid = "fma%06d" % int(r[0])
    gl = ast.literal_eval(r[cols[("track", "genres")]] or "[]")
    res[tid] = {"genreTop": r[cols[("track", "genre_top")]], "fmaGenres": [gt[str(g)] for g in gl if str(g) in gt],
                "title": r[cols[("track", "title")]], "artist": r[cols[("artist", "name")]], "year": r[cols[("album", "date_released")]][:4]}
json.dump(res, open(out, "w", encoding="utf8"), ensure_ascii=False)
from collections import Counter
print(len(res), Counter(v["genreTop"] for v in res.values()))
