"""Audio (oder Harmonix-Mel-Spektrogramm) -> Mirage-/Spotify-Analyseformat (bars, beats, tatums, sections, segments).

Aufruf:
  python -I analyze.py audio <manifest.jsonl|dir> <outdir> [--jobs N]      (mp3/m4a/wav, 30-s-Clips oder ganze Songs)
  python -I analyze.py hxmel <melspec_dir> <harmonix_dataset_dir> <outdir>  (ganze Songs aus den Harmonix-Mels)
  python -I analyze.py align <prev_hx_dir> <melspec_dir> <harmonix_dataset_dir> <outdir>

Naeherung der Spotify-Klangfarbe (timbre, 12 Werte je Segment) – Mirage liest nur [1], [2], [3]:
  t0 = Lautheit (Mittel dB + 60)          t1 = Helligkeit: log2(Schwerpunkt/1 kHz) * 60
  t2 = Flachheit (rauschig): (log10(spectral flatness) + 2.5) * 40
  t3 = Anschlag: Onset-Staerke am Segmentanfang als z-Wert * 30
  t4..t11 = MFCC 2..9 (Mittel ueber das Segment)
Lautheit: RMS in dBFS je Frame (bei Mels auf 95 %-Perzentil = -5 dB kalibriert). Tonhoehen: Chroma, Maximum = 1.
Takte: Phase im 4er-Takt mit der staerksten Bass-Einsatz- plus Harmoniewechsel-Summe.
Abschnitte: Checkerboard-Neuheit auf schlag-synchronen MFCC+Chroma (+Lautheit), Mindestabstand 8 Takte.
"""
import sys, os, json, glob, math
import numpy as np

KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def key_of(chroma_mean):
    if np.std(chroma_mean) < 0.02:  # flaches Chroma (Mels): Tonart unbekannt
        return -1, 1, 0.0
    best = (-9, 0, 1)
    for k in range(12):
        for mode, prof in ((1, KS_MAJ), (0, KS_MIN)):
            r = np.corrcoef(np.roll(prof, k), chroma_mean)[0, 1]
            if np.isfinite(r) and r > best[0]:
                best = (r, k, mode)
    return best[1], best[2], float(max(0, best[0]))


def zs(x):
    x = np.asarray(x, float)
    s = x.std()
    return (x - x.mean()) / (s if s > 1e-9 else 1)


def downbeat_phase(beat_frames, low_on, chroma):
    """Phase 0..3 der Eins: Bass-Einsaetze und Harmoniewechsel liegen bevorzugt auf der Eins."""
    if len(beat_frames) < 8:
        return 0
    lo = np.array([low_on[max(0, f - 1):f + 2].max() for f in beat_frames])
    ch = chroma[:, beat_frames]
    chg = np.r_[0, np.linalg.norm(np.diff(ch, axis=1), axis=0)]
    sc = zs(lo) + zs(chg)
    return int(np.argmax([sc[p::4].mean() for p in range(4)]))


def novelty_sections(feat, beat_times, dur, loud_beats):
    """Abschnittsgrenzen (Sekunden) wie Spotify: Neuheit auf Selbstaehnlichkeit, grob (8-30 s)."""
    n = feat.shape[1]
    if n < 24:
        return [0.0]
    F = feat / (np.linalg.norm(feat, axis=0, keepdims=True) + 1e-9)
    S = F.T @ F
    L = 8
    kern = np.ones((2 * L, 2 * L))
    kern[:L, L:] = -1
    kern[L:, :L] = -1
    g = np.exp(-((np.arange(2 * L) - L + 0.5) ** 2) / (2 * (L / 2) ** 2))
    kern *= np.outer(g, g)
    nov = np.zeros(n)
    Sp = np.pad(S, L, mode="edge")
    for i in range(n):
        nov[i] = (Sp[i:i + 2 * L, i:i + 2 * L] * kern).sum()
    # Lautheitssprung zaehlt mit (Spotify trennt vor allem dort)
    ld = np.abs(np.convolve(np.r_[np.diff(loud_beats), 0], np.ones(4) / 4, "same"))
    nov = zs(nov) + 0.6 * zs(ld)
    peaks = []
    order = np.argsort(-nov)
    for i in order:
        if nov[i] < 0.6:
            break
        if all(abs(i - p) >= 28 for p in peaks) and 6 <= i <= n - 6:
            peaks.append(i)
    peaks.sort()
    return [0.0] + [float(beat_times[p]) for p in peaks]


