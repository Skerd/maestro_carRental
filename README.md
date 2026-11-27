# carRental Module (Maestro)

Server-side implementation of the Arpeggio car rental domain: Mongoose models, availability and pricing, the booking service, lifecycle actions, HTTP routes, cron jobs, emails and DTO mappers.

Contracts (types, schema-defs, validators) live in **armonia** at `armonia/src/modules/carRental/`. This module implements the runtime layer.

Enable via `ENABLED_MODULES=carRental` (with `core` and `finance`).

## Key rules

- Customers book a category ("or similar"), or one exact car rented on its own (D198). A class booking is given a free car inside the booking transaction, cars not rented on their own first; an exact booking pins its car. The vehicle's `allocationVersion` is written in that transaction, so two parallel bookings of the last car confirm exactly one.
- Cars rented on their own (D198): a category is sold as a class unless `soldAsClass` is off; a car with `listedAlone` is booked as that car, priced from its own price list when it has one (armonia `helpers/vehicleRates.ts`: the list replaces the category's as a whole, the deposit separately). Online, such a car is offered only at the branch where it will be at pickup unless `CarRentalConfig.exactCarTransfers` lets staff bring it over for a fee. "Change car" (`reassignRentalVehicle`) may move a booking to any category's car, kept as booked or re-priced; the customer of an exact booking is emailed. A category's "Car prices" actions (`carPrices`, `setCarPrices`) edit its cars' switches, day prices and deposits at once. The site and the portal (kind `vehicle`, `/cars/<id>`) list these cars; the platform may hide one (`carRental.car` reportable).
- All times are stored as instants and entered as local time at each location (IANA time zone).
- Online payments settle through finance's Stripe webhook (`registerPaymentSourceHandler`).
- A customer reviews a completed rental once, from the manage link (`POST /api/carRental/rentalStorefront/manage/review`), and the review shows at once (D191). Staff never write, change or delete a review; they can report one to the platform. People report a car class, a car rented on its own (D198) or a review to the platform from the rental site (D191): `moduleBootstrap.reportables` declares `carRental.carClass`, `carRental.car` and `carRental.review` (`domain/reports/carRentalReportables.ts`); a class or review the platform hides (`hiddenByPlatform`) leaves the portal, the rental site, online booking and every rating.
- Card payments are "Coming soon" while finance's `CARD_PAYMENTS_AVAILABLE` is off (D190): every booking is paid at the desk whatever `paymentPolicy` says (`effectivePaymentPolicy`), the deposit is taken in cash, and every card step (paying online, a card hold, a saved card, staff booking "online") answers `rental_card_payments_coming_soon`. Fines and damage still go on the booking, owed at the desk.

## Directory layout

```
carRental/
├── api/carRental/private/         # CRUD routes and @actions
├── api/carRental/public/          # rentalStorefront (search, quote, book, manage)
├── database/moduleBootstrap.ts    # models, default roles, onAccountVerified (a verified account claims its guest bookings, P23.9), reportables (D191)
├── database/schemas/<resource>/   # models, indexes, services, snippets, views
├── domain/notifications/          # staff alerts
└── utilities/                     # services, mappers, emails, cron jobs
```

## Kafka

Every customer email goes through its own Kafka topic, one per kind, so it survives a restart and is retried (D188, BE-10). Kafka is optional: when core `publishEvent` returns `false` (Kafka off, topic unset or every attempt failed) the email is sent in-process instead (`dispatchRentalCustomerEmail`, `utilities/emails/rentalCustomerEmailDispatch.ts`, called by `notifyRentalCustomer`).

| Topic key (`KAFKA_TOPIC_<key>`, `KAFKA_CONSUMER_GROUP_<key>`) | Email |
|---|---|
| `RENTAL_CONFIRMED_EMAIL` | Booking confirmed (staff, online booking, Stripe settle, subscription cron) |
| `RENTAL_CANCELLED_EMAIL` | Booking cancelled |
| `RENTAL_REMINDER_EMAIL` | Pick-up reminder (cron) |
| `RENTAL_HANDED_OVER_EMAIL` | Car handed over, with the rental agreement PDF |
| `RENTAL_RETURNED_EMAIL` | Car returned, with the invoice PDF |
| `RENTAL_CHARGED_EMAIL` | A later charge (fine, damage), with the invoice PDF |
| `RENTAL_CAR_CHANGED_EMAIL` | The car of an exact booking was changed (D198) |

The event (`kafka/types.ts`) is already formatted for the email; the PDFs travel as ids (`withAgreement`, `invoiceId`) and are built when the email is sent. `startCarRentalKafkaConsumers` (`kafka/kafkaConsumer.ts`, started by the kafka server through core `startAllKafkaConsumers`) runs one consumer per topic. All fourteen variables are required while Kafka is on (`environment.validator.ts`).
