# Chico State Meettime

A static heatmap of Chico State scheduled in-person class enrollment by subject, weekday, and time.

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

## Meaning and limitations

The heatmap shows **scheduled in-person enrollment, not attendance**. It is a daily snapshot of meeting schedules active on the refresh date. Fully online and ambiguous “possible in person” modes are excluded.

Repeated meetings within one class are deduplicated. Distinct combined or cross-listed class numbers remain separate because their enrollment totals are separate allocations and the API provides no reliable combined-group identifier.

The public JSON contains only term metadata, generation dates, subject labels, time buckets, and aggregate counts. It excludes buildings, rooms, facilities, instructors, class identifiers, student identities, and raw API records.
