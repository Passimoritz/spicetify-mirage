# Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

This policy covers the Windows installer of the **Mirage Overlay** app (`Mirage-Overlay-Setup.exe`) and every program file inside it. The Spicetify theme itself (`Mirage/theme.js`, `Mirage/user.css`) is plain source code and is not signed.

## How releases are signed

- Every release is built automatically by [GitHub Actions](.github/workflows/release.yml) from a tagged commit of this public repository – never on a personal computer.
- The build first produces the unpacked app; all of its program files (`.exe`, `.dll`, `.node`) are submitted to SignPath for signing. The installer is then built from the signed files and signed itself.
- SignPath verifies that each artifact comes from this repository and its release workflow. Every signing request is approved by hand before it is signed.
- Only software developed in this repository is signed. Third-party components shipped with the app (Electron and its libraries, the `ws` and `qrcode` packages) are open source and are not altered.

## Team

| Role | Members |
| --- | --- |
| Committers and reviewers | [Passimoritz](https://github.com/Passimoritz) |
| Approvers | [Passimoritz](https://github.com/Passimoritz) |

All team members use multi-factor authentication for GitHub and SignPath. Contributions from people outside the team are reviewed by a committer before they are merged.

## Privacy policy

Mirage does not collect, store or sell any personal data, and has no server of its own.

The **Mirage Overlay** app talks to other systems only as follows:

- **Your Spotify (on this computer):** the app listens on `127.0.0.1` for the Mirage theme, which sends it the current song, lyrics line and light state. Nothing of this leaves the computer.
- **Updates:** the app asks GitHub (`api.github.com`) for the latest release and, if you confirm, downloads it from GitHub. This can be turned off in the app's settings (*Update automatically*).
- **OBS browser source (optional):** when switched on, the app serves a page on `127.0.0.1:47322` for streaming software on the same computer.

The **Mirage theme** (inside Spotify) only contacts third parties for features you can switch off, and only with song data: title, artist, album and length to LRCLIB, NetEase and lyrics.ovh for lyrics when Spotify has none; title and artist to Deezer for the tempo and to Apple's iTunes search for the party genre; the song's ISRC number to MusicBrainz for instrument credits. The optional live link for phones (off by default) sends light colours, tempo and the song title end-to-end encrypted through a public relay (HiveMQ); the key exists only in the QR code and never reaches a server, and it only sends while party mode runs. Fonts load from Google Fonts. See the [README](README.md#-privacy) for details.
