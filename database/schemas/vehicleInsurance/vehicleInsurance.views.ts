import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_INSURANCE_COVERAGES,
    VEHICLE_INSURER_MAX,
    VEHICLE_POLICY_NUMBER_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.schema-def";
import {
    VEHICLE_RECORD_ATTACHMENTS_MAX,
    VEHICLE_RECORD_NOTES_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleInsurance";

export const vehicleInsuranceSheetView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "sheet",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    header: {
        titleField: "policyNumber",
        subtitleKey: "vehicleInsuranceSubtitle",
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
                            permissions: {read: "insurer"},
                            field: {
                                name: "insurer",
                                widget: "#DisplayCard",
                                label: "insurer",
                                widgetProps: {icon: "#IconBuildingBank"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "policyNumber"},
                            field: {
                                name: "policyNumber",
                                widget: "#DisplayCard",
                                label: "policyNumber",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "coverage"},
                            field: {
                                name: "coverage",
                                widget: "#DisplayCard",
                                label: "coverage",
                                widgetProps: {
                                    icon: "#IconShieldCheck",
                                    type: "enum",
                                    languageKeyCategory: "coverageValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "validFrom"},
                            field: {
                                name: "validFrom",
                                widget: "#DisplayCard",
                                label: "validFrom",
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
                            dependent: "premium",
                            permissions: {read: "premium"},
                            field: {
                                name: "premium",
                                widget: "#DisplayCard",
                                label: "premium",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "premium"],
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
                            dependent: "deductible",
                            permissions: {read: "deductible"},
                            field: {
                                name: "deductible",
                                widget: "#DisplayCard",
                                label: "deductible",
                                widgetProps: {
                                    icon: "#IconCoin",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "deductible"],
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
            dependentAny: ["supersedes.policyNumber", "supersededBy.policyNumber"],
            props: {title: "renewalGroup"},
            permissions: {readAny: ["supersedes", "supersededBy"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            dependent: "supersedes.policyNumber",
                            permissions: {read: "supersedes"},
                            field: {
                                name: "supersedes.policyNumber",
                                widget: "#DisplayCard",
                                label: "supersedes",
                                widgetProps: {
                                    icon: "#IconHistory",
                                    linkedRefPath: "supersedes",
                                    linkedSheetModel: "vehicleinsurances",
                                    linkedSheetWidget:
                                        "#VehicleInsuranceSheetView",
                                    linkedSheetEntityProp: "vehicleInsurance",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "supersededBy.policyNumber",
                            permissions: {read: "supersededBy"},
                            field: {
                                name: "supersededBy.policyNumber",
                                widget: "#DisplayCard",
                                label: "supersededBy",
                                widgetProps: {
                                    icon: "#IconRefresh",
                                    linkedRefPath: "supersededBy",
                                    linkedSheetModel: "vehicleinsurances",
                                    linkedSheetWidget:
                                        "#VehicleInsuranceSheetView",
                                    linkedSheetEntityProp: "vehicleInsurance",
                                },
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

const coverageOptions = VEHICLE_INSURANCE_COVERAGES.map((value) => ({
    value,
    label: `form.coverage.${value}`,
}));

const vehicleSelectProps = {
    apiUrl: "/api/carRental/vehicle/select",
    method: "POST",
    pageSize: 50,
    normalizeEmptyToUndefined: true,
    postBody: {includeInactive: true},
    defaultOptionsFormExtraKey: "vehicleDefaultOptions",
};

const vehicleInsuranceCreateFormNodes: ViewConfig["nodes"] = [
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
                            widgetProps: vehicleSelectProps,
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "insurer",
                            widget: "#Input",
                            label: "form.insurerLabel",
                            placeholder: "form.insurerPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_INSURER_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "policyNumber",
                            widget: "#Input",
                            label: "form.policyNumberLabel",
                            placeholder: "form.policyNumberPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_POLICY_NUMBER_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "coverage",
                            widget: "#SimpleSelect",
                            label: "form.coverageLabel",
                            placeholder: "form.coveragePlaceholder",
                            required: true,
                            widgetProps: {
                                options: coverageOptions,
                                className: "grow w-full",
                            },
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
                        maxLength: VEHICLE_RECORD_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
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
                            name: "validFrom",
                            widget: "#DateInput",
                            label: "form.validFromLabel",
                            placeholder: "form.validFromPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "expiresAt",
                            widget: "#DateInput",
                            label: "form.expiresAtLabel",
                            placeholder: "form.expiresAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.amountsSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "premium",
                            widget: "#Input",
                            label: "form.premiumLabel",
                            placeholder: "form.premiumPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "deductible",
                            widget: "#Input",
                            label: "form.deductibleLabel",
                            placeholder: "form.deductiblePlaceholder",
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
        props: {title: "form.attachmentsSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "attachments",
                    widget: "#MediaField",
                    // The section title is the heading. MediaField prints its own label, so this stays blank.
                    label: "form.attachmentsBlankLabel",
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

const vehicleInsuranceEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.identificationSectionTitle"},
        permissions: {
            readAny: [
                "vehicle",
                "insurer",
                "policyNumber",
                "coverage",
                "notes",
            ],
            writeAny: [
                "vehicle",
                "insurer",
                "policyNumber",
                "coverage",
                "notes",
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
                            widgetProps: vehicleSelectProps,
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "insurer", write: "insurer"},
                        field: {
                            name: "insurer",
                            widget: "#Input",
                            label: "form.insurerLabel",
                            placeholder: "form.insurerPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_INSURER_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "policyNumber",
                            write: "policyNumber",
                        },
                        field: {
                            name: "policyNumber",
                            widget: "#Input",
                            label: "form.policyNumberLabel",
                            placeholder: "form.policyNumberPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_POLICY_NUMBER_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "coverage", write: "coverage"},
                        field: {
                            name: "coverage",
                            widget: "#SimpleSelect",
                            label: "form.coverageLabel",
                            placeholder: "form.coveragePlaceholder",
                            required: true,
                            widgetProps: {
                                options: coverageOptions,
                                className: "grow w-full",
                            },
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
                        maxLength: VEHICLE_RECORD_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.validitySectionTitle"},
        permissions: {
            readAny: ["validFrom", "expiresAt"],
            writeAny: ["validFrom", "expiresAt"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "validFrom", write: "validFrom"},
                        field: {
                            name: "validFrom",
                            widget: "#DateInput",
                            label: "form.validFromLabel",
                            placeholder: "form.validFromPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
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
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.amountsSectionTitle"},
        permissions: {
            readAny: ["premium", "deductible"],
            writeAny: ["premium", "deductible"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "premium", write: "premium"},
                        field: {
                            name: "premium",
                            widget: "#Input",
                            label: "form.premiumLabel",
                            placeholder: "form.premiumPlaceholder",
                            description: "form.amountCurrencyDescription",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "deductible", write: "deductible"},
                        field: {
                            name: "deductible",
                            widget: "#Input",
                            label: "form.deductibleLabel",
                            placeholder: "form.deductiblePlaceholder",
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
        props: {title: "form.attachmentsSectionTitle"},
        permissions: {readAny: ["attachments"], writeAny: ["attachments"]},
        children: [
            {
                render: "#Field",
                permissions: {read: "attachments", write: "attachments"},
                field: {
                    name: "attachments",
                    widget: "#MediaField",
                    // The section title is the heading. MediaField prints its own label, so this stays blank.
                    label: "form.attachmentsBlankLabel",
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

export const vehicleInsuranceCreateFormView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleInsuranceCreateFormNodes,
};

export const vehicleInsuranceEditFormView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleInsuranceEditFormNodes,
};

export const vehicleInsuranceViews: ViewConfig[] = [
    vehicleInsuranceSheetView,
    vehicleInsuranceCreateFormView,
    vehicleInsuranceEditFormView,
];
