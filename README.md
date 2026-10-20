# carRental Module (Maestro)

Server-side implementation of the Arpeggio car rental domain: Mongoose models, availability and pricing, the booking service, lifecycle actions, HTTP routes, cron jobs, emails and DTO mappers.

Contracts (types, schema-defs, validators) live in **armonia** at `armonia/src/modules/carRental/`. This module implements the runtime layer.

Enable via `ENABLED_MODULES=carRental` (with `core` and `finance`).

## Key rules

- Customers book a category; a free vehicle is assigned inside the booking transaction. The vehicle's `allocationVersion` is written in that transaction, so two parallel bookings of the last car confirm exactly one.
- All times are stored as instants and entered as local time at each location (IANA time zone).
- Online payments settle through finance's Stripe webhook (`registerPaymentSourceHandler`).

## Directory layout

```
carRental/
├── api/carRental/private/         # CRUD routes and @actions
├── api/carRental/public/          # rentalStorefront (search, quote, book, manage)
├── database/moduleBootstrap.ts    # models, default roles
├── database/schemas/<resource>/   # models, indexes, services, snippets, views
├── domain/notifications/          # staff alerts
└── utilities/                     # services, mappers, emails, cron jobs
```
