import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_DAMAGE_AREAS,
    VEHICLE_DAMAGE_CLAIM_NUMBER_MAX,
    VEHICLE_DAMAGE_PHOTOS_MAX,
    VEHICLE_DAMAGE_SEVERITIES,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleDamage";

export const vehicleDamageSheetView: ViewConfig = {
    model: "vehicledamages",
    viewType: "sheet",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    header: {
        titleField: "vehicle.plate",
        subtitleKey: "vehicleDamageSubtitle",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {read: "photos"},
                            field: {
                                name: "photos",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "photos",
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
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
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
                            dependent: "reservation.number",
                            permissions: {read: "reservation"},
                            field: {
                                name: "reservation.number",
                                widget: "#DisplayCard",
                                label: "reservation",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    linkedRefPath: "reservation",
                                    linkedSheetModel: "rentalreservations",
                                    linkedSheetWidget:
                                        "#RentalReservationSheetView",
                                    linkedSheetEntityProp: "rentalReservation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "reportedAt"},
                            field: {
                                name: "reportedAt",
                                widget: "#DisplayCard",
                                label: "reportedAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "area"},
                            field: {
                                name: "area",
                                widget: "#DisplayCard",
                                label: "area",
                                widgetProps: {
                                    icon: "#IconCarCrash",
                                    type: "enum",
                                    languageKeyCategory: "areaValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "severity"},
                            field: {
                                name: "severity",
                                widget: "#DisplayCard",
                                label: "severity",
                                widgetProps: {
                                    icon: "#IconAlertTriangle",
                                    type: "enum",
                                    languageKeyCategory: "severityValues",
                                },
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
                            permissions: {read: "description"},
                            field: {
                                name: "description",
                                widget: "#DisplayCard",
                                label: "description",
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
            dependentAny: ["estimatedCost", "repair.status", "repair.cost", "repairedAt"],
            props: {title: "repairGroup"},
            permissions: {readAny: ["estimatedCost", "repair", "repairedAt"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "estimatedCost",
                            permissions: {read: "estimatedCost"},
                            field: {
                                name: "estimatedCost",
                                widget: "#DisplayCard",
                                label: "estimatedCost",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "estimatedCost"],
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
                            dependent: "repair.status",
                            permissions: {read: "repair"},
                            field: {
                                name: "repair.status",
                                widget: "#DisplayCard",
                                label: "repair",
                                widgetProps: {
                                    icon: "#IconTool",
                                    type: "enum",
                                    languageKeyCategory: "repairStatusValues",
                                    linkedRefPath: "repair",
                                    linkedSheetModel: "vehiclemaintenances",
                                    linkedSheetWidget:
                                        "#VehicleMaintenanceSheetView",
                                    linkedSheetEntityProp: "vehicleMaintenance",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "repair.cost",
                            permissions: {read: "repair"},
                            field: {
                                name: "repair.cost",
                                widget: "#DisplayCard",
                                label: "repairCost",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "repair.cost"],
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
                            dependent: "repairedAt",
                            permissions: {read: "repairedAt"},
                            field: {
                                name: "repairedAt",
                                widget: "#DisplayCard",
                                label: "repairedAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    type: "date",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            dependentAny: ["chargedAmount", "chargedAt", "insurance.policyNumber", "claimNumber", "insurerPaidAmount"],
            props: {title: "recoveryGroup"},
            permissions: {
                readAny: [
                    "chargedAmount",
                    "chargedAt",
                    "insurance",
                    "claimNumber",
                    "insurerPaidAmount",
                ],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "chargedAmount",
                            permissions: {read: "chargedAmount"},
                            field: {
                                name: "chargedAmount",
                                widget: "#DisplayCard",
                                label: "chargedAmount",
                                widgetProps: {
                                    icon: "#IconReceipt",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "chargedAmount"],
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
                            dependent: "chargedAt",
                            permissions: {read: "chargedAt"},
                            field: {
                                name: "chargedAt",
                                widget: "#DisplayCard",
                                label: "chargedAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "insurance.policyNumber",
                            permissions: {read: "insurance"},
                            field: {
                                name: "insurance.policyNumber",
                                widget: "#DisplayCard",
                                label: "insurance",
                                widgetProps: {
                                    icon: "#IconShieldCheck",
                                    linkedRefPath: "insurance",
                                    linkedSheetModel: "vehicleinsurances",
                                    linkedSheetWidget:
                                        "#VehicleInsuranceSheetView",
                                    linkedSheetEntityProp: "vehicleInsurance",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "claimNumber",
                            permissions: {read: "claimNumber"},
                            field: {
                                name: "claimNumber",
                                widget: "#DisplayCard",
                                label: "claimNumber",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "insurerPaidAmount",
                            permissions: {read: "insurerPaidAmount"},
                            field: {
                                name: "insurerPaidAmount",
                                widget: "#DisplayCard",
                                label: "insurerPaidAmount",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "insurerPaidAmount"],
                                    joinSeparator: " ",
                                    type: "currency",
                                    linkedRefPath: "currency",
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
        lifecycleSheetGroup,
    ],
};

const areaOptions = VEHICLE_DAMAGE_AREAS.map((value) => ({
    value,
    label: `form.area.${value}`,
}));
const severityOptions = VEHICLE_DAMAGE_SEVERITIES.map((value) => ({
    value,
    label: `form.severity.${value}`,
}));

const vehicleDamageCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.identificationSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "vehicle",
                            widget: "#ApiSelect",
                            label: "form.vehicleLabel",
                            placeholder: "form.vehiclePlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicle/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBody: {includeInactive: true},
                                defaultOptionsFormExtraKey:
                                    "vehicleDefaultOptions",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reservation",
                            widget: "#ApiSelect",
                            label: "form.reservationLabel",
                            placeholder: "form.reservationPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalReservation/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormFields: [
                                    {field: "vehicle", paramName: "vehicle"},
                                ],
                                enableWhenFormFieldsNonEmpty: ["vehicle"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "reportedAt",
                            widget: "#DateInput",
                            label: "form.reportedAtLabel",
                            placeholder: "form.reportedAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.classificationSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "area",
                            widget: "#SimpleSelect",
                            label: "form.areaLabel",
                            placeholder: "form.areaPlaceholder",
                            required: true,
                            widgetProps: {
                                options: areaOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "severity",
                            widget: "#SimpleSelect",
                            label: "form.severityLabel",
                            placeholder: "form.severityPlaceholder",
                            required: true,
                            widgetProps: {
                                options: severityOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "estimatedCost",
                            widget: "#Input",
                            label: "form.estimatedCostLabel",
                            placeholder: "form.estimatedCostPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.detailsSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    required: true,
                    widgetProps: {
                        rows: 4,
                        maxLength: VEHICLE_RECORD_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name: "photos",
                    widget: "#MediaField",
                    label: "form.photosLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_DAMAGE_PHOTOS_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.claimSectionTitle", defaultOpen: false},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "insurance",
                            widget: "#ApiSelect",
                            label: "form.insuranceLabel",
                            placeholder: "form.insurancePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicleInsurance/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormFields: [
                                    {field: "vehicle", paramName: "vehicle"},
                                ],
                                enableWhenFormFieldsNonEmpty: ["vehicle"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "claimNumber",
                            widget: "#Input",
                            label: "form.claimNumberLabel",
                            placeholder: "form.claimNumberPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DAMAGE_CLAIM_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "insurerPaidAmount",
                            widget: "#Input",
                            label: "form.insurerPaidAmountLabel",
                            placeholder: "form.insurerPaidAmountPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                ],
            },
        ],
    },
];

const vehicleDamageEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.identificationSectionTitle"},
        permissions: {
            readAny: ["vehicle", "reservation", "reportedAt"],
            writeAny: ["vehicle", "reservation", "reportedAt"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "vehicle", write: "vehicle"},
                        field: {
                            name: "vehicle",
                            widget: "#ApiSelect",
                            label: "form.vehicleLabel",
                            placeholder: "form.vehiclePlaceholder",
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicle/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBody: {includeInactive: true},
                                defaultOptionsFormExtraKey:
                                    "vehicleDefaultOptions",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "reservation",
                            write: "reservation",
                        },
                        field: {
                            name: "reservation",
                            widget: "#ApiSelect",
                            label: "form.reservationLabel",
                            placeholder: "form.reservationPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalReservation/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormFields: [
                                    {field: "vehicle", paramName: "vehicle"},
                                ],
                                enableWhenFormFieldsNonEmpty: ["vehicle"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "reportedAt", write: "reportedAt"},
                        field: {
                            name: "reportedAt",
                            widget: "#DateInput",
                            label: "form.reportedAtLabel",
                            placeholder: "form.reportedAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.classificationSectionTitle"},
        permissions: {
            readAny: ["area", "severity", "estimatedCost"],
            writeAny: ["area", "severity", "estimatedCost"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "area", write: "area"},
                        field: {
                            name: "area",
                            widget: "#SimpleSelect",
                            label: "form.areaLabel",
                            placeholder: "form.areaPlaceholder",
                            required: true,
                            widgetProps: {
                                options: areaOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "severity", write: "severity"},
                        field: {
                            name: "severity",
                            widget: "#SimpleSelect",
                            label: "form.severityLabel",
                            placeholder: "form.severityPlaceholder",
                            required: true,
                            widgetProps: {
                                options: severityOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "estimatedCost",
                            write: "estimatedCost",
                        },
                        field: {
                            name: "estimatedCost",
                            widget: "#Input",
                            label: "form.estimatedCostLabel",
                            placeholder: "form.estimatedCostPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.detailsSectionTitle"},
        permissions: {
            readAny: ["description", "photos"],
            writeAny: ["description", "photos"],
        },
        children: [
            {
                render: "#Field",
                permissions: {read: "description", write: "description"},
                field: {
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
                    required: true,
                    widgetProps: {
                        rows: 4,
                        maxLength: VEHICLE_RECORD_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "photos", write: "photos"},
                field: {
                    name: "photos",
                    widget: "#MediaField",
                    label: "form.photosLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_DAMAGE_PHOTOS_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.claimSectionTitle"},
        permissions: {
            readAny: ["insurance", "claimNumber", "insurerPaidAmount"],
            writeAny: ["insurance", "claimNumber", "insurerPaidAmount"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "insurance", write: "insurance"},
                        field: {
                            name: "insurance",
                            widget: "#ApiSelect",
                            label: "form.insuranceLabel",
                            placeholder: "form.insurancePlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicleInsurance/select",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                                postBodyFromFormFields: [
                                    {field: "vehicle", paramName: "vehicle"},
                                ],
                                enableWhenFormFieldsNonEmpty: ["vehicle"],
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "claimNumber",
                            write: "claimNumber",
                        },
                        field: {
                            name: "claimNumber",
                            widget: "#Input",
                            label: "form.claimNumberLabel",
                            placeholder: "form.claimNumberPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DAMAGE_CLAIM_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "insurerPaidAmount",
                            write: "insurerPaidAmount",
                        },
                        field: {
                            name: "insurerPaidAmount",
                            widget: "#Input",
                            label: "form.insurerPaidAmountLabel",
                            placeholder: "form.insurerPaidAmountPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                ],
            },
        ],
    },
];

export const vehicleDamageCreateFormView: ViewConfig = {
    model: "vehicledamages",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleDamageCreateFormNodes,
};

export const vehicleDamageEditFormView: ViewConfig = {
    model: "vehicledamages",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleDamageEditFormNodes,
};

export const vehicleDamageViews: ViewConfig[] = [
    vehicleDamageSheetView,
    vehicleDamageCreateFormView,
    vehicleDamageEditFormView,
];
