WIP notes: settings dialog UI audit (remove this file when the work is finished)

Harness: npx electron tools/ui-harness/settings.js -- --out tests/e2e/out/settings-ui/after
(build theme first: node tools/build.js; afterwards restore Mirage/theme.js + docs/live from HEAD)
Before shots (local, gitignored): tests/e2e/out/settings-ui/before/*.png (+ audit.json)

Defects found (before):
1. Light/Pearl: switches that are on looked grey because the light "off" rule overrode :checked. CSS fixed, not verified
2. Light: focus ring in the pale accent colour (m-c) was hard to see. CSS fixed (outline in text colour), not verified
3. Scheme card names in subtext colour were unreadable on scheme backgrounds (Obsidian/Pearl). Fixed (--s-text)
4. Scheme picker sat outside any group (orphaned heading). Moved into "Colours" (now open by default)
5. Search: the scheme heading showed for unrelated queries (top-level groups were attached to its unit). Fixed in applySearch
6. Group chevron "›" rotated into a tiny, misaligned glyph. NOT DONE (summary CSS block ~line 4090)
7. Sticky search: hard-edged background box that doesn't match the dialog gradient; content shows through. NOT DONE (search-bar CSS ~6170)
8. Very long hints (playful style 8 lines, instruments 7) → 2-line clamp + "more" (clampHints/watchHints). JS done, CSS done, not verified
9. Sub-settings not nested: Playful intensity, wish rules, blur (under Glass), instrSound (under Instruments),
   phone features under partyLive (wishes, reactions, photos, light wave, live panel). sub() done + CSS; not verified
10. Subsection titles looked identical to setting labels. Now h3.m-subhead (uppercase, small). Done, not verified
11. "Location" label in note style vs bold elsewhere. Now a field(). Done
12. Segmented controls: pill container wrapping into odd shapes; venue/viz now a grid. CSS done, not verified
13. "Share, back up & help": a wall of 11 buttons. Split into Share / Back up / Help fields + Reset on its own. JS done; CSS .m-danger NOT DONE
14. Builder: code field below the buttons, wide gaps. Now m-inline rows. CSS .m-inline NOT DONE
15. Overlay status as a plain note. Now .m-status inside a field. CSS .m-status NOT DONE
16. Modal fixed at 664 px even on 2560 px windows. NOT DONE (widen via :has(.mirage-settings))
17. .mirage-settings min-width min(560px,80vw) (second rule ~4090) can overflow small windows. First rule fixed; second rule still to remove
18. Group spacing/padding, m-actions/m-btn heights (36 px), m-text radius (dialog rule !important 14px) still to unify. NOT DONE
19. Reduced motion for switch/chevron/row transitions. NOT DONE
20. Library/Overlay groups each hold a single item. Left as is (GROUPS ids used by openSettings)
21. lyrPlayful/lyrPlayLevel hints still say "Ruhiger Modus" (old name). Not touched (i18n-lyricstyle.js belongs to the playful agent)

Still open: finish CSS (6,7,13-19), build + harness after-shots, lint, unit tests (new i18n keys need check:i18n),
check:contrast, e2e settings-search/settings-deps/perf-menu, new e2e case (no horizontal overflow at 820 px,
controls inside rows, sub disabled when parent off, focus visible), unit test for sub()/clamp logic.
Risk: sub() now always renders Playful intensity / wish rules (disabled when off) where they used to be hidden.
