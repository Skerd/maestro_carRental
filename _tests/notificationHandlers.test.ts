import fs from "fs";
import path from "path";
import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {ObjectId} from "mongodb";
import type {createAndPushNotification} from "@coreModule/domain/notifications/notificationDomainService";

const mocks = vi.hoisted(() => ({createAndPush: vi.fn<Parameters<typeof createAndPushNotification>, Promise<object>>()}));

// The notification itself is recorded, not stored or pushed.
vi.mock("@coreModule/domain/notifications/notificationDomainService", () => ({createAndPushNotification: mocks.createAndPush}));

import {notificationEventBus} from "@coreModule/domain/notifications/notificationEventBus";
import {registerCarRentalNotificationHandlers} from "@carRentalModule/domain/notifications/carRentalNotificationHandlers";
import {NotificationEventCodes} from "@carRentalModule/domain/notifications/notificationEventCodes";

const companyId = new ObjectId().toString();
const receiver = new ObjectId().toString();
/** The panel's messages; maestro is built without sinfonia in the deploy image. */
const panelTypes = path.resolve(__dirname, "../../../../sinfonia/src/modules/carRental/assets/languages/en-US/notificationTypes.json");

async function paramsOf(code: string, payload: Record<string, unknown>) {
    mocks.createAndPush.mockReset().mockResolvedValue({});
    notificationEventBus.emit(code, {code, receiverIds: [receiver], payload: {companyId, ...payload}});
    await vi.waitFor(() => expect(mocks.createAndPush).toHaveBeenCalledTimes(1));
    return mocks.createAndPush.mock.calls[0][0].params;
}

beforeAll(() => {
    registerCarRentalNotificationHandlers();
});

beforeEach(() => {
    mocks.createAndPush.mockReset().mockResolvedValue({});
});

// TD-B173: carRental alerts stored only English text, so they were neither translated nor listed to turn off.
describe("carRental alerts carry their message values (D117)", () => {
    it("names the booking and its category", async () => {
        expect(await paramsOf(NotificationEventCodes.RENTAL_RESERVATION_NEW, {number: "RR-1", categoryName: "Compact"}))
            .toEqual({number: "RR-1", category: "Compact"});
    });

    it("picks the document type, the service limit and the damage severity as the variant", async () => {
        expect(await paramsOf(NotificationEventCodes.VEHICLE_DOCUMENT_EXPIRING, {plate: "ZH 1", documentType: "road_tax", expiresOn: "2026-12-01"}))
            .toEqual({plate: "ZH 1", expiresOn: "2026-12-01", variant: "road_tax"});
        expect(await paramsOf(NotificationEventCodes.VEHICLE_SERVICE_DUE, {plate: "ZH 1", dueOn: "2026-12-01", dueKm: 30000}))
            .toMatchObject({variant: "dateAndKm"});
        expect(await paramsOf(NotificationEventCodes.VEHICLE_SERVICE_DUE, {plate: "ZH 1", dueKm: 30000})).toMatchObject({variant: "km"});
        expect(await paramsOf(NotificationEventCodes.VEHICLE_DAMAGE_REPORTED, {plate: "ZH 1", severity: "major", area: "front"}))
            .toEqual({plate: "ZH 1", variant: "major"});
    });

    it.skipIf(!fs.existsSync(panelTypes))("has a panel message and title for every code", () => {
        const codes = (JSON.parse(fs.readFileSync(panelTypes, "utf8")) as {carRental: {codes: Record<string, {title?: string; message?: string}>}}).carRental.codes;
        for (const code of Object.values(NotificationEventCodes)) {
            expect(codes[code]?.title, code).toBeTruthy();
            expect(codes[code]?.message, code).toBeTruthy();
        }
    });
});
