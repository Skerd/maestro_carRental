import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_DOCUMENT_ISSUER_MAX,
    VEHICLE_DOCUMENT_NUMBER_MAX,
    VEHICLE_DOCUMENT_STATUSES,
    VEHICLE_DOCUMENT_TYPES,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDocument/vehicleDocument.schema-def";
import {
    VEHICLE_RECORD_ATTACHMENTS_MAX,
    VEHICLE_RECORD_NOTES_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleDocument";

export const vehicleDocumentSheetView: ViewConfig = {
    model: "vehicledocuments",
    viewType: "sheet",
    accessModel: "vehicledocuments",
    apiUrl: API_URL,
    header: {
        titleField: "vehicle.plate",
        subtitleKey: "vehicleDocumentSubtitle",
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
                                    icon: "#IconFileCertificate",
                                    type: "enum",
                                    languageKeyCategory: "typeValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "documentNumber"},
                            field: {
                                name: "documentNumber",
                                widget: "#DisplayCard",
                                label: "documentNumber",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "issuer"},
                            field: {
                                name: "issuer",
                                widget: "#DisplayCard",
                                label: "issuer",
                                widgetProps: {icon: "#IconBuilding"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "issuedAt"},
                            field: {
                                name: "issuedAt",
                                widget: "#DisplayCard",
                                label: "issuedAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "expiresAt"},
                            field: {
                                name: "expiresAt",
                                widget: "#DisplayCard",
                                label: "expiresAt",
                                widgetProps: {
                                    icon: "#IconCalendarDue",
                                    format: "date",
                                    type: "date",
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

const typeOptions = VEHICLE_DOCUMENT_TYPES.map((value) => ({
    value,
    label: `form.type.${value}`,
}));
const statusOptions = VEHICLE_DOCUMENT_STATUSES.map((value) => ({
    value,
    label: `form.status.${value}`,
}));

const vehicleDocumentCreateFormNodes: ViewConfig["nodes"] = [
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
                            name: "documentNumber",
                            widget: "#Input",
                            label: "form.documentNumberLabel",
                            placeholder: "form.documentNumberPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DOCUMENT_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "issuer",
                            widget: "#Input",
                            label: "form.issuerLabel",
                            placeholder: "form.issuerPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DOCUMENT_ISSUER_MAX,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.validitySectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "issuedAt",
                            widget: "#DateInput",
                            label: "form.issuedAtLabel",
                            placeholder: "form.issuedAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expiresAt",
                            widget: "#DateInput",
                            label: "form.expiresAtLabel",
                            placeholder: "form.expiresAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
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
                ],
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

const vehicleDocumentEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.identificationSectionTitle"},
        permissions: {
            readAny: ["vehicle", "type", "documentNumber", "issuer"],
            writeAny: ["vehicle", "type", "documentNumber", "issuer"],
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
                        permissions: {
                            read: "documentNumber",
                            write: "documentNumber",
                        },
                        field: {
                            name: "documentNumber",
                            widget: "#Input",
                            label: "form.documentNumberLabel",
                            placeholder: "form.documentNumberPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DOCUMENT_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "issuer", write: "issuer"},
                        field: {
                            name: "issuer",
                            widget: "#Input",
                            label: "form.issuerLabel",
                            placeholder: "form.issuerPlaceholder",
                            widgetProps: {
                                maxLength: VEHICLE_DOCUMENT_ISSUER_MAX,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.validitySectionTitle"},
        permissions: {
            readAny: ["issuedAt", "expiresAt", "status"],
            writeAny: ["issuedAt", "expiresAt", "status"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "issuedAt", write: "issuedAt"},
                        field: {
                            name: "issuedAt",
                            widget: "#DateInput",
                            label: "form.issuedAtLabel",
                            placeholder: "form.issuedAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "expiresAt", write: "expiresAt"},
                        field: {
                            name: "expiresAt",
                            widget: "#DateInput",
                            label: "form.expiresAtLabel",
                            placeholder: "form.expiresAtPlaceholder",
                            widgetProps: {valueFormat: "yyyy-MM-dd"},
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
                ],
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

export const vehicleDocumentCreateFormView: ViewConfig = {
    model: "vehicledocuments",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicledocuments",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleDocumentCreateFormNodes,
};

export const vehicleDocumentEditFormView: ViewConfig = {
    model: "vehicledocuments",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicledocuments",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleDocumentEditFormNodes,
};

export const vehicleDocumentViews: ViewConfig[] = [
    vehicleDocumentSheetView,
    vehicleDocumentCreateFormView,
    vehicleDocumentEditFormView,
];
