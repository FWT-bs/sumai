# Sumai

Import UW class schedules, share one join code, and see the hours a whole group
has open.

Built for the way UW schedules actually come out of MyUW: you paste them.


## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

There is nothing to configure. The database is a SQLite file created on first
write under `./data` (override with `SUMAI_DATA_DIR`).

```bash
npm run build        # production build
npm start            # serve the build
npm test             # parser and availability engine
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

## How it works

1. **Someone starts a group** and gets a six-character join code.
2. **Everyone else enters the code**, adds their name, and imports their week.
3. **The overlap shows up** on a single week grid, plus a ranked list of the
   windows the whole group shares.

A browser remembers which member it is in `localStorage`, so there are no
accounts and no passwords. The join code is the only thing anyone needs.

### Filtering to a subgroup

The chips under **Who to include** switch people in and out of the calculation.
Turn three of five off and the grid and the window list recompute for the two
who are left, so a pair can find their own time without leaving the group.
`Everyone`, `Only imported` and `Just me` are shortcuts for the common cases.

## Importing a schedule

Three ways, all in the same editor, and they stack — paste a schedule, then add
a work shift by hand.

### Paste

`src/lib/parse-uw.ts` scans for the two things every UW schedule format has, a
day spec and a time range, rather than expecting fixed columns. That covers the
places students copy from:

| Source | Looks like |
| --- | --- |
| MyUW registration table | `ENGL 131  A  5.0  MWF  10:30 AM - 11:20 AM  MGH 241` |
| Time Schedule row | `12345 A 5 MWF 830-920 KNE 130 Smith,John` |
| MyPlan / visual schedule | course code, section type, days and time, and room on separate lines |

Specifically it reads:

- **Day codes** as UW writes them — `MWF`, `TTh`, `MTWThF`, `Th`, `Daily` — plus
  long names (`Monday, Wednesday, Friday`) and `TR`. `Th` is never mistaken for
  Tuesday, and `MATH`, `CHEM` and `KNE` are never mistaken for day codes.
- **Times** in every form UW prints: `10:30 AM - 11:20 AM`, `830-920`,
  `130-220P`, `2:30-3:20 PM` (one meridiem covering both ends), `13:30–14:50`.
  A compact time with no meridiem and an hour of 1–6 is read as the afternoon,
  since nothing at UW starts at 1:30 AM.
- **Course codes** including multi-word departments (`A A 210`, `B BIO 180`),
  carried across lines when the days and times sit on their own row.
- **Rooms**, from the same line or the line below, with the instructor's name
  trimmed off.

Classes with no meeting time (`TBA`) are reported rather than dropped silently,
so you know to add them by hand if they do meet.

### Calendar file

An `.ics` export. A weekly recurring event becomes a weekly busy block using
its `BYDAY` list; a one-off event uses its own weekday. All-day events are
skipped, since blocking an entire day is almost never what the export meant.
Times are read as wall-clock time, so an export whose times are in UTC is
converted using the browser's own zone.

### By hand

Label, day buttons, start and end. Use it for work, practice, or anything the
paste missed.

## The availability engine

`src/lib/availability.ts` works in **ten-minute slots**, which is lossless for
UW schedules — classes start and end on tens of minutes (8:30–9:20, 10:00–11:20).

`buildGrid` marks every slot a class touches for everyone in the filter.
`findWindows` then merges runs of adjacent slots that share the *same set* of
free people, so a reported window never quietly swaps who it is talking about
halfway through. Results are ranked by fewest people missing, then longest,
then earliest.

When nothing at all works for the whole filter, `findBestWindows` widens to the
windows that are one person short and labels them, rather than showing an empty
list.

## Layout

```
src/
  app/
    page.tsx                 landing — start or join
    g/[code]/page.tsx        the group week
    api/groups/…             create, read, join
    api/members/[id]/…       rename, leave, replace a week
    globals.css              design tokens for both themes
  components/
    availability-grid.tsx    the week heatmap
    shared-windows.tsx       ranked list of shared windows
    member-filter.tsx        who the overlap is computed for
    import-schedule-dialog.tsx
    ui/                      shadcn-style primitives on Radix
  lib/
    parse-uw.ts   parse-ics.ts      importers
    availability.ts  heat.ts        overlap and its colour ramp
    time.ts  code.ts  validate.ts   UW time formats, join codes, input limits
    store.ts  db.ts                 SQLite access
```

## Design

Inter throughout, with tabular figures wherever times and counts line up in a
column. The accent is UW's own purple (`#4B2E83`) with Husky gold
(`#B7A57A`) for duration badges; neutrals carry a slight purple bias so they
sit with it. Both light and dark are defined at the token level in
`globals.css`, and every component reads tokens rather than literal colours, so
the app follows the system theme and the in-app toggle overrides it either way.

The grid encodes how many people are free as colour, and the ramp deliberately
stops short of full saturation: a group early in the quarter is free most of the
week, and a solid accent across five days buries the hours that are *not* free.

Mobile is the primary target. The week grid fits five or seven days at 390px
without sideways scrolling, dialogs become bottom sheets, and the member filter
is a swipeable rail.

### Components

The `ui/` primitives are written in the shadcn/ui "new-york" idiom that
[21st.dev](https://21st.dev) publishes against — Radix primitives, Tailwind
tokens, `class-variance-authority` variants, `data-slot` attributes — and
`components.json` declares the `@21st` registry, so components can be pulled in
alongside them:

```bash
npx shadcn@latest add @21st/<author>/<component>
```

21st.dev was unreachable from the network this was built on, so nothing was
fetched from it and the registry URL in `components.json` is unverified. If the
command above 404s, correct the `registries` entry and it will work.

## Limits worth knowing

- **The join code is the only access control.** Anyone holding it can join the
  group and see everyone's names and class times. There are 31^6 (about 887
  million) codes and they avoid look-alike characters, so guessing one is
  impractical, but treat a code the way you would treat a shared calendar link.
- **Your seat lives in `localStorage`.** Clear site data and you rejoin as a new
  person; the old entry stays until someone removes it.
- **SQLite means one server with a disk.** It runs anywhere Node does, but a
  serverless deploy with an ephemeral filesystem will lose groups between
  invocations. Swap `src/lib/store.ts` for a hosted database to deploy that way;
  every query lives in that one file.
- **Times have no date.** A week is a repeating template, so quarter start and
  end dates, holidays and one-off cancellations are not modelled.
