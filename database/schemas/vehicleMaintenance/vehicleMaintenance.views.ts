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
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "vehicle"},
                            field: {
                                name: "vehicle.plate",
                                widget: "#DisplayCard",
                                label: "vehicle",
                                widgetProps: {icon: "#IconCar"},
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
                {
                    render: "#DisplayCard",
                    permissions: {read: "description"},
                    field: {
                        name: "description",
                        widget: "#DisplayCard",
                        label: "description",
                        widgetProps: {icon: "#IconNotes"},
                    },
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
const statusOptions = VEHICLE_MAINTENANCE_STATUSES.map((value) => ({
    value,
    label: `form.status.${value}`,
}));

const vehicleMaintenanceCreateFormNodes: ViewConfig["nodes"] = [
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
            {
                render: "#Field",
                field: {
                    name: "provider",
                    widget: "#Input",
                    label: "form.providerLabel",
                    placeholder: "form.providerPlaceholder",
                    widgetProps: {maxLength: VEHICLE_MAINTENANCE_PROVIDER_MAX},
                },
            },
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
];

const vehicleMaintenanceEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        permissions: {
            readAny: [
                "vehicle",
                "type",
                "status",
                "serviceDate",
                "odometerKm",
                "provider",
                "cost",
                "nextDueAt",
                "nextDueKm",
            ],
            writeAny: [
                "vehicle",
                "type",
                "status",
                "serviceDate",
                "odometerKm",
                "provider",
                "cost",
                "nextDueAt",
                "nextDueKm",
            ],
        },
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
                permissions: {read: "status", write: "status"},
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
                permissions: {read: "serviceDate", write: "serviceDate"},
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
            {
                render: "#Field",
                permissions: {read: "provider", write: "provider"},
                field: {
                    name: "provider",
                    widget: "#Input",
                    label: "form.providerLabel",
                    placeholder: "form.providerPlaceholder",
                    widgetProps: {maxLength: VEHICLE_MAINTENANCE_PROVIDER_MAX},
                },
            },
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
