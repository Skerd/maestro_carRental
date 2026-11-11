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
        titleField: "vehicle.plate",
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
                            permissions: {read: "fromLocation"},
                            field: {
                                name: "fromLocation.name",
                                widget: "#DisplayCard",
                                label: "fromLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "fromLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "toLocation"},
                            field: {
                                name: "toLocation.name",
                                widget: "#DisplayCard",
                                label: "toLocation",
                                widgetProps: {
                                    icon: "#IconMapPinFilled",
                                    linkedRefPath: "toLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
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
                            dependent: "driver.name",
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
        lifecycleSheetGroup,
    ],
};

const vehicleTransferCreateFormNodes: ViewConfig["nodes"] = [
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
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
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
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.driverSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
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
                            widgetProps: {type: "number", min: 0, step: 1},
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
                        rows: 3,
                        maxLength: VEHICLE_TRANSFER_NOTES_MAX,
                    },
                },
            },
        ],
    },
];

const vehicleTransferEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.tripSectionTitle"},
        permissions: {
            readAny: [
                "vehicle",
                "fromLocation",
                "toLocation",
                "departAt",
                "arriveAt",
            ],
            writeAny: [
                "vehicle",
                "fromLocation",
                "toLocation",
                "departAt",
                "arriveAt",
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
                                disabled: true,
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
                        permissions: {
                            read: "fromLocation",
                            write: "fromLocation",
                        },
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
                                valueFormat: "YYYY-MM-DD HH:mm",
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
                                valueFormat: "YYYY-MM-DD HH:mm",
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.driverSectionTitle"},
        permissions: {
            readAny: ["driver", "odometerKm", "notes"],
            writeAny: ["driver", "odometerKm", "notes"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
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
                            widgetProps: {type: "number", min: 0, step: 1},
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
                        rows: 3,
                        maxLength: VEHICLE_TRANSFER_NOTES_MAX,
                    },
                },
            },
        ],
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
