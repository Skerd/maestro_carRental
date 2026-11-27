/**
 * D188: every rental customer email kind goes through its own Kafka topic; when the publish fails it is sent directly,
 * with its agreement or invoice PDF built from the ids in the event.
 */
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";

const {published, publishResult, sent, specs} = vi.hoisted(() => ({
    published: [] as {topic: string | undefined; key: string; event: {eventType: string}}[],
    publishResult: {value: true},
    sent: [] as {kind: string; attachments?: () => Promise<{filename: string; content: Buffer}[]>}[],
    specs: [] as {registryKey: string; topic?: string; groupId?: string; expectedEventType: string}[],
}));

vi.mock("@carRentalModule/environment", async (importOriginal) => {
    const {CAR_RENTAL_KAFKA} = await importOriginal<typeof import("@carRentalModule/environment")>();
    const keys = Object.keys(CAR_RENTAL_KAFKA.TOPICS);
    return {
        CAR_RENTAL_KAFKA: {
            TOPICS: Object.fromEntries(keys.map((key) => [key, `topic-${key}`])),
            CONSUMER_GROUP: Object.fromEntries(keys.map((key) => [key, `group-${key}`])),
        },
    };
});
vi.mock("@coreModule/environment", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@coreModule/environment")>();
    return {...actual, KAFKA: {...actual.KAFKA, ENABLED: true}};
});
vi.mock("@coreModule/kafka/kafkaProducer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@coreModule/kafka/kafkaProducer")>()),
    publishEvent: vi.fn(async (topic: string | undefined, key: string, event: {eventType: string}) => {
        published.push({topic, key, event});
        return publishResult.value;
    }),
}));
vi.mock("@coreModule/kafka/kafkaConsumer", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@coreModule/kafka/kafkaConsumer")>()),
    startKafkaTopicConsumers: vi.fn(async (_parent: unknown, _log: unknown, given: typeof specs) => {
        specs.push(...given);
    }),
}));
vi.mock("@carRentalModule/utilities/emails/sendRentalCustomerMail", () => ({
    sendRentalCustomerMail: vi.fn(async (mail: (typeof sent)[number]) => {
        sent.push(mail);
    }),
}));
vi.mock("@carRentalModule/database/schemas/rentalReservation/rentalReservation.service", () => ({
    rentalReservationService: {findById: vi.fn(async () => ({number: "RR-1"}))},
}));
vi.mock("@carRentalModule/utilities/pdf/rentalAgreementPdf", () => ({generateRentalAgreementPdf: vi.fn(async () => Buffer.from("agreement"))}));
vi.mock("@carRentalModule/utilities/services/rentalInvoices", () => ({
    invoiceAttachment: vi.fn(() => async () => [{filename: "INV-1.pdf", content: Buffer.from("invoice")}]),
}));

import {dispatchRentalCustomerEmail} from "@carRentalModule/utilities/emails/rentalCustomerEmailDispatch";
import {RENTAL_EMAIL_TOPIC_BY_KIND, rentalEmailEventType} from "@carRentalModule/kafka/kafkaProducer";
import {startCarRentalKafkaConsumers} from "@carRentalModule/kafka/kafkaConsumer";
import type {RentalCustomerEmailEvent} from "@carRentalModule/kafka/types";
import type {RentalCustomerEmailKind} from "@carRentalModule/utilities/emails/sendRentalCustomerMail";

const KINDS = Object.keys(RENTAL_EMAIL_TOPIC_BY_KIND) as RentalCustomerEmailKind[];
const bookingId = new ObjectId().toString();

function event(kind: RentalCustomerEmailKind, extra: Partial<RentalCustomerEmailEvent> = {}): RentalCustomerEmailEvent {
    return {
        eventType: rentalEmailEventType(kind),
        timestamp: Date.now(),
        rentalReservationId: bookingId,
        kind,
        companyId: new ObjectId().toString(),
        companyName: "Rent & Go",
        languageCode: "en-US",
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        number: "RR-1",
        categoryName: "Compact",
        pickupAt: "1 Dec",
        pickupLocation: "Airport",
        returnAt: "3 Dec",
        returnLocation: "Airport",
        total: "€120",
        manageToken: "token",
        manageUrl: "https://rent-go.example/car-rental/manage",
        ...extra,
    };
}

beforeEach(() => {
    published.length = 0;
    sent.length = 0;
    specs.length = 0;
    publishResult.value = true;
});

describe("rental customer emails on Kafka (D188)", () => {
    it("publishes each of the 7 kinds on its own topic, keyed by the booking, and sends nothing directly", async () => {
        for (const kind of KINDS) await dispatchRentalCustomerEmail(event(kind));

        expect(KINDS).toHaveLength(7);
        expect(new Set(published.map((p) => p.topic)).size).toBe(7);
        for (const [index, kind] of KINDS.entries()) {
            expect(published[index].topic).toBe(`topic-${RENTAL_EMAIL_TOPIC_BY_KIND[kind]}`);
            expect(published[index].key).toBe(bookingId);
            expect(published[index].event.eventType).toBe(RENTAL_EMAIL_TOPIC_BY_KIND[kind].toLowerCase());
        }
        expect(sent).toEqual([]);
    });

    it("sends it directly when it is not published, with the PDFs built from the event's ids", async () => {
        publishResult.value = false;
        await dispatchRentalCustomerEmail(event("handedOver", {withAgreement: true}));
        await dispatchRentalCustomerEmail(event("charged", {invoiceId: new ObjectId().toString()}));
        await dispatchRentalCustomerEmail(event("confirmed"));

        expect(sent.map((mail) => mail.kind)).toEqual(["handedOver", "charged", "confirmed"]);
        expect(await sent[0].attachments?.()).toEqual([{filename: "RR-1.pdf", content: Buffer.from("agreement")}]);
        expect(await sent[1].attachments?.()).toEqual([{filename: "INV-1.pdf", content: Buffer.from("invoice")}]);
        expect(sent[2].attachments).toBeUndefined();
    });

    it("starts one consumer per kind, each on its own topic and group", async () => {
        await startCarRentalKafkaConsumers();

        expect(specs.map((spec) => [spec.topic, spec.groupId, spec.expectedEventType])).toEqual(
            KINDS.map((kind) => {
                const key = RENTAL_EMAIL_TOPIC_BY_KIND[kind];
                return [`topic-${key}`, `group-${key}`, key.toLowerCase()];
            }),
        );
    });
});
