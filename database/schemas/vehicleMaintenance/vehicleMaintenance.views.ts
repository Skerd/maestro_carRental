import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_MAINTENANCE_PROVIDER_MAX,
    VEHICLE_MAINTENANCE_STATUSES,
    VEHICLE_MAINTENANCE_TYPES,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleMaintenance/vehicleMaintenance.schema-def";
import {
    VEHICLE_RECORD_ATTACHMENTS_MAX,
    VEHICLE_RECORD_NOTES_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleMaintenance";

export const vehicleMaintenanceSheetView: ViewConfig = {
    model: "vehiclemaintenances",
    viewType: "sheet",
    accessModel: "vehiclemaintenances",
    apiUrl: API_URL,
    header: {
        titleField: "vehicle.plate",
        subtitleKey: "vehicleMaintenanceSubtitle",
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
                            permissions: {read: "type"},
                            field: {
                                name: "type",
                                widget: "#DisplayCard",
                                label: "type",
                                widgetProps: {
                                    icon: "#IconTool",
                                    type: "enum",
                                    languageKeyCategory: "typeValues",
                                },
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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "provider"},
                            field: {
                                name: "provider",
                                widget: "#DisplayCard",
                                label: "provider",
                                widgetProps: {icon: "#IconBuildingWarehouse"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "serviceDate"},
                            field: {
                                name: "serviceDate",
                                widget: "#DisplayCard",
                                label: "serviceDate",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "readyAt"},
                            field: {
                                name: "readyAt",
                                widget: "#DisplayCard",
                                label: "readyAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
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
                            permissions: {read: "cost"},
                            field: {
                                name: "cost",
                                widget: "#DisplayCard",
                                label: "cost",
                                widgetProps: {
                                    icon: "#IconCash",
                                    type: "number",
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
            props: {title: "nextServiceGroup"},
            permissions: {readAny: ["nextDueAt", "nextDueKm"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "nextDueAt"},
                            field: {
                                name: "nextDueAt",
                                widget: "#DisplayCard",
                                label: "nextDueAt",
                                widgetProps: {
                                    icon: "#IconCalendarDue",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "nextDueKm"},
                            field: {
                                name: "nextDueKm",
                                widget: "#DisplayCard",
                                label: "nextDueKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#ReferencesViewModeScope",
            props: {
                storageKey: "vehicleMaintenance.sheet.damages.listDisplay",
                defaultMode: "compact",
            },
            children: [
                {
                    render: "#SheetGroup",
                    permissions: {readAny: ["damages"]},
                    dependent: "damages",
                    props: {
                        title: "damages",
                        titleActions: "#ReferencesViewModeToggle",
                    },
                    children: [
                        {
                            render: "div",
                            props: {
                                className:
                                    "rounded-lg bg-muted/30 border border-border/50",
                            },
                            children: [
                                {
                                    render: "#ReferencesRender",
                                    permissions: {read: "damages"},
                                    field: {
                                        name: "damages",
                                        widget: "#ReferencesRender",
                                        widgetProps: {
                                            cardWidget: "#VehicleDamageCard",
                                            pageSize: 2,
                                            compactRow: {
                                                icon: "#IconCarCrash",
                                                label: "damages",
                                                valuePath: ["description"],
                                                joinSeparator: " · ",
                                                linkedSheetModel: "vehicledamages",
                                                linkedSheetWidget:
                                                    "#VehicleDamageSheetView",
                                                linkedSheetEntityProp:
                                                    "vehicleDamage",
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

const typeOptions = VEHICLE_MAINTENANCE_TYPES.map((value) => ({
    value,
    label: `form.type.${value}`,
}));
// A record is entered as done or planned; cancelling is an action.
const statusOptions = VEHICLE_MAINTENANCE_STATUSES.filter(
    (value) => value !== "cancelled",
).map((value) => ({
    value,
    label: `form.status.${value}`,
}));

const vehicleMaintenanceCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.serviceSectionTitle"},
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
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            widgetProps: {
                                options: statusOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "provider",
                            widget: "#Input",
                            label: "form.providerLabel",
                            placeholder: "form.providerPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_MAINTENANCE_PROVIDER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "serviceDate",
                            widget: "#DateInput",
                            label: "form.serviceDateLabel",
                            placeholder: "form.serviceDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
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
                render: "#FormWhenFieldValueIn",
                props: {watchField: "status", whenValues: ["scheduled"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "readyAt",
                                    widget: "#DateInput",
                                    label: "form.readyAtLabel",
                                    placeholder: "form.readyAtPlaceholder",
                                    widgetProps: {
                                        valueFormat: "yyyy-MM-dd HH:mm",
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
        render: "#TitleWithCollapse",
        props: {title: "form.costSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "cost",
                            widget: "#Input",
                            label: "form.costLabel",
                            placeholder: "form.costPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "nextDueAt",
                            widget: "#DateInput",
                            label: "form.nextDueAtLabel",
                            placeholder: "form.nextDueAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "nextDueKm",
                            widget: "#Input",
                            label: "form.nextDueKmLabel",
                            placeholder: "form.nextDueKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
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
                    name: "description",
                    widget: "#Textarea",
                    label: "form.descriptionLabel",
                    placeholder: "form.descriptionPlaceholder",
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

const vehicleMaintenanceEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.serviceSectionTitle"},
        permissions: {
            readAny: [
                "vehicle",
                "type",
                "provider",
                "serviceDate",
                "odometerKm",
            ],
            writeAny: [
                "vehicle",
                "type",
                "provider",
                "serviceDate",
                "odometerKm",
            ],
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
                        permissions: {read: "provider", write: "provider"},
                        field: {
                            name: "provider",
                            widget: "#Input",
                            label: "form.providerLabel",
                            placeholder: "form.providerPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_MAINTENANCE_PROVIDER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "serviceDate",
                            write: "serviceDate",
                        },
                        field: {
                            name: "serviceDate",
                            widget: "#DateInput",
                            label: "form.serviceDateLabel",
                            placeholder: "form.serviceDatePlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
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
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.costSectionTitle"},
        permissions: {
            readAny: ["cost", "nextDueAt", "nextDueKm"],
            writeAny: ["cost", "nextDueAt", "nextDueKm"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "cost", write: "cost"},
                        field: {
                            name: "cost",
                            widget: "#Input",
                            label: "form.costLabel",
                            placeholder: "form.costPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "nextDueAt", write: "nextDueAt"},
                        field: {
                            name: "nextDueAt",
                            widget: "#DateInput",
                            label: "form.nextDueAtLabel",
                            placeholder: "form.nextDueAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "nextDueKm", write: "nextDueKm"},
                        field: {
                            name: "nextDueKm",
                            widget: "#Input",
                            label: "form.nextDueKmLabel",
                            placeholder: "form.nextDueKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
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
            readAny: ["description", "attachments"],
            writeAny: ["description", "attachments"],
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

export const vehicleMaintenanceCreateFormView: ViewConfig = {
    model: "vehiclemaintenances",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehiclemaintenances",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleMaintenanceCreateFormNodes,
};

export const vehicleMaintenanceEditFormView: ViewConfig = {
    model: "vehiclemaintenances",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehiclemaintenances",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleMaintenanceEditFormNodes,
};

export const vehicleMaintenanceViews: ViewConfig[] = [
    vehicleMaintenanceSheetView,
    vehicleMaintenanceCreateFormView,
    vehicleMaintenanceEditFormView,
];
