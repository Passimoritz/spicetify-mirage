# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

This policy covers the Windows installer of the **Mirage Overlay** app (`Mirage-Overlay-Setup.exe`) and every program file inside it. The Spicetify theme itself (`Mirage/theme.js`, `Mirage/user.css`) is plain source code and is not signed.

## How releases are signed

- Every release is built by [GitHub Actions](.github/workflows/release.yml) from a tagged commit of this public repository, never on a personal computer.
- The build first produces the unpacked app; its program files (`.exe`, `.dll`, `.node`) are submitted to SignPath for signing. The installer is then built from the signed files and signed itself.
- SignPath verifies that each artifact comes from this repository and its release workflow. Every signing request is approved by hand.
- Only software developed in this repository is signed. Third-party components shipped with the app (Electron and its libraries, the `ws` and `openrgb-sdk` packages) are open source and not altered.

## Team

| Role | Members |
| --- | --- |
| Committers and reviewers | [Passimoritz](https://github.com/Passimoritz) |
| Approvers | [Passimoritz](https://github.com/Passimoritz) |

All team members use multi-factor authentication for GitHub and SignPath. Contributions from outside the team are reviewed by a committer before they are merged.

## Privacy policy

Mirage does not collect, store or sell any personal data and has no server of its own.

### Mirage Overlay app

- **The theme on this computer:** the app listens on `127.0.0.1` for the Mirage theme, which sends the current song, lyric line and light state. This never leaves the computer.
- **Updates (can be turned off):** the app asks GitHub (`api.github.com`) for the latest release and downloads it from GitHub only after you confirm. *Update theme* and *Repair theme in Spotify* download the theme files from this repository on GitHub, only when you click them.
- **OBS browser source (optional):** a page on `127.0.0.1:47322` for streaming software on the same computer.
- **Stream Deck and remote commands (can be turned off):** play/pause, skip, like, immersive and party commands on `127.0.0.1:47324`, only from programs on this computer, not from web pages.
- **Room lights (optional, off by default):** in party mode the app sends colours to the Philips Hue bridge, WLED, Govee, Home Assistant, OpenRGB and Razer Chroma devices you set up, all inside your own network or on this computer. *Find bridge* asks `discovery.meethue.com` for the bridge's address. Hue and Home Assistant credentials are stored encrypted with the operating system's key store and are never sent to the overlay windows or OBS sources.
- **Party on the TV (optional):** the picture (and, if you choose, the sound) is streamed to a TV in your own network.
- **Recently played:** the last 50 songs (title, artist, cover link) are kept in a file in the app's folder on this computer.

### Mirage theme (inside Spotify)

The theme contacts third parties only with song data, never with personal data:

- **Lyrics (can be turned off):** title, artist, album and length go to LRCLIB, NetEase, Kugou and lyrics.ovh at the same time as Spotify is asked, so that synced versions can be compared; word-timed lyrics may be loaded from the AMLL collection on GitHub. A "no lyrics" result is remembered on this computer for a week.
- **Party data (can be turned off):** title and artist to Deezer for the tempo and to Apple's iTunes search for the genre; the song's ISRC number to MusicBrainz for instrument credits.
- **Translation (off by default):** lyric lines go to Google Translate. **Romanization** (off by default) loads a Chinese pinyin dictionary from jsDelivr once.
- **Repairs after Spotify updates (can be turned off):** a small rules file is loaded from this repository on GitHub at most every six hours.
- **Light up phones (live link, off by default):** light colours, tempo, song title, lyrics, game data and guest messages are end-to-end encrypted and pass through a public relay (HiveMQ, with EMQX as fallback). The key exists only in the QR code and never reaches a server. The theme sends only while party mode runs.
- **Karaoke game:** the recording is scored on the singer's phone and never leaves it; only the scores are sent.
- **Photo wall (off by default):** photos are stripped of location and metadata on the phone, sent end-to-end encrypted, shown only after the host approves them, kept only in memory and gone when the party ends.
- Fonts load from Google Fonts.

See also the [README](README.md#-privacy-in-plain-words).