def build(times, rms_db, onset, low_on, centroid, flat, chroma, mfcc, dur, hop_t, beats_fixed=None, downbeats_fixed=None):
    import librosa
    sr_like = 1.0 / hop_t
    T = len(times)
    if beats_fixed is None:
        tempo, bf = librosa.beat.beat_track(onset_envelope=onset, sr=22050, hop_length=int(round(22050 * hop_t)), trim=False, units="frames")
        bf = np.asarray(bf, int)
    else:
        bf = np.clip(np.round(np.asarray(beats_fixed) / hop_t).astype(int), 0, T - 1)
    bf = bf[(bf >= 0) & (bf < T)]
    if len(bf) < 4:
        return None
    btimes = times[bf] if beats_fixed is None else np.asarray(beats_fixed, float)
    gaps = np.diff(btimes)
    bpm = 60.0 / np.median(gaps) if len(gaps) else 120.0
    on_n = onset / (np.percentile(onset, 98) + 1e-9)
    beats = []
    for i, t in enumerate(btimes):
        d = gaps[i] if i < len(gaps) else (gaps[-1] if len(gaps) else 0.5)
        beats.append({"start": round(float(t), 3), "duration": round(float(d), 3), "confidence": round(float(np.clip(on_n[bf[i]], 0, 1)), 3)})
    if downbeats_fixed is not None:
        bars_t = list(downbeats_fixed)
    else:
        ph = downbeat_phase(bf, low_on, chroma)
        bars_t = [float(btimes[i]) for i in range(ph, len(btimes), 4)]
    bars = [{"start": round(t, 3), "duration": round(float(bars_t[i + 1] - t) if i + 1 < len(bars_t) else 4 * 60 / bpm, 3), "confidence": 0.6} for i, t in enumerate(bars_t)]
    tatums = []
    for b in beats:
        tatums.append({"start": b["start"], "duration": round(b["duration"] / 2, 3), "confidence": 0.5})
        tatums.append({"start": round(b["start"] + b["duration"] / 2, 3), "duration": round(b["duration"] / 2, 3), "confidence": 0.5})
    # Segmente: Einsaetze (zurueckgesetzt auf das Minimum davor), dazu jeder Schlag – wie Spotify ca. 3-6 je Sekunde
    of = librosa.onset.onset_detect(onset_envelope=onset, sr=22050, hop_length=int(round(22050 * hop_t)), backtrack=True, units="frames")
    cuts = np.unique(np.r_[0, of, bf])
    keep = [cuts[0]]
    mingap = max(1, int(round(0.08 / hop_t)))
    for c in cuts[1:]:
        if c - keep[-1] >= mingap:
            keep.append(c)
    # lange Segmente teilen (Spotify: selten ueber 1 s)
    out = []
    for i, c in enumerate(keep):
        e = keep[i + 1] if i + 1 < len(keep) else T
        while e - c > int(1.0 / hop_t):
            out.append(c)
            c += int(0.5 / hop_t)
        out.append(c)
    keep = sorted(set(out))
    on_z = (onset - onset.mean()) / (onset.std() + 1e-9)
    segs = []
    for i, c in enumerate(keep):
        e = keep[i + 1] if i + 1 < len(keep) else T
        if e <= c:
            continue
        sl = slice(c, e)
        ld = rms_db[sl]
        im = int(np.argmax(ld))
        ch = chroma[:, sl].mean(axis=1)
        ch = ch / (ch.max() + 1e-9)
        cen = float(np.median(centroid[sl]))
        fl = float(np.median(flat[sl]))
        att = float(on_z[c:min(T, c + max(2, int(0.05 / hop_t)))].max())
        mf = mfcc[2:10, sl].mean(axis=1)
        timbre = [float(ld.mean() + 60), math.log2(max(cen, 50) / 1000.0) * 60, (math.log10(max(fl, 1e-6)) + 2.5) * 40, att * 30] + [float(v) for v in mf]
        segs.append({"start": round(float(times[c]), 3), "duration": round(float((e - c) * hop_t), 3), "confidence": 0.5,
                     "loudness_start": round(float(ld[0]), 2), "loudness_max": round(float(ld[im]), 2), "loudness_max_time": round(im * hop_t, 3),
                     "pitches": [round(float(v), 3) for v in ch], "timbre": [round(v, 2) for v in timbre]})
    # Abschnitte
    bsync = np.vstack([zs_rows(mfcc[1:13]), zs_rows(chroma)])[:, bf]
    loud_b = rms_db[bf]
    starts = novelty_sections(bsync, btimes, dur, loud_b)
    sections = []
    for i, s0 in enumerate(starts):
        s1 = starts[i + 1] if i + 1 < len(starts) else dur
        f0, f1 = int(s0 / hop_t), max(int(s0 / hop_t) + 1, int(s1 / hop_t))
        k, m, kc = key_of(chroma[:, f0:f1].mean(axis=1))
        bi = [j for j, t in enumerate(btimes) if s0 <= t < s1]
        lt = 60 / np.median(np.diff(btimes[bi])) if len(bi) > 4 else bpm
        sections.append({"start": round(s0, 3), "duration": round(s1 - s0, 3), "confidence": 0.5, "loudness": round(float(np.mean(rms_db[f0:f1])), 2),
                         "tempo": round(float(lt), 2), "tempo_confidence": 0.6, "key": k, "key_confidence": round(kc, 2), "mode": m, "mode_confidence": 0.5,
                         "time_signature": 4, "time_signature_confidence": 0.8})
    k, m, _ = key_of(chroma.mean(axis=1))
    loud = float(10 * np.log10(np.mean(10 ** (rms_db / 10)) + 1e-12))
    return {"track": {"duration": round(dur, 3), "tempo": round(float(bpm), 2), "loudness": round(loud, 2), "key": k, "mode": m, "time_signature": 4},
            "bars": bars, "beats": beats, "tatums": tatums, "sections": sections, "segments": segs}


