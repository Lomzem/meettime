# Chico State Meettime

Meettime helps Chico State clubs choose times for meetings and activities. It shows enrollment by subject, day, and time.

The data comes from the Chico State Student Center. An automatic process refreshes the data each day and updates the site only after all checks pass.

Meettime publishes totals only. It does not publish names, instructors, rooms, class numbers, or raw records.

## Development

Install [Bun](https://bun.sh/), then run:

```sh
bun install
bun run dev
```

Run all checks:

```sh
bun run check
bun run lint
bun run test
BASE_PATH=/meettime bun run build
```
