import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_COLOR_MAX,
    VEHICLE_IMAGES_MAX,
    VEHICLE_MAKE_MAX,
    VEHICLE_MODEL_MAX,
    VEHICLE_NOTES_MAX,
    VEHICLE_PLATE_MAX,
    VEHICLE_VIDEOS_MAX,
    VEHICLE_VIN_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

export const vehicleSheetView: ViewConfig = {
    model: "vehicles",
    viewType: "sheet",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    header: {
        titleField: "plate",
        subtitleKey: "vehicleSubtitle",
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
                            permissions: {read: "plate"},
                            field: {
                                name: "plate",
                                widget: "#DisplayCard",
                                label: "plate",
                                widgetProps: {icon: "#IconLicense"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "make"},
                            field: {
                                name: "make",
                                widget: "#DisplayCard",
                                label: "make",
                                widgetProps: {icon: "#IconCar"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "model"},
                            field: {
                                name: "model",
                                widget: "#DisplayCard",
                                label: "model",
                                widgetProps: {icon: "#IconCar"},
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
                            render: "#DisplayCard",
                            permissions: {read: "homeLocation"},
                            field: {
                                name: "homeLocation.name",
                                widget: "#DisplayCard",
                                label: "homeLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "homeLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "currentLocation.name",
                            permissions: {read: "currentLocation"},
                            field: {
                                name: "currentLocation.name",
                                widget: "#DisplayCard",
                                label: "currentLocation",
                                widgetProps: {
                                    icon: "#IconMapPinFilled",
                                    linkedRefPath: "currentLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "readiness"},
                            field: {
                                name: "readiness",
                                widget: "#DisplayCard",
                                label: "readiness",
                                widgetProps: {
                                    icon: "#IconSparkles",
                                    type: "enum",
                                    languageKeyCategory: "readinessValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "year",
                            permissions: {read: "year"},
                            field: {
                                name: "year",
                                widget: "#DisplayCard",
                                label: "year",
                                // A model year, not a quantity: read through `valuePath` it is shown as written ("2022"),
                                // not with a thousands separator.
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    valuePath: ["year"],
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "color",
                            permissions: {read: "color"},
                            field: {
                                name: "color",
                                widget: "#DisplayCard",
                                label: "color",
                                widgetProps: {icon: "#IconPalette"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "odometerKm",
                            permissions: {read: "odometerKm"},
                            field: {
                                name: "odometerKm",
                                widget: "#DisplayCard",
                                label: "odometerKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "vin",
                            permissions: {read: "vin"},
                            field: {
                                name: "vin",
                                widget: "#DisplayCard",
                                label: "vin",
                                widgetProps: {icon: "#Hash"},
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
            dependentAny: ["nextServiceDueAt", "nextServiceDueKm", "acquiredAt", "purchasePrice", "lastReportedAt"],
            permissions: {
                readAny: [
                    "nextServiceDueAt",
                    "nextServiceDueKm",
                    "acquiredAt",
                    "purchasePrice",
                ],
            },
            props: {title: "fleet"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "nextServiceDueAt",
                            permissions: {read: "nextServiceDueAt"},
                            field: {
                                name: "nextServiceDueAt",
                                widget: "#DisplayCard",
                                label: "nextServiceDueAt",
                                widgetProps: {
                                    icon: "#IconTool",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "nextServiceDueKm",
                            permissions: {read: "nextServiceDueKm"},
                            field: {
                                name: "nextServiceDueKm",
                                widget: "#DisplayCard",
                                label: "nextServiceDueKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "acquiredAt",
                            permissions: {read: "acquiredAt"},
                            field: {
                                name: "acquiredAt",
                                widget: "#DisplayCard",
                                label: "acquiredAt",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "purchasePrice",
                            permissions: {read: "purchasePrice"},
                            field: {
                                name: "purchasePrice",
                                widget: "#DisplayCard",
                                label: "purchasePrice",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "purchasePrice"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "currency",
                                    linkedSheetModel: "currencies",
                                    linkedSheetWidget: "#CurrencySheetView",
                                    linkedSheetEntityProp: "currency",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "lastReportedAt",
                            permissions: {read: "lastReportedAt"},
                            field: {
                                name: "lastReportedAt",
                                widget: "#DisplayCard",
                                label: "lastReportedAt",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "dateTime",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "images"},
            permissions: {readAny: ["images", "videos"]},
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {readAny: ["images", "videos"]},
                            field: {
                                name: "images",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "images",
                                    videoGalleryField: "videos",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: false,
                                    showPreviews: true,
                                    previewLocation: "right",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.reservations.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "reservations",
                    dependentRuntimeOnly: true,
                    props: {title: "reservationsGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "reservations",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#RentalReservationCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconCalendarEvent",
                                                label: "reservationsGroup",
                                                // Who rented it, from when, how it stands and what it cost; the booking number stays on the opened sheet.
                                                labelPath: ["contact.firstName", "contact.lastName"],
                                                labelJoinSeparator: " ",
                                                valuePath: ["pickupAt", "status", "pricing.grandTotal"],
                                                valueLanguageKeyCategories: [null, "reservationStatus", null],
                                                valueFormats: ["dateTime", null, {money: "pricing.currency"}],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "rentalreservations",
                                                linkedSheetWidget: "#RentalReservationSheetView",
                                                linkedSheetEntityProp: "rentalReservation",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.damages.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "damages",
                    dependentRuntimeOnly: true,
                    props: {title: "damagesGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "damages",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleDamageCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconCarCrash",
                                                label: "damagesGroup",
                                                // When it was found, where, how bad, and whether it is repaired.
                                                labelPath: "reportedAt",
                                                labelFormat: "date",
                                                valuePath: ["area", "severity", "status"],
                                                valueLanguageKeyCategories: ["areaValues", "severityValues", "damageStatus"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehicledamages",
                                                linkedSheetWidget: "#VehicleDamageSheetView",
                                                linkedSheetEntityProp: "vehicleDamage",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.maintenance.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "maintenance",
                    dependentRuntimeOnly: true,
                    props: {title: "maintenanceGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "maintenance",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleMaintenanceCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconTool",
                                                label: "maintenanceGroup",
                                                // When, what kind of service, where, and what it cost.
                                                labelPath: "serviceDate",
                                                labelFormat: "date",
                                                valuePath: ["type", "provider", "cost"],
                                                valueLanguageKeyCategories: ["maintenanceType", null, null],
                                                valueFormats: [null, null, {money: "currency"}],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehiclemaintenances",
                                                linkedSheetWidget: "#VehicleMaintenanceSheetView",
                                                linkedSheetEntityProp: "vehicleMaintenance",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.documents.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "documents",
                    dependentRuntimeOnly: true,
                    props: {title: "documentsGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "documents",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleDocumentCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconFileText",
                                                label: "documentsGroup",
                                                // Until when each paper is valid, which paper, and whether it still is.
                                                labelPath: "expiresAt",
                                                labelFormat: "date",
                                                valuePath: ["type", "status"],
                                                valueLanguageKeyCategories: ["documentType", "documentStatus"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehicledocuments",
                                                linkedSheetWidget: "#VehicleDocumentSheetView",
                                                linkedSheetEntityProp: "vehicleDocument",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.insurances.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "insurances",
                    dependentRuntimeOnly: true,
                    props: {title: "insurancesGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "insurances",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleInsuranceCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconShieldCheck",
                                                label: "insurancesGroup",
                                                // Until when the car is covered, by whom, how, and whether the policy is current.
                                                labelPath: "expiresAt",
                                                labelFormat: "date",
                                                valuePath: ["insurer", "coverage", "status"],
                                                valueLanguageKeyCategories: [null, "coverage", "insuranceStatus"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehicleinsurances",
                                                linkedSheetWidget: "#VehicleInsuranceSheetView",
                                                linkedSheetEntityProp: "vehicleInsurance",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.fines.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "fines",
                    dependentRuntimeOnly: true,
                    props: {title: "finesGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "fines",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleFineCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconReceipt",
                                                label: "finesGroup",
                                                // When the offence happened, what it was, the amount, and how it stands.
                                                labelPath: "offenceAt",
                                                labelFormat: "dateTime",
                                                valuePath: ["type", "amount", "status"],
                                                valueLanguageKeyCategories: ["fineType", null, "fineStatus"],
                                                valueFormats: [null, {money: "currency"}, null],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehiclefines",
                                                linkedSheetWidget: "#VehicleFineSheetView",
                                                linkedSheetEntityProp: "vehicleFine",
                                            },
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
            // Cards or one line each, the reader's choice (remembered per list).
            render: "#ReferencesViewModeScope",
            props: {storageKey: "carRental.vehicle.sheet.blocks.listDisplay", defaultMode: "compact"},
            children: [
                {
                    // Read with the caller's own grants on that model; absent when they may not read it (vehicleHub).
                    render: "#SheetGroup",
                    dependent: "blocks",
                    dependentRuntimeOnly: true,
                    props: {title: "blocksGroup", titleActions: "#ReferencesViewModeToggle", defaultOpen: false},
                    children: [
                        {
                            render: "div",
                            props: {className: "rounded-lg bg-muted/30 border border-border/50"},
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    field: {
                                        name: "blocks",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleBlockCard",
                                            pageSize: 4,
                                            columns: 2,
                                            compactRow: {
                                                icon: "#IconBan",
                                                label: "blocksGroup",
                                                // When the car is off the road and why.
                                                labelPath: ["startAt", "endAt"],
                                                labelFormat: "dateTime",
                                                valuePath: ["reason", "note"],
                                                valueLanguageKeyCategories: ["blockReason", null],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehicleblocks",
                                                linkedSheetWidget: "#VehicleBlockSheetView",
                                                linkedSheetEntityProp: "vehicleBlock",
                                            },
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

const statusOptions = ["active", "maintenance", "retired"].map((value) => ({
    value,
    label: `form.status.${value}`,
}));

const vehicleCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.vehicleSectionTitle"},
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
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "plate",
                            widget: "#Input",
                            label: "form.plateLabel",
                            placeholder: "form.platePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_PLATE_MAX},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "make",
                            widget: "#Input",
                            label: "form.makeLabel",
                            placeholder: "form.makePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MAKE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "model",
                            widget: "#Input",
                            label: "form.modelLabel",
                            placeholder: "form.modelPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MODEL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "year",
                            widget: "#Input",
                            label: "form.yearLabel",
                            placeholder: "form.yearPlaceholder",
                            widgetProps: {type: "number", min: 1950, max: 2100},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "color",
                            widget: "#Input",
                            label: "form.colorLabel",
                            placeholder: "form.colorPlaceholder",
                            widgetProps: {maxLength: VEHICLE_COLOR_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vin",
                            widget: "#Input",
                            label: "form.vinLabel",
                            placeholder: "form.vinPlaceholder",
                            widgetProps: {maxLength: VEHICLE_VIN_MAX},
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
                        maxLength: VEHICLE_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.fleetSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "homeLocation",
                            widget: "#ApiSelect",
                            label: "form.homeLocationLabel",
                            placeholder: "form.homeLocationPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalLocation/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            required: true,
                            widgetProps: {
                                options: statusOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "odometerKm",
                            widget: "#Input",
                            label: "form.odometerKmLabel",
                            placeholder: "form.odometerKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "acquiredAt",
                            widget: "#DateInput",
                            label: "form.acquiredAtLabel",
                            placeholder: "form.acquiredAtPlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "purchasePrice",
                            widget: "#Input",
                            label: "form.purchasePriceLabel",
                            placeholder: "form.purchasePricePlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "trackerId",
                            widget: "#Input",
                            label: "form.trackerIdLabel",
                            placeholder: "form.trackerIdPlaceholder",
                            widgetProps: {maxLength: 64},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.photosSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "images",
                    widget: "#MediaField",
                    label: "form.imagesLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_IMAGES_MAX,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name: "videos",
                    widget: "#MediaField",
                    label: "form.videosLabel",
                    widgetProps: {
                        mediaType: "video",
                        mode: "multiple",
                        maxCount: VEHICLE_VIDEOS_MAX,
                    },
                },
            },
        ],
    },
];

const vehicleEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.vehicleSectionTitle"},
        permissions: {readAny: ["category", "plate", "make", "model", "year", "color", "vin", "notes"], writeAny: ["category", "plate", "make", "model", "year", "color", "vin", "notes"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "category", write: "category"},
                        field: {
                            name: "category",
                            widget: "#ApiSelect",
                            label: "form.categoryLabel",
                            placeholder: "form.categoryPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicleCategory/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "plate", write: "plate"},
                        field: {
                            name: "plate",
                            widget: "#Input",
                            label: "form.plateLabel",
                            placeholder: "form.platePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_PLATE_MAX},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "make", write: "make"},
                        field: {
                            name: "make",
                            widget: "#Input",
                            label: "form.makeLabel",
                            placeholder: "form.makePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MAKE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "model", write: "model"},
                        field: {
                            name: "model",
                            widget: "#Input",
                            label: "form.modelLabel",
                            placeholder: "form.modelPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MODEL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "year", write: "year"},
                        field: {
                            name: "year",
                            widget: "#Input",
                            label: "form.yearLabel",
                            placeholder: "form.yearPlaceholder",
                            widgetProps: {type: "number", min: 1950, max: 2100},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "color", write: "color"},
                        field: {
                            name: "color",
                            widget: "#Input",
                            label: "form.colorLabel",
                            placeholder: "form.colorPlaceholder",
                            widgetProps: {maxLength: VEHICLE_COLOR_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "vin", write: "vin"},
                        field: {
                            name: "vin",
                            widget: "#Input",
                            label: "form.vinLabel",
                            placeholder: "form.vinPlaceholder",
                            widgetProps: {maxLength: VEHICLE_VIN_MAX},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                permissions: {read: "notes", write: "notes"},
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {
                        rows: 4,
                        maxLength: VEHICLE_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.fleetSectionTitle"},
        permissions: {readAny: ["homeLocation", "status", "odometerKm", "acquiredAt", "purchasePrice", "trackerId"], writeAny: ["homeLocation", "status", "odometerKm", "acquiredAt", "purchasePrice", "trackerId"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {
                            read: "homeLocation",
                            write: "homeLocation",
                        },
                        field: {
                            name: "homeLocation",
                            widget: "#ApiSelect",
                            label: "form.homeLocationLabel",
                            placeholder: "form.homeLocationPlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalLocation/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "status", write: "status"},
                        field: {
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            required: true,
                            widgetProps: {
                                options: statusOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "odometerKm", write: "odometerKm"},
                        field: {
                            name: "odometerKm",
                            widget: "#Input",
                            label: "form.odometerKmLabel",
                            placeholder: "form.odometerKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
                        },
                    },
                ],
            },
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "acquiredAt", write: "acquiredAt"},
                        field: {
                            name: "acquiredAt",
                            widget: "#DateInput",
                            label: "form.acquiredAtLabel",
                            placeholder: "form.acquiredAtPlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "purchasePrice",
                            write: "purchasePrice",
                        },
                        field: {
                            name: "purchasePrice",
                            widget: "#Input",
                            label: "form.purchasePriceLabel",
                            placeholder: "form.purchasePricePlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "trackerId", write: "trackerId"},
                        field: {
                            name: "trackerId",
                            widget: "#Input",
                            label: "form.trackerIdLabel",
                            placeholder: "form.trackerIdPlaceholder",
                            widgetProps: {maxLength: 64},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.photosSectionTitle"},
        permissions: {readAny: ["images", "videos"], writeAny: ["images", "videos"]},
        children: [
            {
                render: "#Field",
                permissions: {read: "images", write: "images"},
                field: {
                    name: "images",
                    widget: "#MediaField",
                    label: "form.imagesLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_IMAGES_MAX,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "videos", write: "videos"},
                field: {
                    name: "videos",
                    widget: "#MediaField",
                    label: "form.videosLabel",
                    widgetProps: {
                        mediaType: "video",
                        mode: "multiple",
                        maxCount: VEHICLE_VIDEOS_MAX,
                    },
                },
            },
        ],
    },
];

export const vehicleCreateFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    method: "PUT",
    nodes: vehicleCreateFormNodes,
};

export const vehicleEditFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    method: "PATCH",
    nodes: vehicleEditFormNodes,
};

export const vehicleViews: ViewConfig[] = [
    vehicleSheetView,
    vehicleCreateFormView,
    vehicleEditFormView,
];