def zs_rows(a):
    return (a - a.mean(axis=1, keepdims=True)) / (a.std(axis=1, keepdims=True) + 1e-9)


def decode(path, sr):
    """m4a (AAC, iTunes) kann libsndfile nicht: ffmpeg dekodiert nach float32 mono."""
    import librosa
    if not path.lower().endswith(".m4a"):
        return librosa.load(path, sr=sr, mono=True)
    import subprocess
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True, timeout=60).stdout
    return np.frombuffer(raw, dtype=np.float32).copy(), sr


def feats_audio(path):
    import librosa
    y, sr = decode(path, 22050)
    if len(y) < sr * 5:
        return None
    hop = 512
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    P = S ** 2
    mel = librosa.feature.melspectrogram(S=P, sr=sr, n_mels=128)
    logmel = librosa.power_to_db(mel)
    onset = librosa.onset.onset_strength(S=logmel, sr=sr, hop_length=hop, center=False)[: logmel.shape[1]]
    low = librosa.onset.onset_strength(S=logmel[:12], sr=sr, hop_length=hop, center=False)[: logmel.shape[1]]
    rms = librosa.feature.rms(S=S, frame_length=2048, hop_length=hop)[0]
    # Lautheit wie gehoert: A-bewertet (Bass zaehlt weniger, sonst schwankt jeder Frame mit der Kick um 10 dB)
    # und ueber ~120 ms integriert; +6 dB: Spotifys Segment-Lautheit liegt eher beim Spitzenwert als beim RMS
    wA = 10 ** (librosa.A_weighting(librosa.fft_frequencies(sr=sr, n_fft=2048)) / 10)
    share = (P * wA[:, None]).sum(axis=0) / (P.sum(axis=0) + 1e-12)
    pw = (rms * math.sqrt(2)) ** 2 * share
    pw = np.convolve(pw, np.ones(5) / 5, "same")
    # +11 dB gesamt: Spotifys Pegel (Charts-Pop um -6 dB, Testlabor-Abgleich mit Deezer-Vorschauen)
    rms_db = 10 * np.log10(np.maximum(pw, 1e-10)) + 11
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    flat = librosa.feature.spectral_flatness(S=S)[0]
    chroma = librosa.feature.chroma_stft(S=P, sr=sr)
    mfcc = librosa.feature.mfcc(S=logmel, n_mfcc=13)
    T = min(S.shape[1], len(onset))
    times = librosa.frames_to_time(np.arange(T), sr=sr, hop_length=hop)
    return dict(times=times, rms_db=rms_db[:T], onset=onset[:T], low_on=low[:T], centroid=centroid[:T], flat=flat[:T], chroma=chroma[:, :T], mfcc=mfcc[:, :T], dur=len(y) / sr, hop_t=hop / sr), logmel


MEL_SR, MEL_HOP = 22050, 1024  # info.json der Harmonix-Mels: 80 Baender, fmin 0, fmax sr/2


def mel_centers():
    import librosa
    return librosa.mel_frequencies(n_mels=80 + 2, fmin=0, fmax=MEL_SR / 2)[1:-1]


