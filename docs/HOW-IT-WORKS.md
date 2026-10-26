# How it works

**English** | [Português](HOW-IT-WORKS.pt-BR.md)

A guide to the code, for whoever maintains or reviews it.

```
github-pulse@joaocarvalhosm.github.io/
├── extension.js     wires everything: timer, fetching, cache and the indicator
├── prefs.js         settings window (token and interval)
├── stylesheet.css   look of the menu and the top bar
├── lib/             logic without UI (tested with make test)
│   ├── api.js       GraphQL query, HTTP errors, parsing and validation
│   ├── token.js     token in the keyring (libsecret)
│   ├── cache.js     last response in ~/.cache/github-pulse/
│   ├── urls.js      checks the addresses that come from the API
│   ├── stats.js     streaks, averages, last days, "X min ago"
│   ├── format.js    menu texts in Portuguese
│   ├── grid.js      geometry of the yearly grid and which day is under the pointer
│   └── palette.js   level colours for the light and dark styles
└── ui/              GNOME Shell widgets
    ├── indicator.js top-bar button and the menu
    └── heatmap.js   yearly grid and legend, drawn with Cairo
tests/
├── run.js           runs every *.test.js
├── harness.js       test(), eq(), throws(), fixture()
├── *.test.js        one file per lib/ module
├── smoke.sh         turns the extension on and off in a headless GNOME Shell
└── fixtures/        sample API response
```

The rule is: **whatever can be tested without GNOME Shell lives in `lib/`**,
and `ui/` only builds widgets from what `lib/` computes.

## How a refresh works

1. `extension.js` reads the token from the keyring (`lookupToken`). Without
   a token, the menu asks you to connect your account and the cache is
   deleted.
2. `GitHubClient.fetchPulse` makes **one** `POST` request to
   `https://api.github.com/graphql` with the `QUERY` query. It returns the
   calendar of the last year, the totals, the contributions per repository
   and the most recently pushed repositories.
3. `errorForStatus` turns the HTTP status into an error with a kind, and
   `viewerFromResponse` handles GraphQL errors.
4. `parseViewer` turns the response into a plain object (`pulse`, with a
   `version`), which is the only format the UI knows.
5. The picture is downloaded only when its URL changes, and only from
   `avatars.githubusercontent.com`.
6. The `pulse` goes to the cache and to `PulseIndicator.update()`.

When something fails, the last `pulse` stays on screen and the menu explains
why. The error kind (`GitHubError.kind`) decides the icon and what clicking
the notice does:

| `kind` | Cause | Clicking the notice |
|---|---|---|
| `auth` | token refused, missing permission or expired | opens the settings |
| `rate` | API rate limit | tries again |
| `network` | no connection | tries again |
| `api` | unexpected response or a redirect | tries again |

## When it refreshes

- When the extension is enabled: it shows the cache first, then fetches.
- Every `refresh-minutes` (15 by default).
- When the menu opens, if the data is more than 5 minutes old.
- When the settings change the token: `prefs.js` increments
  `token-revision`, and the extension reacts to that change. The token
  itself never goes through GSettings.

Only one fetch runs at a time (`_refreshing`). `disable()` cancels the
running fetch through the `Gio.Cancellable`, removes the timer, disconnects
the signals and destroys the indicator. After every `await`, the code checks
whether it was cancelled before touching the UI.

## The menu (`ui/indicator.js`)

From top to bottom: header (picture, name, last update and buttons), notice
(only when something is missing or failed), four numbers, yearly grid, year
summary and recent repositories. The header and the notice live outside
`this._data`, which is hidden as a whole when there is no data.

The buttons use the Shell's own `icon-button` class, to match the GNOME
look. Secondary text uses a translucent grey, which works on both the light
and the dark style.

> **Be careful when storing widgets on other widgets.**
> `column.name = label` looks harmless, but `name` is already a property of
> every `Clutter.Actor` and only accepts text. It broke enabling with
> "Promise callback terminated with uncatchable exception" and blocked the
> extensions after it. Use names that do not exist in Clutter/St, such as
> `valueLabel` and `dayLabel`. `make smoke` catches this kind of error.

## Yearly grid (`lib/grid.js` and `ui/heatmap.js`)

About 370 squares of 10 px with 3 px gaps, as on GitHub, drawn on a single
`St.DrawingArea` with Cairo, which is lighter than one widget per day.

- `layoutGrid(days)` computes where each day goes: the column is the week
  and the row is the day of the week (Sunday on top). It also computes where
  the month names go (a month with only a few days at the start is left out
  so it does not run into the next one) and "Seg", "Qua" and "Sex" (Mon,
  Wed, Fri) on the left.
- `cellAt(layout, x, y)` turns the pointer position into the day, or `-1`.
- `heatmap.js` only draws: the texts with PangoCairo in the theme font, and
  the squares with the colours from `palette.js`.

## Colours (`lib/palette.js`)

Levels 1 to 4 use GitHub's own shades of green, one scale for the dark style
and one for the light style. The choice comes from the theme's text colour:
light text means a dark style. Level 0 is the text colour at low opacity, so
it suits any background. In the top bar, the colours come from
`stylesheet.css` (classes `github-pulse-l0` to `l4`).

## Calculations (`lib/stats.js`)

- **Current streak:** days in a row with contributions up to today. An empty
  today does not break the streak yet; it is then counted from yesterday.
- **Longest streak:** the longest run in the calendar. Missing days count as
  a break.
- **Busiest day:** the highest **average** per day of the week, so the day
  that happens to appear more often in the period is not favoured.
- **Languages:** the main language of each repository you committed to,
  weighted by the number of commits.

## Security

- **Token:** only in the keyring (`lib/token.js`). The settings window
  checks the format (`github_pat_…` or `ghp_…`, with no spaces or line
  breaks, which prevents HTTP header injection) and tests the token with
  GitHub **before** saving it.
- **Requests:** the token is only sent to the fixed API address, with
  `Soup.MessageFlags.NO_REDIRECT`. A redirect becomes an `api` error instead
  of taking the token somewhere else. The picture download does not follow
  redirects either, does not carry the token, accepts only images up to
  1 MiB and is saved with mode `600`.
- **Addresses:** `lib/urls.js` accepts only HTTPS, on the exact host, with
  no user name and no port. A malformed link in the response cannot open
  another site or download anything from elsewhere.
- **CSS:** API data only gets into styles through `safeColor`, which accepts
  only `#rrggbb`. Texts go into `St.Label` as plain text, without markup.
- **Cache:** created with `Gio.FileCreateFlags.PRIVATE`, with the mode
  forced to `600`, because it holds the names of private repositories. On
  reading, `isValidPulse` checks the format and the version, and the picture
  path is recomputed instead of being taken from the file.
