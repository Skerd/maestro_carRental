import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_CONTACT_NAME_MAX,
    RENTAL_CONTACT_PHONE_MAX,
    RENTAL_NOTES_MAX,
    RENTAL_PROMO_CODE_INPUT_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";
import {CARD_PAYMENTS_AVAILABLE} from "armonia/src/modules/finance/helpers/cardPaymentAvailability";

const API_URL = "/api/carRental/rentalReservation";

export const rentalReservationSheetView: ViewConfig = {
    model: "rentalreservations",
    viewType: "sheet",
    sheetWidget: "#RentalReservationSheetView",
    accessModel: "rentalreservations",
    apiUrl: API_URL,
    header: {
        titleField: "number",
        subtitleKey: "rentalReservationSubtitle",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "needsTransfer",
                            permissions: {read: "needsTransfer"},
                            field: {
                                name: "needsTransfer",
                                widget: "#DisplayCard",
                                label: "needsTransfer",
                                // Shown only when a car must be moved before pickup, as an alert (UX-03).
                                widgetProps: {
                                    icon: "#IconTruckDelivery",
                                    type: "boolean",
                                    variant: "warning",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paymentStatus"},
                            field: {
                                name: "paymentStatus",
                                widget: "#DisplayCard",
                                label: "paymentStatus",
                                widgetProps: {
                                    icon: "#IconCreditCard",
                                    type: "enum",
                                    languageKeyCategory: "paymentStatusValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "paymentChoice",
                            permissions: {read: "paymentChoice"},
                            field: {
                                name: "paymentChoice",
                                widget: "#DisplayCard",
                                label: "paymentChoice",
                                widgetProps: {
                                    icon: "#IconCash",
                                    type: "enum",
                                    languageKeyCategory: "paymentChoiceValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "category"},
                            field: {
                                name: "category.name",
                                widget: "#DisplayCard",
                                label: "category",
                                widgetProps: {
                                    icon: "#IconCategory",
                                    linkedRefPath: "category",
                                    linkedSheetModel: "vehiclecategories",
                                    linkedSheetWidget: "#VehicleCategorySheetView",
                                    linkedSheetEntityProp: "vehicleCategory",
                                },
                            },
                        },
                        {
                            // This exact car was booked (D198): it is guaranteed, never "or similar".
                            render: "#DisplayCard",
                            dependent: "snapshot.vehicleTitle",
                            permissions: {read: "vehicle"},
                            field: {
                                name: "snapshot.vehicleTitle",
                                widget: "#DisplayCard",
                                label: "exactVehicle",
                                widgetProps: {
                                    icon: "#IconStar",
                                    variant: "info",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "vehicle.plate",
                            permissions: {read: "vehicle"},
                            field: {
                                name: "vehicle.plate",
                                widget: "#DisplayCard",
                                label: "vehicle",
                                widgetProps: {
                                    icon: "#IconCar",
                                    linkedRefPath: "vehicle",
                                    linkedSheetModel: "vehicles",
                                    linkedSheetWidget: "#VehicleSheetView",
                                    linkedSheetEntityProp: "vehicle",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "source"},
                            field: {
                                name: "source",
                                widget: "#DisplayCard",
                                label: "source",
                                widgetProps: {
                                    icon: "#IconWorld",
                                    type: "enum",
                                    languageKeyCategory: "sourceValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pickupLocation"},
                            field: {
                                name: "pickupLocation.name",
                                widget: "#DisplayCard",
                                label: "pickupLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "pickupLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pickupAt"},
                            field: {
                                name: "pickupAt",
                                widget: "#DisplayCard",
                                label: "pickupAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "holdExpiresAt",
                            permissions: {read: "holdExpiresAt"},
                            field: {
                                name: "holdExpiresAt",
                                widget: "#DisplayCard",
                                label: "holdExpiresAt",
                                widgetProps: {
                                    icon: "#IconHourglass",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "returnLocation"},
                            field: {
                                name: "returnLocation.name",
                                widget: "#DisplayCard",
                                label: "returnLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "returnLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "returnAt"},
                            field: {
                                name: "returnAt",
                                widget: "#DisplayCard",
                                label: "returnAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "customer.name",
                            permissions: {read: "customer"},
                            field: {
                                name: "customer.name",
                                widget: "#DisplayCard",
                                label: "customer",
                                widgetProps: {icon: "#IconUser"},
                            },
                        },
                    ],
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "notes",
                            permissions: {read: "notes"},
                            field: {
                                name: "notes",
                                widget: "#DisplayCard",
                                label: "notes",
                                widgetProps: {
                                    icon: "#IconAlignLeft",
                                    expandable: true,
                                    maxLength: 250,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "pricing"},
            permissions: {read: "pricing"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pricing"},
                            field: {
                                name: "pricing.rentalDays",
                                widget: "#DisplayCard",
                                label: "rentalDays",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pricing"},
                            field: {
                                name: "pricing.grandTotal",
                                widget: "#DisplayCard",
                                label: "grandTotal",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "pricing.grandTotal"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "amountPaid"},
                            field: {
                                name: "amountPaid",
                                widget: "#DisplayCard",
                                label: "amountPaid",
                                widgetProps: {
                                    icon: "#IconCashBanknote",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "amountPaid"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pricing"},
                            field: {
                                name: "pricing.vatAmount",
                                widget: "#DisplayCard",
                                label: "vatAmount",
                                widgetProps: {
                                    icon: "#IconReceiptTax",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "pricing.vatAmount"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pricing"},
                            field: {
                                name: "pricing.depositAmount",
                                widget: "#DisplayCard",
                                label: "depositAmount",
                                widgetProps: {
                                    icon: "#IconShieldLock",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "pricing.depositAmount"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.reservation.sheet.lines.listDisplay", defaultMode: "compact"},
            children: [
                {
                    render: "#SheetGroup",
                    dependent: "pricing.lines",
                    props: {title: "priceLines", titleActions: "#ReferencesViewModeToggle"},
                    permissions: {read: "pricing"},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "pricing"},
                                    field: {
                                        name: "pricing.lines",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 6,
                                            entityCards: true,
                                            columns: 2,
                                            fields: [
                                                {
                                                    name: "label",
                                                    type: "text",
                                                    labelKey: "lineLabel",
                                                    className: "text-sm font-medium",
                                                },
                                                {
                                                    name: "quantity",
                                                    type: "text",
                                                    labelKey: "quantity",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "unitPrice",
                                                    type: "text",
                                                    labelKey: "unitPrice",
                                                    className: "text-sm",
                                                    currencyField: "currency",
                                                },
                                                {
                                                    name: "total",
                                                    type: "text",
                                                    labelKey: "total",
                                                    className: "text-sm",
                                                    currencyField: "currency",
                                                },
                                            ],
                                            compactSummaryFields: ["label", "total"],
                                            compactSummaryJoinSeparator: " · ",
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "deposit", defaultOpen: false},
            dependent: "deposit",
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "deposit.method",
                            permissions: {read: "deposit"},
                            field: {
                                name: "deposit.method",
                                widget: "#DisplayCard",
                                label: "deposit_method",
                                widgetProps: {
                                    icon: "#IconCreditCard",
                                    type: "enum",
                                    languageKeyCategory: "depositMethodValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "deposit.status",
                            permissions: {read: "deposit"},
                            field: {
                                name: "deposit.status",
                                widget: "#DisplayCard",
                                label: "deposit_status",
                                widgetProps: {
                                    icon: "#IconStatusChange",
                                    type: "enum",
                                    languageKeyCategory: "depositStatusValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "deposit.amount",
                            permissions: {read: "deposit"},
                            field: {
                                name: "deposit.amount",
                                widget: "#DisplayCard",
                                label: "deposit_amount",
                                widgetProps: {
                                    icon: "#IconShieldLock",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "deposit.amount"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "deposit.capturedAmount",
                            permissions: {read: "deposit"},
                            field: {
                                name: "deposit.capturedAmount",
                                widget: "#DisplayCard",
                                label: "deposit_capturedAmount",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["pricing.currency.symbol", "deposit.capturedAmount"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "pricing.currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "contact"},
            permissions: {read: "contact"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contact"},
                            field: {
                                name: "contact.firstName",
                                widget: "#DisplayCard",
                                label: "firstName",
                                widgetProps: {icon: "#IconUser"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contact"},
                            field: {
                                name: "contact.lastName",
                                widget: "#DisplayCard",
                                label: "lastName",
                                widgetProps: {icon: "#IconUser"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contact"},
                            field: {
                                name: "contact.email",
                                widget: "#DisplayCard",
                                label: "email",
                                widgetProps: {icon: "#IconMail"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contact"},
                            field: {
                                name: "contact.phone",
                                widget: "#DisplayCard",
                                label: "phone",
                                widgetProps: {icon: "#Phone"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.reservation.sheet.drivers.listDisplay", defaultMode: "cards"},
            children: [
                {
                    render: "#SheetGroup",
                    dependent: "drivers",
                    props: {title: "drivers", titleActions: "#ReferencesViewModeToggle"},
                    permissions: {read: "drivers"},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "drivers"},
                                    field: {
                                        name: "drivers",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 6,
                                            entityCards: true,
                                            columns: 2,
                                            fields: [
                                                {
                                                    name: "role",
                                                    type: "text",
                                                    languageKeyCategory: "driverRole",
                                                    labelKey: "role",
                                                    className: "text-sm font-medium",
                                                },
                                                {
                                                    name: "firstName",
                                                    type: "text",
                                                    labelKey: "firstName",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "lastName",
                                                    type: "text",
                                                    labelKey: "lastName",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "birthDate",
                                                    type: "text",
                                                    format: "date",
                                                    labelKey: "birthDate",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "licenseNumber",
                                                    type: "text",
                                                    labelKey: "licenseNumber",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "licenseCountry",
                                                    type: "text",
                                                    labelKey: "licenseCountry",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "licenseExpiresAt",
                                                    type: "text",
                                                    format: "date",
                                                    labelKey: "licenseExpiresAt",
                                                    className: "text-sm",
                                                },
                                            ],
                                            compactSummaryFields: ["firstName", "lastName", "role"],
                                            compactSummaryJoinSeparator: " ",
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "inspection", defaultOpen: false},
            dependent: "handover",
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "handover.odometerKm",
                            permissions: {read: "handover"},
                            field: {
                                name: "handover.odometerKm",
                                widget: "#DisplayCard",
                                label: "handover_odometerKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "handover.fuelLevel",
                            permissions: {read: "handover"},
                            field: {
                                name: "handover.fuelLevel",
                                widget: "#DisplayCard",
                                label: "handover_fuelLevel",
                                widgetProps: {
                                    icon: "#IconGasStation",
                                    type: "enum",
                                    languageKeyCategory: "fuelValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "returnInfo.odometerKm",
                            permissions: {read: "returnInfo"},
                            field: {
                                name: "returnInfo.odometerKm",
                                widget: "#DisplayCard",
                                label: "returnInfo_odometerKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "returnInfo.fuelLevel",
                            permissions: {read: "returnInfo"},
                            field: {
                                name: "returnInfo.fuelLevel",
                                widget: "#DisplayCard",
                                label: "returnInfo_fuelLevel",
                                widgetProps: {
                                    icon: "#IconGasStation",
                                    type: "enum",
                                    languageKeyCategory: "fuelValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "agreement.signerName",
                            permissions: {read: "agreement"},
                            field: {
                                name: "agreement.signerName",
                                widget: "#DisplayCard",
                                label: "agreement_signerName",
                                widgetProps: {icon: "#IconSignature"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "agreement.signedAt",
                            permissions: {read: "agreement"},
                            field: {
                                name: "agreement.signedAt",
                                widget: "#DisplayCard",
                                label: "agreement_signedAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    type: "dateTime",
                                },
                            },
                        },
                    ],
                },
                {
                    render: "#SheetMediaFilesStrip",
                    permissions: {read: "handover"},
                    field: {
                        name: "handover.photos",
                        widget: "#SheetMediaFilesStrip",
                        widgetProps: {canDownload: true, canRemove: false},
                    },
                },
                {
                    render: "#SheetMediaFilesStrip",
                    permissions: {read: "returnInfo"},
                    field: {
                        name: "returnInfo.photos",
                        widget: "#SheetMediaFilesStrip",
                        widgetProps: {canDownload: true, canRemove: false},
                    },
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.reservation.sheet.timeline.listDisplay", defaultMode: "compact"},
            children: [
                {
                    render: "#SheetGroup",
                    dependent: "timeline",
                    props: {title: "timeline", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    permissions: {read: "timeline"},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#SheetEmbeddedItemsList",
                                    permissions: {read: "timeline"},
                                    field: {
                                        name: "timeline",
                                        widget: "#SheetEmbeddedItemsList",
                                        widgetProps: {
                                            pageSize: 6,
                                            entityCards: true,
                                            columns: 1,
                                            sortField: "at",
                                            fields: [
                                                {
                                                    name: "event",
                                                    type: "text",
                                                    languageKeyCategory: "timelineEvent",
                                                    labelKey: "event",
                                                    className: "text-sm font-medium",
                                                },
                                                {
                                                    name: "at",
                                                    type: "text",
                                                    format: "dateTime",
                                                    labelKey: "at",
                                                    className: "text-sm",
                                                },
                                                {
                                                    name: "note",
                                                    type: "text",
                                                    labelKey: "note",
                                                    className: "text-sm",
                                                },
                                            ],
                                            compactSummaryFields: ["event", "note", "at"],
                                            compactSummaryJoinSeparator: " · ",
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

/** Staff booking (phone, walk-in). Immutable after create — every change is an action. */
export const rentalReservationCreateFormView: ViewConfig = {
    model: "rentalreservations",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalreservations",
    apiUrl: API_URL,
    method: "PUT",
    nodes: [
        {
            render: "#TitleWithCollapse",
            props: {title: "form.tripSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#Field",
                            field: {
                                name: "category",
                                widget: "#ApiSelect",
                                label: "form.categoryLabel",
                                placeholder: "form.categoryPlaceholder",
                                required: true,
                                widgetProps: {
                                    apiUrl: "/api/carRental/vehicleCategory/select",
                                    pageSize: 50,
                                    normalizeEmptyToUndefined: true,
                                    defaultOptionsFormExtraKey:
                                        "categoryDefaultOptions",
                                    cascadeClearFormFields: ["vehicle"],
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "vehicle",
                                widget: "#ApiSelect",
                                label: "form.vehicleLabel",
                                placeholder: "form.vehiclePlaceholder",
                                widgetProps: {
                                    apiUrl: "/api/carRental/vehicle/select",
                                    pageSize: 50,
                                    normalizeEmptyToUndefined: true,
                                    postBodyFromFormFields: [
                                        {
                                            field: "category",
                                            paramName: "category",
                                        },
                                    ],
                                    enableWhenFormFieldsNonEmpty: ["category"],
                                    defaultOptionsFormExtraKey:
                                        "vehicleDefaultOptions",
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "exactVehicle",
                                widget: "#Switch",
                                label: "form.exactVehicleLabel",
                                description: "form.exactVehicleDescription",
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "pickupLocation",
                                widget: "#ApiSelect",
                                label: "form.pickupLocationLabel",
                                placeholder: "form.pickupLocationPlaceholder",
                                required: true,
                                widgetProps: {
                                    apiUrl: "/api/carRental/rentalLocation/select",
                                    pageSize: 50,
                                    normalizeEmptyToUndefined: true,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "returnLocation",
                                widget: "#ApiSelect",
                                label: "form.returnLocationLabel",
                                placeholder: "form.returnLocationPlaceholder",
                                required: true,
                                widgetProps: {
                                    apiUrl: "/api/carRental/rentalLocation/select",
                                    pageSize: 50,
                                    normalizeEmptyToUndefined: true,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "pickupDate",
                                widget: "#DateInput",
                                label: "form.pickupDateLabel",
                                required: true,
                                widgetProps: {valueFormat: "YYYY-MM-DD"},
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "pickupTime",
                                widget: "#DateInput",
                                label: "form.pickupTimeLabel",
                                required: true,
                                widgetProps: {
                                    valueFormat: "HH:mm",
                                    timeOnly: true,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "returnDate",
                                widget: "#DateInput",
                                label: "form.returnDateLabel",
                                required: true,
                                widgetProps: {valueFormat: "YYYY-MM-DD"},
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "returnTime",
                                widget: "#DateInput",
                                label: "form.returnTimeLabel",
                                required: true,
                                widgetProps: {
                                    valueFormat: "HH:mm",
                                    timeOnly: true,
                                },
                            },
                        },
                    ],
                },
                {render: "#FormAlert", props: {message: "form.localTimeHint"}},
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.contactSectionTitle"},
            children: [
                // An existing customer is picked before the contact is typed (UX-05).
                {
                    render: "#Field",
                    field: {
                        name: "customer",
                        widget: "#ApiSelect",
                        label: "form.customerLabel",
                        placeholder: "form.customerPlaceholder",
                        widgetProps: {
                            apiUrl: "/api/company/users/select",
                            pageSize: 50,
                            normalizeEmptyToUndefined: true,
                        },
                    },
                },
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#Field",
                            field: {
                                name: "contact.firstName",
                                widget: "#Input",
                                label: "form.firstNameLabel",
                                placeholder: "form.firstNamePlaceholder",
                                required: true,
                                widgetProps: {
                                    maxLength: RENTAL_CONTACT_NAME_MAX,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "contact.lastName",
                                widget: "#Input",
                                label: "form.lastNameLabel",
                                placeholder: "form.lastNamePlaceholder",
                                required: true,
                                widgetProps: {
                                    maxLength: RENTAL_CONTACT_NAME_MAX,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "contact.email",
                                widget: "#Input",
                                label: "form.emailLabel",
                                placeholder: "form.emailPlaceholder",
                                required: true,
                                widgetProps: {type: "email"},
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "contact.phone",
                                widget: "#Input",
                                label: "form.phoneLabel",
                                placeholder: "form.phonePlaceholder",
                                required: true,
                                widgetProps: {
                                    maxLength: RENTAL_CONTACT_PHONE_MAX,
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#Field",
            field: {
                name: "extras",
                widget: "#FormRepeater",
                widgetProps: {
                    title: "form.extrasSectionTitle",
                    arrayField: "extras",
                    defaultItem: {extra: "", quantity: 1},
                    addLabel: "form.extraAddRow",
                    removeLabel: "form.extraRemoveRow",
                    rowTitleFields: ["quantity"],
                    rowTitlePlaceholder: "form.extraRowTitle",
                    rowTemplate: [
                        {
                            render: "#FormGrid",
                            props: {columns: 2},
                            children: [
                                {
                                    render: "#Field",
                                    field: {
                                        name: "extra",
                                        widget: "#ApiSelect",
                                        label: "form.extraLabel",
                                        placeholder: "form.extraPlaceholder",
                                        required: true,
                                        widgetProps: {
                                            apiUrl: "/api/carRental/rentalExtra/select",
                                            pageSize: 50,
                                            normalizeEmptyToUndefined: true,
                                        },
                                    },
                                },
                                {
                                    render: "#Field",
                                    field: {
                                        name: "quantity",
                                        widget: "#Input",
                                        label: "form.quantityLabel",
                                        required: true,
                                        widgetProps: {
                                            type: "number",
                                            min: 1,
                                            max: 10,
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.optionsSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
        {
            render: "#Field",
            field: {
                name: "businessAccount",
                widget: "#ApiSelect",
                label: "form.businessAccountLabel",
                placeholder: "form.businessAccountPlaceholder",
                widgetProps: {
                    apiUrl: "/api/carRental/rentalBusinessAccount/select",
                    pageSize: 50,
                    normalizeEmptyToUndefined: true,
                },
            },
        },
        {
            render: "#Field",
            field: {
                name: "paymentChoice",
                widget: "#SimpleSelect",
                label: "form.paymentChoiceLabel",
                placeholder: "form.paymentChoicePlaceholder",
                widgetProps: {
                    options: [
                        {
                            value: "pay_at_pickup",
                            label: "form.paymentChoice.pay_at_pickup",
                        },
                        // Card payments are "Coming soon" (D190): shown, not selectable.
                        {
                            value: "online",
                            label: CARD_PAYMENTS_AVAILABLE ? "form.paymentChoice.online" : "form.paymentChoice.online_soon",
                            disabled: !CARD_PAYMENTS_AVAILABLE,
                        },
                        {
                            value: "on_account",
                            label: "form.paymentChoice.on_account",
                        },
                    ],
                    className: "grow w-full",
                },
            },
        },
        {
            render: "#Field",
            field: {
                name: "crossBorder",
                widget: "#Switch",
                label: "form.crossBorderLabel",
            },
        },
        {
            render: "#Field",
            field: {
                name: "promoCode",
                widget: "#Input",
                label: "form.promoCodeLabel",
                placeholder: "form.promoCodePlaceholder",
                widgetProps: {maxLength: RENTAL_PROMO_CODE_INPUT_MAX},
            },
        },
                    ],
                },
                {
                    render: "#Field",
                    field: {
                        name: "notes",
                        widget: "#Textarea",
                        label: "form.notesLabel",
                        placeholder: "form.notesPlaceholder",
                        widgetProps: {
                            rows: 4,
                            maxLength: RENTAL_NOTES_MAX,
                            className:
                                "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                        },
                    },
                },
            ],
        },
    ],
};

export const rentalReservationViews: ViewConfig[] = [
    rentalReservationSheetView,
    rentalReservationCreateFormView,
];
