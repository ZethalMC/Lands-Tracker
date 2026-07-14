# EMC Dynmap Bot

A Discord bot that archives Minecraft server map data (currently EarthMC and
Stoneworks) daily and renders a town's boundary over the real map terrain as
an image (single date) or animated GIF (date range), via slash commands.

This is a Discord.js rewrite of the original Python/discord.py bot, which
targeted EarthMC's old Dynmap-based marker feed. That feed no longer exists —
EarthMC's live map now runs on [squaremap](https://github.com/jpenilla/squaremap)
— so this rewrite reads town boundary data from squaremap's public marker
JSON instead, e.g. `https://map.earthmc.net/tiles/minecraft_overworld/markers.json`.
No API key or authentication is required; it's the same JSON each map's own
web frontend polls. Stoneworks runs the same squaremap software, so the same
logic works for both — see `src/lib/mapSources.js` for the registry of
supported servers. It keeps the same core behavior as the original — daily
archival, boundary rendering, town search — while fixing a few bugs and
adding per-guild runtime configuration.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_TOKEN` — your bot's token
   - `CLIENT_ID` — your application's ID
   - `GUILD_ID` — optional. If set, commands register instantly to just that
     guild (use this while developing). Leave blank to register commands
     globally, for production use across every guild the bot is in
     (propagation takes up to ~1 hour).
   - `OWNER_ID` — your Discord user ID. Only this user can run `/shutdown`.
3. Register the slash commands: `npm run deploy-commands`
4. Start the bot: `npm start`

**Run exactly one instance.** Each process keeps its own in-memory
claim-watch baseline (see below) and independently polls Discord/the map
sources — two instances running at once (e.g. a restart that didn't
actually kill the old process) means duplicate command handling and
duplicate/repeated claim-deletion alerts, not a crash, so it's easy to
miss. On Windows, `Get-CimInstance Win32_Process -Filter "Name =
'node.exe'"` lists any strays.

## Commands

- **`/townrender towns dates [map]`** — Renders one or more towns'
  boundaries over the real map terrain. `towns` and `dates` are
  space-separated. One date renders a PNG; two or more render an animated
  GIF. Dates use `D.M.YY` (leading zeros optional), e.g. `1.12.21`. Town
  names are case sensitive — use `/townsearch` to look them up. `map` picks
  which server to read from (`EarthMC`, default, or `Stoneworks`).
- **`/gif towns start_date [map]`** — Renders a 14-day (or up-to-today)
  animated GIF starting from `start_date`.
- **`/townsearch query date [map]`** — Lists archived town names starting
  with `query` on the given date.
- **`/config`** — Opens a single interactive configuration panel (an
  ephemeral Components V2 message) instead of a tree of subcommands.
  It shows every current setting and lets you change them directly:
  - A role select menu for staff roles (who can use `/townrender`, `/gif`,
    `/townsearch` — Manage Server can always use them regardless).
  - A channel select menu for the archive backup channel.
  - A channel select menu for the claim-deletion alert channel (unset =
    alerts off).
  - A role select menu for claim-deletion alert ping roles.
  - An "Edit Alert Message" button that opens a form (a Discord modal)
    pre-filled with the current message template. Placeholders:
    `{town} {map} {nation} {mayor} {councillors} {founded}
    {residentCount} {pvp} {public} {motto}`.

  Every change updates the panel in place, so it always reflects current
  state — no separate "show" command needed. Selecting nothing in a select
  menu clears that setting. See `src/commands/config.js` for the
  component/modal handlers (routed in `src/index.js` by `custom_id` prefix
  `config:`).
- **`/shutdown`** — Shuts the bot down. Only the user in `OWNER_ID` can run
  this.

`/config` requires the Manage Server permission and its panel is ephemeral
(only the person who ran it can see or use it).

## Map sources

Supported servers are registered in `src/lib/mapSources.js` — each entry is
just a base URL, world name, and squaremap marker-set ID. Adding another
squaremap-based server later is a matter of adding one entry there (and a
choice in each command's `map` option), not a code change.

- **EarthMC** — verified against the live map end-to-end.
- **Stoneworks** — its main map (Abexilas, `map.stoneworks.gg/abex`) was
  taken fully offline for an in-game war while this was set up, including
  its JSON API, so its world name (`minecraft_overworld`) and marker-set ID
  (`towny`) are inferred from the same convention its (separately live)
  nether map uses, not directly verified. The downloader validates every
  response is real JSON before archiving it, so a wrong guess here fails
  loudly (logged, nothing saved) rather than silently corrupting data —
  check `src/lib/mapSources.js` and correct if needed once Abexilas is back.

## How archiving works

Every hour (and once at startup), the bot checks whether today's marker
data has already been downloaded for each source in `mapSources.js`. If
not, it downloads it to `data/archive/<source>/<YYYY-MM-DD>.json` and
uploads the new file to every guild's configured backup channel (see
`/config backup-channel`).

