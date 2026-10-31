import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {VEHICLE_TRANSFER_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicleTransfer/vehicleTransfer.schema-def";

const API_URL = "/api/carRental/vehicleTransfer";

export const vehicleTransferSheetView: ViewConfig = {
    model: "vehicletransfers",
    viewType: "sheet",
    accessModel: "vehicletransfers",
    apiUrl: API_URL,
    header: {
        titleField: "vehicle",
        subtitleKey: "vehicleTransferSubtitle",
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
                            permissions: {read: "fromLocation"},
                            field: {
                                name: "fromLocation.name",
                                widget: "#DisplayCard",
                                label: "fromLocation",
                                widgetProps: {icon: "#IconMapPin"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "toLocation"},
                            field: {
                                name: "toLocation.name",
                                widget: "#DisplayCard",
                                label: "toLocation",
                                widgetProps: {icon: "#IconMapPinFilled"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "departAt"},
                            field: {
                                name: "departAt",
                                widget: "#DisplayCard",
                                label: "departAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "arriveAt"},
                            field: {
                                name: "arriveAt",
                                widget: "#DisplayCard",
                                label: "arriveAt",
                                widgetProps: {
                                    icon: "#IconCalendarCheck",
                                    type: "dateTime",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "driver"},
                            field: {
                                name: "driver.name",
                                widget: "#DisplayCard",
                                label: "driver",
                                widgetProps: {icon: "#IconUser"},
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
                    ],
                },
                {
                    render: "#DisplayCard",
                    permissions: {read: "notes"},
                    field: {
                        name: "notes",
                        widget: "#DisplayCard",
                        label: "notes",
                        widgetProps: {icon: "#IconNotes"},
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const vehicleTransferCreateFormNodes: ViewConfig["nodes"] = [
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
                    name: "fromLocation",
                    widget: "#ApiSelect",
                    label: "form.fromLocationLabel",
                    placeholder: "form.fromLocationPlaceholder",
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
                    name: "toLocation",
                    widget: "#ApiSelect",
                    label: "form.toLocationLabel",
                    placeholder: "form.toLocationPlaceholder",
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
                    name: "departAt",
                    widget: "#DateInput",
                    label: "form.departAtLabel",
                    placeholder: "form.departAtPlaceholder",
                    required: true,
                    widgetProps: {valueFormat: "yyyy-MM-dd HH:mm"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "arriveAt",
                    widget: "#DateInput",
                    label: "form.arriveAtLabel",
                    placeholder: "form.arriveAtPlaceholder",
                    required: true,
                    widgetProps: {valueFormat: "yyyy-MM-dd HH:mm"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "driver",
                    widget: "#ApiSelect",
                    label: "form.driverLabel",
                    placeholder: "form.driverPlaceholder",
                    widgetProps: {
                        apiUrl: "/api/company/users/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
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
                    widgetProps: {type: "number", min: 0, step: "any"},
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
            widgetProps: {rows: 3, maxLength: VEHICLE_TRANSFER_NOTES_MAX},
        },
    },
];

const vehicleTransferEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        permissions: {
            readAny: [
                "vehicle",
                "fromLocation",
                "toLocation",
                "departAt",
                "arriveAt",
                "driver",
                "odometerKm",
            ],
            writeAny: [
                "vehicle",
                "fromLocation",
                "toLocation",
                "departAt",
                "arriveAt",
                "driver",
                "odometerKm",
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
                        disabled: true,
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
                permissions: {read: "fromLocation", write: "fromLocation"},
                field: {
                    name: "fromLocation",
                    widget: "#ApiSelect",
                    label: "form.fromLocationLabel",
                    placeholder: "form.fromLocationPlaceholder",
                    required: true,
                    widgetProps: {
                        disabled: true,
                        apiUrl: "/api/carRental/rentalLocation/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "toLocation", write: "toLocation"},
                field: {
                    name: "toLocation",
                    widget: "#ApiSelect",
                    label: "form.toLocationLabel",
                    placeholder: "form.toLocationPlaceholder",
                    required: true,
                    widgetProps: {
                        disabled: true,
                        apiUrl: "/api/carRental/rentalLocation/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "departAt", write: "departAt"},
                field: {
                    name: "departAt",
                    widget: "#DateInput",
                    label: "form.departAtLabel",
                    placeholder: "form.departAtPlaceholder",
                    required: true,
                    widgetProps: {
                        disabled: true,
                        valueFormat: "yyyy-MM-dd HH:mm",
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "arriveAt", write: "arriveAt"},
                field: {
                    name: "arriveAt",
                    widget: "#DateInput",
                    label: "form.arriveAtLabel",
                    placeholder: "form.arriveAtPlaceholder",
                    required: true,
                    widgetProps: {
                        disabled: true,
                        valueFormat: "yyyy-MM-dd HH:mm",
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "driver", write: "driver"},
                field: {
                    name: "driver",
                    widget: "#ApiSelect",
                    label: "form.driverLabel",
                    placeholder: "form.driverPlaceholder",
                    widgetProps: {
                        apiUrl: "/api/company/users/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
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
                    widgetProps: {type: "number", min: 0, step: "any"},
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
            widgetProps: {rows: 3, maxLength: VEHICLE_TRANSFER_NOTES_MAX},
        },
    },
];

export const vehicleTransferCreateFormView: ViewConfig = {
    model: "vehicletransfers",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicletransfers",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleTransferCreateFormNodes,
};

export const vehicleTransferEditFormView: ViewConfig = {
    model: "vehicletransfers",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicletransfers",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleTransferEditFormNodes,
};

export const vehicleTransferViews: ViewConfig[] = [
    vehicleTransferSheetView,
    vehicleTransferCreateFormView,
    vehicleTransferEditFormView,
];
