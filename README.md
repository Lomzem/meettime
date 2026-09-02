# Chico State Meettime

A static Chico State class-schedule heatmap.

## Local development

```sh
bun install
bun run update:data
bun run dev
```

Validation:

```sh
bun run check
bun run lint
bun run test:unit -- --run
BASE_PATH=/meettime bun run build
```

Set `SCHEDULE_TERM` only to override Chico's current default term:

```sh
SCHEDULE_TERM=2272 bun run update:data
```

## Data pipeline

`scripts/update-schedule-data.ts` opens Chico's public class search with a cookie-preserving session, reads its configured term, validates every response, and follows the API's `pageCount` sequentially. It keeps meetings active on the current `America/Los_Angeles` date, includes modes `P`, `H`, `S`, and `X`, and aggregates enrollment into 30-minute buckets.

The updater validates a temporary file before atomically replacing `static/schedule.json`. A failed term lookup, page request, parse, or validation leaves the previous file unchanged.

The daily and manual GitHub Actions refreshes run the updater, checks, tests, and static build before committing the JSON and deploying to GitHub Pages. Pushes made with `GITHUB_TOKEN` do not recursively start the workflow.

## Meaning, privacy, and limitations

Each heatmap cell sums published enrollment for eligible meetings in that weekday and 30-minute block. Totals are a daily administrative snapshot and may change between refreshes. The published data excludes location and person data, class identifiers, and raw source records.