def feats_mel(mel):
    """Merkmale aus einem Harmonix-Mel-Spektrogramm (Leistung, 80 Baender, 22,05 kHz, Hop 1024).
    80 Mel-Baender sind unten zu grob fuer Tonklassen: Chroma bleibt flach (keine Tonart, keine gehaltenen Toene)."""
    import librosa
    hop_t = MEL_HOP / MEL_SR
    mel = np.maximum(mel, 1e-10)
    logmel = librosa.power_to_db(mel)
    onset = librosa.onset.onset_strength(S=logmel, sr=MEL_SR, hop_length=MEL_HOP, center=False)[: logmel.shape[1]]
    low = librosa.onset.onset_strength(S=logmel[:8], sr=MEL_SR, hop_length=MEL_HOP, center=False)[: logmel.shape[1]]
    fc = mel_centers()
    tot = mel.sum(axis=0)
    # wie beim Audio: A-bewertet und ueber ~140 ms integriert, dann auf 95 %-Perzentil = -5 dB gesetzt
    wA = 10 ** (librosa.A_weighting(np.maximum(fc, 10)) / 10)
    db = 10 * np.log10(np.convolve((mel * wA[:, None]).sum(axis=0), np.ones(3) / 3, "same") + 1e-12)
    db = db - np.percentile(db, 95) - 2
    centroid = (mel * fc[:, None]).sum(axis=0) / (tot + 1e-12)
    flat = np.exp(np.mean(np.log(mel), axis=0)) / (np.mean(mel, axis=0) + 1e-12)
    chroma = np.full((12, mel.shape[1]), 0.6) + 0.02 * np.random.default_rng(0).random((12, mel.shape[1]))
    mfcc = librosa.feature.mfcc(S=logmel, n_mfcc=13)
    T = min(mel.shape[1], len(onset))
    times = np.arange(T) * hop_t
    return dict(times=times, rms_db=db[:T], onset=onset[:T], low_on=low[:T], centroid=centroid[:T], flat=flat[:T], chroma=chroma[:, :T], mfcc=mfcc[:, :T], dur=T * hop_t, hop_t=hop_t)


def job_audio(args):
    path, outp, meta = args
    if os.path.exists(outp):
        return outp
    try:
        f, _ = feats_audio(path)
        if f is None:
            return None
        a = build(**f)
        if a is None:
            return None
        a["meta"] = meta
        json.dump(a, open(outp, "w"), separators=(",", ":"))
        return outp
    except Exception as e:
        sys.stderr.write("ERR %s %s\n" % (path, e))
        return None


def read_truth(ds, name):
    bd = np.loadtxt(os.path.join(ds, "beats_and_downbeats", name + ".txt"), ndmin=2)
    seg = [l.split() for l in open(os.path.join(ds, "segments", name + ".txt"), encoding="utf8") if l.strip()]
    return {"beats": [float(x) for x in bd[:, 0]], "downbeats": [float(r[0]) for r in bd if int(r[1]) == 1],
            "segments": [[float(s[0]), s[1] if len(s) > 1 else ""] for s in seg]}


def job_hxmel(args):
    melp, ds, outdir, meta = args
    name = os.path.basename(melp).replace("-mel.npy", "")
    try:
        mel = np.load(melp)
        f = feats_mel(mel)
        tr = read_truth(ds, name)
        res = {}
        # T: Schlaege und Einsen aus der Annotation (wie eine gute Spotify-Analyse), E: alles geschaetzt
        for tag, bfix, dfix in (("T", tr["beats"], tr["downbeats"]), ("E", None, None)):
            outp = os.path.join(outdir, "hx%s_%s.json" % (tag, name))
            if os.path.exists(outp):
                continue
            a = build(**f, beats_fixed=bfix, downbeats_fixed=dfix)
            if a is None:
                continue
            a["meta"] = dict(meta, truth=tr, id="hx%s_%s" % (tag, name), variant=tag)
            json.dump(a, open(outp, "w"), separators=(",", ":"))
            res[tag] = outp
        return res
    except Exception as e:
        sys.stderr.write("ERR %s %s\n" % (melp, e))
        return None