`/townrender` and `/gif` read from this local archive — a date has no data
until the bot has archived it (or you've backfilled files into
`data/archive/<source>/` yourself in the same `<YYYY-MM-DD>.json` shape).

## Claim-deletion alerts

Separately from daily archiving, `src/lib/claimWatch.js` polls every map
source's *live* marker data every 5 minutes (not the daily archive) and
diffs the set of town names against the previous poll. Any town present
before but missing now is reported as deleted to every guild with a
`/config claim-alerts channel` set, using that guild's configured message
template and pinging any configured ping roles once per alert batch.

The extra fields (`{nation}`, `{mayor}`, `{councillors}`, `{founded}`,
`{residentCount}`, `{pvp}`, `{public}`, `{motto}`) come from the *last
known* snapshot of the town before it disappeared — squaremap embeds them
as HTML inside each town marker's `popup` field (not as clean structured
data), parsed by `townData.js::parseTownDetails`. Verified against every
town in a real live fetch (5187/5187 parsed successfully, including towns
with no nation).

Alerts render as Components V2, chunked to multiple messages if a single
batch of deletions is too long for one message (e.g. a mass-wipe event) —
the ping roles are only included on the first chunk of a batch.

This is in-memory only — a bot restart just re-establishes the baseline on
the next poll (no false "everything was deleted" alert, but also no alert
for a deletion that happens to land in that gap). A source whose fetch
fails that cycle (e.g. Stoneworks while its map is offline) is skipped
entirely rather than treated as "every town on it was deleted."

## Notes on the rewrite

Compared to the original Python bot:

- Slash commands instead of `.`-prefixed text commands.
- Fixed: the original's staff-role check was always `true` due to an
  operator-precedence bug, so any user could run staff commands. Access is
  now Manage Server, or a role configured via `/config role add`.
- Fixed: `.shutdown` called a method that doesn't exist in modern
  discord.py; `/shutdown` now works and is owner-only.
- Fixed: the marker downloader retried forever on a 502 with no backoff;
  it now retries a bounded number of times with exponential backoff.
- Renders happen in memory and are attached directly to the reply — no
  shared temp file, so concurrent renders can't clobber each other.
- Responses use Discord's Components V2 layout instead of classic embeds.
- The native C min/max helper library is gone — it was Linux-only (the
  bundled `.so` couldn't load on Windows at all) and did nothing pure JS
  can't do trivially.
- The old Dynmap "Towny"/"Aurora" per-map selector (two eras of the same
  EarthMC server) is gone — but a new `map` option exists on each command
  to choose between actual different servers (EarthMC, Stoneworks), backed
  by the source registry in `src/lib/mapSources.js`.
- The downloader now validates that a response is actually JSON before
  archiving it. squaremap serves its HTML frontend (not a 404) for unknown
  paths, so a wrong/dead URL would otherwise get silently saved as if it
  were real marker data.
- New: renders now show the actual map terrain behind the town boundary,
  stitched live from squaremap's own tile server (`src/lib/mapTiles.js`),
  instead of a plain white background. For a `/gif`, the terrain is fetched
  once and reused across all frames rather than refetched per date. If the
  tile server can't be reached, rendering falls back to a plain white
  background rather than failing.
- `/config` is a single interactive panel (select menus + a modal) instead
  of ~13 subcommands across three subcommand groups.

## A note on what's untested here

Everything in this rewrite has been checked against real, live data —
except the `/config` panel's Discord-side interaction behavior itself
(select menus updating in place, the modal pre-filling and submitting back
to the original message). That logic is exercised end-to-end with fake
interaction objects (`src/commands/config.js`'s `handleComponent`/
`handleModal` called directly, verified against real stored guild config),
which confirms the persistence and re-render logic is correct, but not
that Discord's actual client-side behavior matches what I expect (e.g.
that a modal opened from a button can `.update()` the original message).
Worth a real click-through before relying on it.
