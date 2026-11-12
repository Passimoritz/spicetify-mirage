# Remote fixes

Mirage loads `fixes.json` from this folder (branch `main`) at most every six hours and applies the rules that match.
This repairs the theme after a Spotify update without a new release. It can be switched off in the Mirage settings.

```json
{
  "v": 1,
  "rules": [
    {
      "spotify": "1.3.9",
      "mirageMax": "1.23.1",
      "sel": { "likeButton": "[data-testid='new-like']" },
      "css": ".newClass { color: var(--m-c) !important; }"
    }
  ]
}
```

- `spotify`: version prefix or list of prefixes; leave out or use `"*"` for every version.
- `mirageMin` / `mirageMax`: only for these Mirage versions. Set `mirageMax` to the last release that still needs the rule.
- `sel`: keys from `SEL` in `src/selectors.js`; the new selector is tried first, the built-in one stays as fallback.
- `css`: plain rules only. Rules with `@import`, `url(` or markup are ignored. Scripts cannot be loaded this way.
