# Changelog

All notable changes to Mirage are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release notes on GitHub are generated from the matching section of this file when a `v*` tag is pushed.

## [Unreleased]

<!-- Filled in by the theme author: add Added / Changed / Fixed / Removed entries here before tagging the next release. -->

## [Unreleased]

### Changed

- **Richer vibration on the phones.** Websites can only switch the vibration motor on and off – browsers give them no strength setting (only apps get that, and iPhones don't let websites vibrate at all). Mirage now makes strength the way a dimmed LED does: in 16 ms slices the motor is on for only part of the time. Each part of the song feels different: a firm buzz on the downbeat that grows with the energy, light taps on the backbeat in loud parts, ticks that get denser and stronger during a build-up, a swell into a long, full vibration on the drop, and nothing in quiet parts. The vibration button now steps through off, gentle, normal and strong, with a sample buzz each time.

## [1.15.4] – 2026-11-05

### Fixed

- **Song search on the phones now works like Spotify's own.** It uses Spotify's quick search (the one behind Ctrl+K), which is always loaded and forgives typos, finds parts of a title and artists on their own – “blindng lihgts” finds *Blinding Lights*, “levitat” finds *Levitating*, “weeknd” finds The Weeknd's songs. Before, the search used a part of Spotify that is only there after you open Spotify's search page, and the web API fallback was throttled by Spotify (error 429) – so it found nothing. Tested end to end with a real Spotify: answers in under a second.
- **The live link keeps running when Spotify is minimised or behind other windows.** The browser stops drawing then, and after 2.5 s the phones lost their light and the song wishes stopped answering. A tiny background clock now keeps it going while party mode is open.
- Old results disappear as soon as a new search starts.

## [1.15.3] – 2026-11-05

### Fixed

- **Song wishes find songs fast and reliably.** The search now uses the same path as Spotify's own search (instead of the web API, which Spotify often throttles), each phone gets the answer to its *last* input instead of dropped requests while typing, every search is answered – also when nothing is found – and the phone asks again once if the relay loses a message, then says clearly what is wrong. Repeated searches show up instantly.
- **Phones vibrate on the song's beat.** The phone used to count the beat from when a message *arrived* – the relay delay (50–500 ms, changing all the time) made it late and shaky. It now works out the clock difference to the PC and counts from when the message was *sent*: measured to within a few milliseconds. On top of the drop, it now gives a short buzz on every downbeat (and every beat in loud parts), and asks for a tap first if Android hasn't allowed vibration yet.
- **Smooth transitions in party mode.** When the PC struggled for a moment, the quality control switched the camera and 3D depth off at once – stage, crowd, title and lyrics jumped back to the centre and later jumped again. They now glide. Camera cuts are a quick, smooth swing instead of a hard jump, and the crowd keeps its places when the picture size changes instead of being shuffled anew.

## [1.15.2] – 2026-11-05

### Fixed

- **The Spotify window can be moved again in party and mix mode.** Lines that had already been sung scrolled invisibly up under the title bar and cancelled the drag strip there (Electron counts window regions in page order and ignores clipping). The drag strip now comes last, and the gaps between the buttons in the top bar can be grabbed too.
- **The overlay app now starts with Windows every time.** The startup entry had no quotation marks around a path with a space in it, so Windows found the app only some of the time. The app now writes the entry itself, quoted, and keeps a small start log (`start-log.txt` in its folder) for troubleshooting.

## [1.15.1] – 2026-11-05

### Added

- **Install the overlay app with Scoop:** `scoop install https://raw.githubusercontent.com/Passimoritz/spicetify-mirage/main/packaging/scoop/mirage-overlay.json`. Manifests for winget and Homebrew are prepared in `packaging/`.
- New preview pictures for the Spicetify Marketplace and for link previews.

### Fixed

- Close camera cuts in party mode pushed the crowd out of the picture at the bottom – the shots are now anchored at the bottom edge.

## [1.15.0] – 2026-11-05

### Added

- **Real light in the room.** In party mode the overlay app makes your lights play along: **Philips Hue** (find the bridge, press its button, pick a room – the lamps change colour on the beat in turn and go back to how they were afterwards), **WLED** LED strips (real-time over the network, 30 frames a second), **OpenRGB** (keyboard, mouse, RAM, fans) and **Razer Chroma**. Everything stays in your own network; brightness is adjustable.
- **Stream Deck plugin:** keys for play/pause, next, previous, like, immersive mode and party mode – double-click *Mirage.streamDeckPlugin* to install. It talks to the overlay app on this computer only.
- **Party light as an OBS source** (`http://127.0.0.1:47322/party`, `?bg=0` for a transparent background) – for streams.
- **Recently played** in the overlay app: the last 50 songs in the settings and the tray menu; a click opens the song in Spotify.
- **Romanization** under Korean, Japanese and Chinese lyrics (off by default): Korean is worked out by Mirage itself, Japanese comes from NetEase, Chinese loads a pinyin dictionary from jsdelivr once.
- **Fix lyric timing by hand:** press <kbd>E</kbd> in the lyrics, then Enter the moment the marked line starts – the lines after it move along, <kbd>Backspace</kbd> undoes, it's saved per song and can be reset.
- **Duets and backing vocals:** lines with a singer's name (“Name:” or “[Name]”) get a colour per voice, backing vocals in brackets are smaller and in the second colour.
- **Search in the settings**, settings **backup as a file**, and a **four-step intro** on first start (can be shown again any time).

### Changed

- The theme sends the party light to the overlay app whenever it asks for it (edge light, OBS party source, room lights), not only with the edge light switched on.

## [1.14.0] – 2026-11-05

### Added

- **Song wishes from the real Spotify catalogue.** Guests search Spotify right on the phone page – Mirage answers with the matching songs and their covers, only to that phone. They tap the right one; everyone sees the list and votes with 👍. In party mode you see the top wishes and add them to the queue with one click – nothing gets in on its own. One wish per phone every 45 seconds, at most 8 open; all of it end-to-end encrypted like the rest of the live link.
- **Lyrics on the phones.** The current line big in the middle, the next one below – for singing along. Can be switched off on the phone.
- **Phones vibrate on the drop** (Android; iPhones don't allow it in the browser). Can be switched off on the phone.
- **Six new venues:** rooftop with a skyline, cathedral with stained-glass windows and candles, jazz bar with pendant lights and smoke, forest stage with fairy lights and fireflies, concert hall with balconies and a seated audience, and a vaulted cellar. Twelve in total, and the automatic choice uses them for jazz, blues, soul, gospel, classical, film, psytrance, country, synthwave, R&B, drill, phonk and punk.
- **Sea of lights** in ballads, gospel, soul, R&B, blues and country: in the chorus more and more people raise phones and lighters and sway them together.
- **Confetti cannons and streamers** at the start of the final chorus and on its drop (not in the cathedral, concert hall or jazz bar).
- **Camera cuts:** hard cuts on the downbeat between wide, close and crowd shots – every 8 bars, every 4 at the peak; the drop cuts back to wide. Only the stage moves, cover and lyrics stay put. Own switch in the party settings.
- **3D tunnel** visualizer: rings shaped by the spectrum fly out of the cover towards you.
- **Warning after Spotify updates:** if Spotify rebuilt a part of its layout that Mirage styles, Mirage says so once, instead of silently looking half broken.

### Changed

- **Translations proofread** in all 13 other languages: over 200 fixes – consistent terms and form of address, missing parts of the shortcut tip restored, literal translations replaced.
- **Settings are friendlier to screen readers:** switches are announced as switches, button rows and lists name what they are for, sliders read out their value with the unit.
- Instrument credits: no answer from MusicBrainz is asked again after a day at the earliest, not on every play, and Mirage pauses for a minute when MusicBrainz says it is busy.

### Fixed

- Fireworks, confetti, CO2 jets and camera cuts no longer depend on seeing exactly the first beat of a bar – a skipped frame could make them miss.
- When a live link expires, Mirage now also clears the last message stored on the relay.

### Removed

- The old home-network live server inside the overlay app (unused since 1.13) and a stray test file.

## [1.13.1] – 2026-11-03

### Changed

- **A new look for the phone page.** Guests now see a glass card with the song, artist and tempo, a glowing orb that shows whether the party is live, soft colour clouds, rings on every beat and a flash on the drop. Old messages left on the relay are ignored, so a phone never shows a past party.
- **New README** in English and German, with short clips of party mode, every immersive view, the venues, the instrument effects and the phone page.

### Fixed

- Notes in the Mirage settings sit on their own line again instead of squeezing next to the switch.

## [1.13.0] – 2026-11-03

### Changed

- **The live link works on any network – and only for whoever has the QR code.** The phone page now lives at passimoritz.github.io (real HTTPS, so Chrome no longer runs into "ERR_TOO_MANY_RETRIES"), and the theme sends the light state directly – no overlay app, no home network, no firewall setting. Messages go end-to-end encrypted (AES-GCM) through a public relay (HiveMQ, with a fallback); a random channel and key exist only in the QR link after the "#", which browsers never send to any server, and every message is authenticated, so nobody can read or inject anything. The page runs on Wi-Fi or mobile data, keeps the screen on, works out the beat itself between messages, shows "waiting for party mode" and "party is over", and the code expires 10 minutes after party mode ends.

## [1.12.3] – 2026-11-03

### Removed

- The beach balls over the crowd, and with them the *Fun moments* switch.

## [1.12.2] – 2026-11-03

### Removed

- The person lifted onto someone's shoulders and the crowd-surfer – both hovered above the crowd and looked out of place. The crowd now stays on the ground; beach balls stay.

## [1.12.1] – 2026-11-03

### Fixed

- **Live link: the phone page opens in Chrome.** Chrome first tries every http address over https; the phone server answered that attempt with an error and Chrome got stuck on "ERR_TOO_MANY_RETRIES". The server now recognises the encrypted attempt by its first byte and closes it at once, so Chrome falls back to http and the page opens.

## [1.12.0] – 2026-11-03

### Added

- **Instruments from the credits.** When the song's credits (Spotify, otherwise MusicBrainz via the ISRC number) confirm a trumpet or other brass, sax, electric guitar, piano, strings or choir, that instrument gets its own effect wherever it stands out in the sound: golden fanfare rays and sparks, rising smoke, lightning and crackle along the truss, 24 keys of light that follow the notes being played, flowing silk ribbons, a halo from above. Without a credit there is no instrument effect at all; at most two instruments at a time.
- **A light rig:** moving heads on a truss above the stage move in genre patterns (waves for house, chases for techno, fans for EDM, all on the cover for hip-hop and rock), blinders fire on big snare hits in the chorus, a laser sheet spans the crowd on the drop, and calm songs get soft bokeh.
- **Fun moments:** beach balls bounce over the crowd at festivals, stadiums and the beach, and at the peak a crowd-surfer is carried across.
- **Tap to sync (T):** tap six times on the beat and Mirage measures the offset between picture and sound – globally, or per song when the beat is estimated. Also adjustable in the settings (Sync, ±400 ms).

### Changed

- **No more lag.** Party, visualizer and karaoke run on a steady song clock that smooths out Spotify's jumpy position and leads by the time a frame needs to reach the screen. The cover pulse rises instantly instead of springing up, and the crowd reacts faster to energy changes.
- **Karaoke on the syllable.** Estimated words are split into syllables, and each syllable is placed on a sung onset of the analysis by an optimal alignment over the whole line; letters fill syllable by syllable (also with Spotify's syllable timings). Lyrics from LRCLIB or NetEase that are shifted against the song are aligned automatically.

## [1.11.1] – 2026-11-03

### Changed

- **Jam guests are part of the party now:** smaller profile pictures stand among the crowd at the bottom (left and right of the title), glow in their Jam colour, float gently and bounce with the kick.
- **No lyrics, no gap:** without lyrics, title and artist in party mode sit directly under the cover instead of at the very bottom above the crowd.

### Fixed

- The personal Jam colours were overwritten when the guests were placed, so everyone looked the same; each guest now keeps their colour.

## [1.11.0] – 2026-11-03

### Added

- **28 more party styles – 48 in total.** EDM & Big Room, Deep House, Tech House, Psytrance, Dubstep, UK Garage, Eurodance, Synthwave, Hyperpop, Trap, Drill, Phonk, R&B, Soul & Funk, Indie, Alternative, Blues, Schlager, Ballad, Gospel, Reggaeton, Salsa & Tropical, Brazilian, Flamenco, Bollywood, Arabic, Ambient and Film & Epic. Each has its own light language, crowd moves, venue and stage effects, and is recognised from Spotify's artist genres and Apple's genre names.
- **The live link shows its QR code right in the settings**, under the switch – with a clear status while the overlay app answers, or why it doesn't.

### Changed

- **Tidier settings:** party mode has its own group with sections for style, light & effects, moments, crowd & Jam and extras. The style is chosen from a list sorted by music family instead of a wall of 48 buttons.
- **Smoother party mode:** the cover pulse springs instead of jumping from frame to frame, the drop's camera punch is a soft spring, and the background drifts on sub-pixels instead of whole-pixel steps.
- **Prettier crowd:** a band of glowing haze behind the heads lights up with kick and drop, so the silhouettes stand out against the stage light.
- "Bass" is now called "Hip-Hop".

### Fixed

- A live-link card left open no longer stays behind after leaving immersive mode (the next click would close it instead of opening it).

## [1.10.0] – 2026-11-03

### Added

- **Stage effects where they make sense:** CO2 jets on the drop and at the peak of electronic music, pyro flames for rock, metal, punk and hardstyle, fireworks in the final chorus at the stadium and the festival. Switchable as *Stage effects*.
- **Strobe on hard drops** for techno, hardstyle, rave, drum & bass and bass – only from *Extreme* on, only with flashes enabled, and never more than one flash per beat.
- **Two new venues:** a warehouse (concrete pillars, bare lamps swinging on the kick) for techno and drum & bass, and a beach (sunset over the sea, palms swaying in time) for latin, reggae and afro.
- **The overlay app takes over from older copies of itself.** If an old Mirage Overlay (for example from an old download folder) still holds the connection to Spotify, a newer version asks it to quit; a copy too old to understand that is pointed out with a notification.

### Changed

- **Better performance in every preset.** *Balanced* draws immersive mode at up to 60 fps (half the work on 120/144 Hz screens) with slightly fewer pixels; *Light* and energy saving at 30 fps with about 40 % fewer pixels and less party detail; *Full* stays at the full refresh rate.
- **Live link:** the phone button is always shown when the live link is on. If the overlay app doesn't answer, the card says why (not running, or an old version) instead of staying empty, and it explains the firewall setting for public networks.

### Fixed

- **The crowd no longer stutters.** The background thread no longer builds up a backlog of frames (it gets the next frame only when the last one is drawn, and one-off signals like the drop are kept until then). Whether someone jumps is decided at the start of each jump, so no one snaps in or out of a jump mid-air; the wave rolls through as a smooth swell; lifting someone onto shoulders glides; back rows fade instead of popping when the quality control steps down.

### Removed

- The 10-second clip button and its setting.

## [1.9.1] – 2026-11-02

### Fixed

- **No more floating crowd.** Bodies now reach far below the bottom edge, so people who jump, sit on someone's shoulders or move with the stage camera no longer hover in the air as cut-off torsos.
- **The crowd fades out on pause** and comes back when the music plays again – dancing to silence looked wrong.

## [1.9.0] – 2026-11-02

### Added

- **Light director.** Party mode now stages the drop: the light holds back as it approaches, goes dark on the last beat before it, and then everything hits at once. The final chorus gets extra light and more lasers.
- **Melody lasers.** Two thin, mirrored lasers from the cover follow the pitch of the melody, with a short glowing trail.
- **Slow motion before the drop.** Sparks, rings, light particles and the crowd freeze for half a second right before the drop.
- **DJ transitions.** On a song change the old colours hold until the first beat and then blend into the new ones over four beats.
- **Venues.** Club, festival, stadium or living room – each with its own decor, haze and crowd size, picked by genre or fixed in the settings.
- **A crowd that dances in time.** The crowd is locked to the beat phase: jumps land on the beat, heads nod or bang, hands clap on 2 and 4, people sway or skank depending on the genre. Every now and then a wave runs through the crowd, someone is lifted onto shoulders, and the drop sets off camera flashes.
- **Live link for phones.** With the overlay app running, phones on the same Wi-Fi scan a QR code and flash along with the party as extra lights. The page only receives light colours and the song title and is protected by a random key in its address. Off by default.
- **10-second clip.** A button in immersive mode records the visualizer with venue, cover, title and the current lyric line as a silent WebM video.
- **Mix mode reacts to instruments.** The pulse and rings follow the real kick drum, not just the beat grid.
- **Energy saving.** On battery (or always) everything runs at 30 fps with lighter detail; quiet intros and breaks in party mode run at 30 fps as well.
- Settings for all of the above, in all 14 languages.

### Changed

- **Stage and crowd are drawn in a background thread** (OffscreenCanvas), so lyrics and controls stay smooth; where that isn't possible, they are drawn in the main window as before.
- The techno scanner and the drum & bass tunnel no longer form a grid: hard lines and square frames are replaced by soft light bands and soft light rings.
- The READMEs are rewritten from scratch: shorter, with install first, a dedicated party section, performance, privacy and an FAQ.

## [1.8.0] – 2026-11-02

### Added

- **Beat data for songs Spotify has no analysis for.** Many (especially newer) songs come without Spotify's beat analysis, so the visualizer and party mode had no beat. Mirage now builds an estimate in the same format: the tempo from Spotify's audio features or Deezer, and otherwise – and for the exact position of the beat – from the synced lyrics. Word times give a fine grid, line starts are matched to their power-of-two family (one line = 8 beats is the usual case). The chorus counts as louder, instrumental gaps as quieter, and kick, snare and hi-hats sit on the grid. The party label shows "≈ 125 BPM" for an estimate; if Spotify's real analysis arrives later, it takes over.
- **Nine more party genres:** disco & funk (disco ball in gold), K-pop (pink, fast sweeps), reggae & dancehall (one drop on 2 and 4, light from the floor), classical & film music (large, slow golden light, no flashes), punk (fast backbeat, hard spots), hardstyle (every kick hits – tunnel, red), afrobeats, jazz & blues (warm club light), country & folk (warm spots, clapping on 2 and 4).
- **F11** toggles full screen in immersive mode.

### Changed

- **Party reacts more and the background moves with it.** The real kick drives beams, spotlights, the bar wreath and rings, scaled by the song's energy so quiet parts stay calm. The background breathes with kick, energy, chorus and drop, and energetic four-on-the-floor songs get a colour wash on the kick.

### Fixed

- The crowd no longer disappears after a few seconds: the automatic quality control reacts much more gently and only ever drops the back rows, never the whole crowd.
- No more missing corner or tilted crowd at the bottom: the light canvas is no longer tilted for 3D depth (stage light and crowd shift in the stage camera instead), and the crowd is laid out wider than the screen.

## [1.7.1] – 2026-11-02

### Added

- **Full screen button in immersive mode**, always in the top bar (also in party mode). Like Spotify's own full screen, the immersive view itself goes full screen, without Spotify's title bar.
- **Automatic quality in party mode:** below about 48 frames per second, Mirage turns expensive details down by itself (back row of the crowd, half the beams, then crowd, camera and depth) and back up once it runs smoothly again.

### Changed

- **Crowd, redone.** Three rows with depth, arms with elbows, different heads (curls, buns, caps), backlit edges and haze above the heads. Everything the crowd does now follows one slow mood that comes only from the song – energy curve, build-up, drop and break – so nobody goes wild in a quiet part and nobody stands still in the drop. Calm: swaying, phone lights and lighters. Medium: nodding on the beat, clapping on the snare. High: hands up, fist pumps on the kick, waving in the chorus. Peak: real jumps with gravity, each person slightly offset. Bodies are pre-drawn images and the arms of a row are one stroke, which keeps it cheap.

### Fixed

- The top controls in immersive mode no longer slide partly out of view, and no strips of Spotify's title bar show through at the top: camera rides now move only the stage (background, spotlights, crowd) instead of the whole immersive window – cover, lyrics and controls stay put. This also makes mix mode much faster.

## [1.7.0] – 2026-11-02

### Added

- **The light follows the instruments.** From the timbre of every segment in Spotify's analysis, Mirage now finds the kick (hard, dark attack), snare and clap (hard, noisy), hi-hats and cymbals (very bright) and the melody (one clear pitch). The kick drives the cover pulse and the floor light, the snare the spots and – for rock and metal – the flashes, the hi-hats the sparkle of disco ball, scanners and fine sparks, and the melody's pitch tints the accent light (circle of fifths, so related keys stay close).
- **Party extensions, each with its own switch:**
  - *Beat-synced transitions:* between songs the light dims and comes back on the first beat of the next one.
  - *Hype lines:* choruses (repeated lines) and crowd calls ("hands up", "jump", "vamos" …) glow stronger and their words pop in one by one.
  - *3D depth:* lyrics, title and light sit on different layers and follow the mouse; without the mouse the scene floats.
  - *Camera rides:* the whole scene slowly zooms and drifts with the energy, with a jolt on the drop.
  - *Lyrics burst:* on the drop the current line flares up and bursts into light particles.
  - *Crowd:* silhouettes in front of the stage raise their hands with the energy and jump on the kick and the drop.
  - *Jam colours:* every Jam guest gets a colour ring; whoever added the current song is highlighted as the DJ when Spotify notes it.
  - *Second screen:* a button puts party mode full screen on another monitor or TV (where the system allows it).
  - *Party recap:* after three songs, a button creates a shareable picture with songs, minutes, drops, genre mix, BPM range and the loudest drop.
  - *Edge light:* the Mirage Overlay app (1.7.0) makes the screen edges glow to the beat while party mode runs, hidden during full-screen games.

## [1.6.1] – 2026-11-02

### Fixed

- **Karaoke word by word follows the singing.** Without Spotify syllable times, the words used to be spread evenly over the whole time until the next line – after a pause or a held note they ran far ahead. Now:
  - NetEase word-exact lyrics (YRC) and Enhanced LRC from LRCLIB are used with their real word times.
  - When Spotify only has line times, Mirage takes NetEase's word-exact version of the same song – only if the text matches.
  - Otherwise the words are estimated at singing pace instead of being stretched over the pause, and when the line becomes active their starts snap to the note onsets in Spotify's analysis.

## [1.6.0] – 2026-11-02

### Added

- **Six new party genres, each with its own light language.** Techno: light scanners sweep across the picture in tempo and flare on the beat, cool colours. House: a disco ball throws light points that turn slowly and flash on the beat, warm colours. Trance: aurora ribbons wave over the top half and rise during build-ups. Drum & bass: kick and snare at half tempo, a light tunnel shoots out of the cover on every hit. Metal: the snare on 2 and 4 tears everything open, red-hot spots from above, heavy shake and sparks. Latin: dembow accent, warm sweeps, the cover dances along.
- **Finer genre detection.** Exact styles (techno, house, trance, drum & bass, metal, reggaeton/latin …) are recognised in Apple's and Spotify's genres before the broad families. Plain "dance/electronic" is split by tempo and key: 160 BPM and up is drum & bass, minor at 118–150 BPM is techno, 132–150 BPM trance, 118–131 BPM house.
- **More variety across a song.** Every new section (verse, chorus, bridge …) shifts the colour order of wreath, beams and sparks and turns the rotation the other way.
- Colour moods per genre: cool for techno and drum & bass, warm for house and latin, hot for metal.

### Changed

- The party style picker in the settings wraps onto several rows.

## [1.5.2] – 2026-11-02

### Fixed

- **Party genre detection.** Spotify's artist genres often come back empty or rate-limited, and then only the tempo was left – so most songs ended up as "Pop". Mirage now also asks Apple's iTunes search for the song's own genre (first in your country's store, then the US) and weighs all hints: the song's Apple genre, the artist's Spotify genres and the sound itself. Alternative and indie bands get Rock, hip-hop gets Bass, dance and electronic get Rave, slow or quiet "electronic" counts as Chill, R&B springs like Pop. Only title and artist are sent; new switch "Look up genre online".
- The visualizer wave plays the song again when Spotify's beat analysis fails the first time: Mirage retries after 3, 8 and 20 seconds instead of running the whole song without beat data. The wave is also smoothed over five neighbours, so the closed curve no longer jitters.
- In party mode, the "No lyrics" notice now fades out with the controls when the mouse rests.

## [1.5.1] – 2026-11-02

### Changed

- **Party mode follows the song.** Mirage now maps every track in advance from Spotify's analysis: an energy curve on a quarter-second grid (centred, so it rises exactly where the song gets louder), drops placed on their beat, build-ups seen up to four seconds ahead, quiet breaks, major or minor per section and how bright the sound is. Build-ups speed the beams up and make them shimmer at double tempo, breaks dim everything down, the drop hits all at once (flash, camera kick, three rings, a burst of sparks), minor sections turn the colours deeper and cooler.
- **Each genre has its own light language and accent pattern.** Rave: four on the floor, the one strongest, crossing spotlights from the bottom corners. Bass: heavy 1 and 3 with a long tail, light welling up from the floor. Rock: the snare on 2 and 4 hits, warm hard spots from above, shake instead of sway. Pop: every beat springs, colour sweeps that wander through the palette. Chill: only the one, long breathing, wide soft light shafts, hardly any beams. The beat envelope is now computed from the exact beat time, not from the moment it was noticed.
- Stage light (formerly "light beams") starts at *Normal*. The cover pulse, the bar wreath, rings and sparks all scale with the song's energy; sparks follow the brightness of the sound.

### Fixed

- Lyrics in immersive mode are no longer cut off at the left or right edge. The active line grows into reserved space that is derived from its scale, and the lyrics area has bleed room on both sides for the glow – in Lyrics, Mix and Party, at any window size and lyrics size.

### Removed

- Confetti.

## [1.5.0] – 2026-11-02

### Added

- **Party mode, much harder.** Five levels: Light, Normal, Max, Extreme and Insane. From *Extreme* on, mirrored light beams fan out of the cover, flare on the beat and jump on every bar, and camera kicks briefly punch the whole picture in. *Insane* doubles the beams and flashes on every beat (still under three flashes per second; off with reduced motion). New switches for light beams and camera kicks.
- **Auto-hide in party mode.** After a few seconds without mouse or keyboard, the top bar, the controls and the lyrics bar fade out, and cover, lyrics and title glide down to the centre. Moving the mouse brings everything back. Can be turned off in the settings.
- **Add to playlist in immersive mode.** A new button next to the heart opens your own and collaborative playlists (folders included), with search and the most recently used first. It notices when a song is already in the playlist.
- **Smart Shuffle tag.** A sparkle chip above the title shows when Smart Shuffle added the song.
- **More lyrics sources.** After Spotify and LRCLIB, Mirage now also asks NetEase (synced) and lyrics.ovh (plain text). Each source gives up after 7 seconds instead of keeping the lyrics on "Loading", and a synced hit wins over plain text.

### Changed

- The next song's cover, colours and background are prepared in advance, so they appear right away when the song changes instead of loading in afterwards. The small and large cover in immersive mode now load in parallel.
- The progress bar is only redrawn when its value changes.
- Shortcuts no longer fire while typing in any text field in immersive mode.

## [1.4.5] – 2026-11-01

### Changed

- The Immersive button now sits directly left of the bell (What's New) at the top right. It is a glass orb in the cover colours with a sheen that sweeps across it every few seconds and a softly breathing glow. The glow is off in calm mode.

### Fixed

- The Immersive button no longer disappears at random. Mirage now places its own button and puts it back whenever Spotify rebuilds the top bar. Only when there is no bell does it fall back to the Spicetify top bar button.

## [1.4.4] – 2026-10-31

### Fixed

- The visualizer recovers by itself when Chromium drops its drawing surface. This can happen under heavy GPU load, for example with a game in the foreground. The canvas used to stay empty without any error until Spotify was reloaded. If the surface does not come back within a second, Mirage now starts over with a fresh canvas.

## [1.4.3] – 2026-10-31

### Fixed

- Search suggestions, the small playlist header that appears while scrolling and the pinned column header ("# Title Album …") are readable again. Mirage's own colour-surface cleanup had been turning them transparent, and the pinned column header uses new Spotify class names that Spicetify does not know. It is now recognised by its structure. The search dropdown is fully opaque and stays above the page content.

## [1.4.2] – 2026-10-30

### Fixed

- The visualizer no longer goes blank or freezes on some songs: incomplete Spotify analysis data (missing loudness, pitches or beat confidence) used to spread NaN values and stop Party mode from drawing at all. Bad values are now replaced, and a failed frame resets the visualizer instead of breaking it until reload.
- No more errors while Spotify is minimized (the canvas was 0 px wide).

## [1.4.1] – 2026-10-30

### Changed

- Party mode has its own visualizer: a fine ring of bars in a colour gradient around the cover, a glowing line over the tips instead of the filled wave, and sparks that fly off the cover on the beat (more in drops). Colours are boosted to be vivid; grey covers get Mirage tones. Bass songs add low bars along the bottom edge.

### Fixed

- Mix mode: the progress bar and times are centred under the title on wide windows.
- Overlay app: "Start with Windows" is re-registered at every start, so the entry follows the app after an update, a reinstall or a switch from a development copy.

## [1.4.0] – 2026-10-30

### Added

- Immersive mode "Mix" (key 4): cover, lyrics and visualizer at once. A round cover sits in the visualizer ring with the synced lyrics beside it, and all controls stay. Lyrics and visualizer settings apply here too.
- Immersive mode "Party" (key 5): bigger and on the beat. Each song gets a profile from the artist's genres, or from tempo and loudness when Spotify knows no genre: Rave, Bass, Rock, Pop or Chill. The profile sets the visualizer style, how strongly the cover pulses or shakes, how often rings appear, and soft colour washes per bar. Loud drops push everything further, and very fast songs run in half time. The current lyric line is shown large in the middle, and the kicker shows e.g. "Party · Rave · 128 BPM".
- Party mode shows who is in your Spotify Jam: everyone's profile picture (you too, with an accent ring; the host with a small dot) floats softly at the edges and updates as people join or leave. Can be switched off ("Show Jam guests").
- Settings → Immersive: party style (automatic or fixed), intensity (soft, normal, max) and colour flashes on or off. The flashes are coloured washes, not white strobes, never more than a few per second, and they stay off with the system's "reduce motion" setting.
- Share image "Now playing": with the scannable Spotify Code in a glass capsule under the title. Point the Spotify camera at it to open the song directly.

### Changed

- Keys 1–5 switch the immersive views; the shortcut help and README list the new modes.

## [1.3.1] – 2026-10-30

### Added

- Immersive lyrics: a "Translation" switch next to "Choose version" shows or hides the translation with one click.
- All 14 languages are now complete in the theme and the overlay app. Before, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Japanese, Korean and Chinese fell back to English for most newer texts.

### Changed

- The immersive button in the top bar is easier to find: an accent-coloured orb with a soft glow.

### Fixed

- Immersive mode: the Spotify window can be dragged again (also onto another screen) from the strip along the top; double-click maximises it.
- Volume display in the overlay app: Mirage now also reads the volume from Spotify's playback API or the volume slider when `getVolume()` returns nothing, which happens in some Spotify versions.
- The active lyric line no longer gets cut off on the right when it grows.
- Search suggestions under the search field and the small playlist header that appears when scrolling are no longer see-through.
- Smoother immersive mode: the visualizer draws at a capped resolution on large screens, the background crossfades without recomputing its blur, the progress bar and cover pulse no longer trigger layout every frame, and lyrics fade in instead of sliding across on a song change.

## [1.3.0] – 2026-10-30

### Added

- Immersive mode: karaoke word by word. In the current line each word fills up while it is sung. With Spotify's syllable timing it is exact; otherwise Mirage estimates it from the line timing. Switch: "Karaoke word by word".
- Immersive mode: "Choose version" button in the lyrics view. It lists all LRCLIB matches for the song (time-synced first, closest length first), and the choice is remembered per song. "Automatic" goes back to Spotify first. This also works when Spotify has only unsynced lyrics.
- Font choice in the settings (Colours): Outfit, Jakarta, Manrope, Sora, Lexend, Nunito or the system font, for all of Spotify.
- Sleep timer fades out: the volume goes down slowly over the last minutes (last 20 s for "end of song") and comes back after pausing.
- "Your month in colours": a share card for the last 30 days with songs, minutes, active days, cover colours, listening time per day, top artists and top songs.
- Mirage Overlay: volume bar at the bottom of the screen when you change the volume in Spotify.
- Mirage Overlay: quiet while a game, video or presentation runs fullscreen. Windows uses the system's own fullscreen signal; Linux (X11) checks the active window. Not available on macOS.
- Mirage Overlay: your own style. "Open CSS file" creates `custom.css` in the settings folder; it overrides the built-in look and changes show right away.
- Mirage Overlay: streaming mode for OBS. `http://127.0.0.1:47322/` as a browser source shows the same overlay with a transparent background. Only reachable from your own computer.
- Mirage Overlay: updates itself. It checks GitHub at start and every 6 hours and asks before restarting. Windows installs silently, the AppImage replaces itself; on macOS and .deb it opens the download page.

## [1.2.3] – 2026-10-29

### Added

- Lyrics from the web: if Spotify has no lyrics for a song, Mirage looks them up on [LRCLIB](https://lrclib.net), a free lyrics database. Time-synced lyrics are preferred, plain text is the fallback, and local files get lyrics too. Only the title, artist, album and length are sent. It is on by default and can be turned off with "Search lyrics online" in the immersive settings. The overlay's lyrics style benefits as well.
- Immersive mode: a proper view when there are no lyrics, in the colours of the cover, with buttons to show the visualizer or search the web. Instrumental tracks get their own calm variant.

### Fixed

- Immersive mode: the translation could show up twice under a line when the view and the song changed at the same moment.

## [1.2.2] – 2026-10-29

### Fixed

- Mirage Overlay: the shadow was cut off at the window edge depending on the position (worst at the bottom positions, up to 78 px). The overlay window now keeps a shadow margin on every side that grows with the size, while the card stays exactly where it was. Checked for all 6 styles × 9 positions × 2 sizes.

## [1.2.1] – 2026-10-29

### Removed

- The Mirage App (dashboard page in Spotify's sidebar) and its Marketplace listing – the theme settings and the Overlay cover everything it showed.

## [1.2.0] – 2026-10-29

### Added

- **Mirage Overlay installers** for every system, built automatically for each release: `Mirage-Overlay-Setup.exe` (Windows, one click), `Mirage-Overlay.dmg` (macOS, universal), `Mirage-Overlay.AppImage` and `.deb` (Linux) – no git or Node.js needed any more.
- Mirage settings → Overlay: shows whether the overlay is connected and downloads the right installer for your system.
- App icon for the overlay.

### Fixed

- Linux AppImage: "start with the computer" now points at the AppImage file instead of its temporary mount.

## [1.1.1] – 2026-10-29

### Fixed

- Mirage App did not open: a helper named `t` clashed with the parameters Spicetify wraps custom-app code in (`e, t, n`), so the page failed to load and the top-bar button led nowhere.

## [1.1.0] – 2026-10-29

### Added

- **Mirage App** – a custom app (page in Spotify's sidebar), listed in Marketplace → Apps: colour schemes in one click, "your week in colours" with share button, quick actions (immersive mode, settings, share now playing), Mirage Overlay status with install guide, the repair after Spotify updates and a diagnostics button for bug reports.
- `window.Mirage` – a small interface the theme offers to the app (schemes, week, overlay status, actions).
- The Windows installer now sets up the app too (`-NoApp` to skip it).

## [1.0.0] – 2026-10-29

First public release.

### Added

- **Colours from the cover** – accent, buttons, progress bar, titles and selection take on the palette of the current album art, tuned so text stays readable on dark glass.
- **Living background** – the album art drifts behind the UI as a slow, blurred haze with aurora bands, floating light dust and film grain.
- **Beat pulse** – with Spotify's beat data the background, light dust and visualizer pulse in time; without it Mirage falls back to calm ambient motion.
- **3D cards** – cards tilt towards the pointer, with a light cone and glowing edge that follow the mouse.
- **Page animations** – pages blur in, grids cascade, track rows glide in one after another; the playing row glows in a flowing colour stream.
- **Vinyl & details** – the player cover turns into a spinning record, the play button gets a rotating halo, liking a song sets off a heart burst.
- **Immersive mode** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>) with three morphing views:
  - **Cover** – huge tilting cover, gradient title, progress and full controls.
  - **Lyrics** – Spotify's synced lyrics with the current line lit and centred; click a line to jump there.
  - **Visualizer** – radial spectrum around the round cover with beat rings, configurable style, bar count, height, softness, glow, rings, mirroring and rotation.
  - Shuffle, previous, play/pause, next, repeat (incl. repeat one), like, volume + mute, full screen and keyboard shortcuts.
- **Mirage Overlay** – Electron companion app (Windows) that shows song changes above every window: Island, Card, Banner and Minimal styles, screen and anchor choice, quiet hours, playback controls on hover, tray icon and autostart. Talks to the theme locally via `127.0.0.1:47321`.
- **5 colour schemes** – `Mirage` (follows the cover live) plus the fixed palettes `Obsidian`, `Sakura`, `Abyss` and `Ember`, switchable live.
- **14 languages** – English, German, French, Spanish, Italian, Portuguese, Dutch, Polish, Turkish, Russian, Ukrainian, Japanese, Korean and Chinese, with English as fallback; controls are found by language-independent markers.
- **Mirage settings** in the profile menu – toggles for every effect, real glass, calm mode, blur and brightness.
- **Diagnostics channel** – with the overlay running, the theme can write a layout report (sizes, classes, colours – no content) to help fix styling bugs after Spotify updates.
- **Accessibility** – respects *reduce motion*, visible focus rings, readable contrast on every palette.
- Windows installer script (`install.ps1`, optional `-Overlay` and `-Scheme`) and Spicetify Marketplace manifest.
- **Performance presets** – Full, Balanced, Light and Calm in one click; Mirage measures the frame rate at start and steps down one level on slow PCs; effects pause while Spotify is minimised or covered; calm mode follows the system *reduce motion* setting.
- **Much lighter on CPU and GPU** – the whole ambient background (cover light, aurora, pulse, light dust, vignette) is drawn into one quarter-resolution canvas instead of seven full-window blended layers; it runs at 20 fps (Full 30, Light 12) and only while music plays; the beat pulse reads Spotify's beat data per frame instead of running its own loop; looping decorations pause when nothing plays or the window is covered; colour and contrast watchers only check new elements. Measured on Windows with Spotify visible and playing: 16.8 % → 2.7 % CPU and 28 % → 0.8 % GPU; idle with music paused: 12.5 % → 0.1 % CPU.
- **Readability guard** – native drop-down lists, autofill and placeholders follow the theme (`color-scheme`), and a contrast watchdog fixes text that falls below 3 : 1 in menus, dialogs and settings – also on future Spotify pages.
- **Contrast-checked colours** – accent colours are lifted until they reach 4.5 : 1 on the background; almost colourless covers fall back to the scheme.
- **Pearl** – a light colour scheme, plus a **scheme builder** (four colours → full scheme) with share codes.
- **Per-album and per-playlist colours** – remember an album's colours, freeze the current colours, or give a playlist its own scheme.
- **Immersive mode** – Smart Shuffle, up next (Q), Spotify Connect devices, sleep timer, title/artist links, lyrics size and spacing, optional lyrics translation, Canvas videos where available, three new visualizer styles (particles, line, bottom bars), shortcut overview (?), share button.
- **Share cards** – "Now playing" and "Your week in colours" as 1080 × 1350 images (copied and saved).
- **Overlay** – macOS and Linux support, new *Lyrics* and *Visualizer* styles fed live by the theme.
- **Settings** – presets on top, grouped sections, ⚡ marks costly effects, export/import, reset, copy diagnostics for bug reports, first-start hint.
- **Robust against Spotify updates** – all Spotify selectors in one place, health check with safe mode, `tools/fix-spicetify.cmd` to repair Spicetify after a Spotify update.
- **Web demo** on GitHub Pages and source split into modules under `src/` (bundled with esbuild), CI with ESLint and Stylelint.

[Unreleased]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Passimoritz/spicetify-mirage/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Passimoritz/spicetify-mirage/releases/tag/v1.0.0
