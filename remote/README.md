# Remote fixes

Installed copies of Mirage load `fixes.json` from this folder (branch `main`) at most every six hours and apply the rules that match.
This repairs the theme after a Spotify update without a new release. Users can switch it off in the settings (*Repair itself after Spotify updates*).

```json
{
  "v": 1,
  "rules": [
    {
      "spotify": "1.3.9",
      "mirageMax": "1.24.0",
      "sel": { "likeButton": "[data-testid='new-like']" },
      "css": ".newClass { color: var(--m-c) !important; }"
    }
  ]
}
```

- `spotify`: a version prefix or a list of prefixes; leave it out or use `"*"` for every version.
- `mirageMin` / `mirageMax`: only for these Mirage versions. Set `mirageMax` to the last release that still needs the rule.
- `sel`: keys from `SEL` in `src/selectors.js`. The new selector is tried first, the built-in one stays as fallback. Unknown keys and invalid selectors are ignored.
- `css`: plain rules only. A rule's CSS is dropped if it contains `@import`, `url(`, `expression(`, `javascript:`, `behavior:` or `</`. Scripts cannot be loaded this way.
- At most 40 rules are read. Other fields (such as `note`) are ignored.