def job_align(args):
    """Vorschau auf die Harmonix-Zeitachse legen: Mel der Vorschau mit denselben Parametern, Kreuzkorrelation
    der (spaltennormierten) Log-Mels ueber alle Versaetze. Gut = hohe, eindeutige Spitze."""
    import librosa
    path, melp, ds, outp, meta = args
    try:
        y, _ = decode(path, MEL_SR)
        pm = librosa.feature.melspectrogram(y=y, sr=MEL_SR, n_fft=2048, hop_length=MEL_HOP, power=2.0, n_mels=80, fmin=0, fmax=None)
        ref = np.load(melp)
        A = librosa.power_to_db(np.maximum(ref, 1e-10))
        B = librosa.power_to_db(np.maximum(pm, 1e-10))
        A = (A - A.mean(axis=0)) / (A.std(axis=0) + 1e-9)
        B = (B - B.mean(axis=0)) / (B.std(axis=0) + 1e-9)
        n = B.shape[1]
        if A.shape[1] < n + 10:
            return None
        # Korrelation je Versatz ueber alle Baender (FFT pro Band waere schneller; so reicht es fuer 900 Songs)
        sc = np.zeros(A.shape[1] - n + 1)
        for b in range(80):
            sc += np.correlate(A[b], B[b], mode="valid")
        sc /= (80 * n)
        k = int(np.argmax(sc))
        top = float(sc[k])
        mask = np.ones_like(sc, bool)
        mask[max(0, k - 20):k + 21] = False
        second = float(sc[mask].max()) if mask.any() else 0
        off = k * MEL_HOP / MEL_SR
        tr = read_truth(ds, os.path.basename(melp).replace("-mel.npy", ""))
        dur = len(y) / MEL_SR
        cut = lambda arr: [round(t - off, 3) for t in arr if off <= t < off + dur]
        meta = dict(meta, align={"offset": round(off, 3), "score": round(top, 3), "second": round(second, 3)})
        ok = top > 0.45 and top - second > 0.08
        meta["aligned"] = ok
        if ok:
            meta["truth"] = {"beats": cut(tr["beats"]), "downbeats": cut(tr["downbeats"]),
                             "segments": [[round(s - off, 3), l] for s, l in tr["segments"] if off - 30 <= s < off + dur]}
        f, _ = feats_audio(path)
        a = build(**f)
        if a is None:
            return None
        a["meta"] = meta
        json.dump(a, open(outp, "w"), separators=(",", ":"))
        return ok
    except Exception as e:
        sys.stderr.write("ERR %s %s\n" % (path, e))
        return None


def main():
    from multiprocessing import Pool
    mode = sys.argv[1]
    jobs = int(sys.argv[sys.argv.index("--jobs") + 1]) if "--jobs" in sys.argv else 14
    tasks, fn = [], None
    if mode == "audio":
        src, outdir = sys.argv[2], sys.argv[3]
        os.makedirs(outdir, exist_ok=True)
        if src.endswith(".jsonl"):
            base = os.path.join(os.path.dirname(src), "audio")
            for line in open(src, encoding="utf8"):
                m = json.loads(line)
                tasks.append((os.path.join(base, m["file"]), os.path.join(outdir, m["id"] + ".json"), m))
        else:
            for p in glob.glob(os.path.join(src, "**", "*.mp3"), recursive=True):
                i = os.path.splitext(os.path.basename(p))[0]
                tasks.append((p, os.path.join(outdir, "fma" + i + ".json"), {"id": "fma" + i, "fma": int(i)}))
        fn = job_audio
    elif mode == "hxmel":
        mdir, ds, outdir = sys.argv[2], sys.argv[3], sys.argv[4]
        os.makedirs(outdir, exist_ok=True)
        import csv
        md = {r["File"]: r for r in csv.DictReader(open(os.path.join(ds, "metadata.csv"), encoding="utf8"))}
        for p in sorted(glob.glob(os.path.join(mdir, "**", "*-mel.npy"), recursive=True)):
            name = os.path.basename(p).replace("-mel.npy", "")
            r = md.get(name, {})
            tasks.append((p, ds, outdir, {"title": r.get("Title"), "artist": r.get("Artist"), "hxGenre": r.get("Genre"), "hxBpm": float(r.get("BPM") or 0)}))
        fn = job_hxmel
    elif mode == "align":
        pdir, mdir, ds, outdir = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        os.makedirs(outdir, exist_ok=True)
        mels = {os.path.basename(p).replace("-mel.npy", ""): p for p in glob.glob(os.path.join(mdir, "**", "*-mel.npy"), recursive=True)}
        for line in open(os.path.join(pdir, "manifest.jsonl"), encoding="utf8"):
            m = json.loads(line)
            name = m["id"][3:]
            if name in mels:
                tasks.append((os.path.join(pdir, "audio", m["file"]), mels[name], ds, os.path.join(outdir, "hxP_" + name + ".json"), dict(m, id="hxP_" + name)))
        fn = job_align
    print("tasks", len(tasks), flush=True)
    done = 0
    with Pool(jobs) as pool:
        res = []
        for i, r in enumerate(pool.imap_unordered(fn, tasks, chunksize=4)):
            res.append(r)
            if i % 200 == 0:
                print(i, flush=True)
    print("ok", sum(1 for r in res if r), "of", len(tasks))
    if mode == "align":
        print("aligned", sum(1 for r in res if r is True))


if __name__ == "__main__":
    main()
