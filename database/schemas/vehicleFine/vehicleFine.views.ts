import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_FINE_AUTHORITY_MAX,
    VEHICLE_FINE_NOTES_MAX,
    VEHICLE_FINE_PLACE_MAX,
    VEHICLE_FINE_REFERENCE_MAX,
    VEHICLE_FINE_TYPES,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleFine/vehicleFine.schema-def";
import {VEHICLE_RECORD_ATTACHMENTS_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleFine";

const typeOptions = VEHICLE_FINE_TYPES.map((value) => ({
    value,
    label: `form.type.${value}`,
}));

export const vehicleFineSheetView: ViewConfig = {
    model: "vehiclefines",
    viewType: "sheet",
    accessModel: "vehiclefines",
    apiUrl: API_URL,
    header: {
        titleField: "reference",
        subtitleKey: "vehicleFineSubtitle",
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
                            permissions: {read: "reference"},
                            field: {
                                name: "reference",
                                widget: "#DisplayCard",
                                label: "reference",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
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
                            permissions: {read: "offenceAt"},
                            field: {
                                name: "offenceAt",
                                widget: "#DisplayCard",
                                label: "offenceAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "type"},
                            field: {
                                name: "type",
                                widget: "#DisplayCard",
                                label: "type",
                                widgetProps: {
                                    icon: "#IconAlertTriangle",
                                    type: "enum",
                                    languageKeyCategory: "typeValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "place"},
                            field: {
                                name: "place",
                                widget: "#DisplayCard",
                                label: "place",
                                widgetProps: {icon: "#IconMapPin"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "status"},
                            field: {
                                name: "status",
                                widget: "#DisplayCard",
                                label: "status",
                                widgetProps: {
                                    icon: "#IconStatusChange",
                                    type: "enum",
                                    languageKeyCategory: "statusValues",
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
            props: {title: "authorityGroup"},
            permissions: {readAny: ["authority", "amount", "dueDate"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "authority"},
                            field: {
                                name: "authority",
                                widget: "#DisplayCard",
                                label: "authority",
                                widgetProps: {icon: "#IconBuildingBank"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "amount"},
                            field: {
                                name: "amount",
                                widget: "#DisplayCard",
                                label: "amount",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "amount"],
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
                            permissions: {read: "dueDate"},
                            field: {
                                name: "dueDate",
                                widget: "#DisplayCard",
                                label: "dueDate",
                                widgetProps: {
                                    icon: "#IconCalendarDue",
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
            props: {title: "driverGroup"},
            permissions: {
                readAny: [
                    "reservation",
                    "transfer",
                    "driverName",
                    "chargedAmount",
                ],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "driverName"},
                            field: {
                                name: "driverName",
                                widget: "#DisplayCard",
                                label: "driverName",
                                widgetProps: {icon: "#IconUser"},
                            },
                        },
                        {
                            render: "#DisplayCard",
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
                            permissions: {read: "transfer"},
                            field: {
                                name: "transfer.status",
                                widget: "#DisplayCard",
                                label: "transfer",
                                widgetProps: {
                                    icon: "#IconRoute",
                                    type: "enum",
                                    languageKeyCategory: "transferStatusValues",
                                    linkedRefPath: "transfer",
                                    linkedSheetModel: "vehicletransfers",
                                    linkedSheetWidget:
                                        "#VehicleTransferSheetView",
                                    linkedSheetEntityProp: "vehicleTransfer",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
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
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "paymentGroup"},
            permissions: {
                readAny: ["paidAt", "paidAmount", "paymentReference"],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paidAt"},
                            field: {
                                name: "paidAt",
                                widget: "#DisplayCard",
                                label: "paidAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paidAmount"},
                            field: {
                                name: "paidAmount",
                                widget: "#DisplayCard",
                                label: "paidAmount",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "paidAmount"],
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
                            permissions: {read: "paymentReference"},
                            field: {
                                name: "paymentReference",
                                widget: "#DisplayCard",
                                label: "paymentReference",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "attachments", defaultOpen: true},
            dependent: "attachments",
            children: [
                {
                    render: "#SheetMediaFilesStrip",
                    permissions: {read: "attachments"},
                    field: {
                        name: "attachments",
                        widget: "#SheetMediaFilesStrip",
                        widgetProps: {canDownload: true, canRemove: false},
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const vehicleFineCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.offenceSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "reference",
                            widget: "#Input",
                            label: "form.referenceLabel",
                            placeholder: "form.referencePlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: VEHICLE_FINE_REFERENCE_MAX,
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
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicle/select",
                                method: "POST",
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
                            name: "offenceAt",
                            widget: "#DateInput",
                            label: "form.offenceAtLabel",
                            placeholder: "form.offenceAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "type",
                            widget: "#SimpleSelect",
                            label: "form.typeLabel",
                            placeholder: "form.typePlaceholder",
                            required: true,
                            widgetProps: {
                                options: typeOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "place",
                            widget: "#Input",
                            label: "form.placeLabel",
                            placeholder: "form.placePlaceholder",
                            widgetProps: {maxLength: VEHICLE_FINE_PLACE_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.authoritySectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "authority",
                            widget: "#Input",
                            label: "form.authorityLabel",
                            placeholder: "form.authorityPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: VEHICLE_FINE_AUTHORITY_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "amount",
                            widget: "#Input",
                            label: "form.amountLabel",
                            placeholder: "form.amountPlaceholder",
                            description: "form.amountCurrencyDescription",
                            required: true,
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "dueDate",
                            widget: "#DateInput",
                            label: "form.dueDateLabel",
                            placeholder: "form.dueDatePlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.notesSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {rows: 3, maxLength: VEHICLE_FINE_NOTES_MAX},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "attachments",
                    widget: "#MediaField",
                    label: "form.attachmentsLabel",
                    widgetProps: {
                        mediaType: "file",
                        mode: "multiple",
                        maxCount: VEHICLE_RECORD_ATTACHMENTS_MAX,
                        accept: "application/pdf,image/*",
                    },
                },
            },
        ],
    },
];

const vehicleFineEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.offenceSectionTitle"},
        permissions: {
            readAny: ["reference", "vehicle", "offenceAt", "type", "place"],
            writeAny: ["reference", "vehicle", "offenceAt", "type", "place"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "reference", write: "reference"},
                        field: {
                            name: "reference",
                            widget: "#Input",
                            label: "form.referenceLabel",
                            placeholder: "form.referencePlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: VEHICLE_FINE_REFERENCE_MAX,
                            },
                        },
                    },
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
                                method: "POST",
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
                        permissions: {read: "offenceAt", write: "offenceAt"},
                        field: {
                            name: "offenceAt",
                            widget: "#DateInput",
                            label: "form.offenceAtLabel",
                            placeholder: "form.offenceAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "type", write: "type"},
                        field: {
                            name: "type",
                            widget: "#SimpleSelect",
                            label: "form.typeLabel",
                            placeholder: "form.typePlaceholder",
                            required: true,
                            widgetProps: {
                                options: typeOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "place", write: "place"},
                        field: {
                            name: "place",
                            widget: "#Input",
                            label: "form.placeLabel",
                            placeholder: "form.placePlaceholder",
                            widgetProps: {maxLength: VEHICLE_FINE_PLACE_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.authoritySectionTitle"},
        permissions: {
            readAny: ["authority", "amount", "dueDate"],
            writeAny: ["authority", "amount", "dueDate"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "authority", write: "authority"},
                        field: {
                            name: "authority",
                            widget: "#Input",
                            label: "form.authorityLabel",
                            placeholder: "form.authorityPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: VEHICLE_FINE_AUTHORITY_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "amount", write: "amount"},
                        field: {
                            name: "amount",
                            widget: "#Input",
                            label: "form.amountLabel",
                            placeholder: "form.amountPlaceholder",
                            description: "form.amountCurrencyDescription",
                            required: true,
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "dueDate", write: "dueDate"},
                        field: {
                            name: "dueDate",
                            widget: "#DateInput",
                            label: "form.dueDateLabel",
                            placeholder: "form.dueDatePlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.notesSectionTitle"},
        permissions: {
            readAny: ["notes", "attachments"],
            writeAny: ["notes", "attachments"],
        },
        children: [
            {
                render: "#Field",
                permissions: {read: "notes", write: "notes"},
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {rows: 3, maxLength: VEHICLE_FINE_NOTES_MAX},
                },
            },
            {
                render: "#Field",
                permissions: {read: "attachments", write: "attachments"},
                field: {
                    name: "attachments",
                    widget: "#MediaField",
                    label: "form.attachmentsLabel",
                    widgetProps: {
                        mediaType: "file",
                        mode: "multiple",
                        maxCount: VEHICLE_RECORD_ATTACHMENTS_MAX,
                        accept: "application/pdf,image/*",
                    },
                },
            },
        ],
    },
];

export const vehicleFineCreateFormView: ViewConfig = {
    model: "vehiclefines",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehiclefines",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleFineCreateFormNodes,
};

export const vehicleFineEditFormView: ViewConfig = {
    model: "vehiclefines",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehiclefines",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleFineEditFormNodes,
};

export const vehicleFineViews: ViewConfig[] = [
    vehicleFineSheetView,
    vehicleFineCreateFormView,
    vehicleFineEditFormView,
];
