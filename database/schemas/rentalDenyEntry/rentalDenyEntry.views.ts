import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_DENY_ENTRY_EMAIL_MAX,
    RENTAL_DENY_ENTRY_LICENSE_NUMBER_MAX,
    RENTAL_DENY_ENTRY_REASON_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalDenyEntry/rentalDenyEntry.schema-def";

const API_URL = "/api/carRental/rentalDenyEntry";

export const rentalDenyEntrySheetView: ViewConfig = {
    model: "rentaldenyentries",
    viewType: "sheet",
    sheetWidget: "#RentalDenyEntrySheetView",
    accessModel: "rentaldenyentries",
    apiUrl: API_URL,
    header: {
        titleField: "reason",
        subtitleKey: "rentalDenyEntrySubtitle",
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
                            dependent: "email",
                            permissions: {read: "email"},
                            field: {
                                name: "email",
                                widget: "#DisplayCard",
                                label: "email",
                                widgetProps: {icon: "#IconMail"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "licenseNumber",
                            permissions: {read: "licenseNumber"},
                            field: {
                                name: "licenseNumber",
                                widget: "#DisplayCard",
                                label: "licenseNumber",
                                widgetProps: {icon: "#IconId"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "isActive"},
                            field: {
                                name: "isActive",
                                widget: "#DisplayCard",
                                label: "isActive",
                                widgetProps: {
                                    icon: "#IconBan",
                                    type: "boolean",
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
                            permissions: {read: "reason"},
                            field: {
                                name: "reason",
                                widget: "#DisplayCard",
                                label: "reason",
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

const rentalDenyEntryCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.personSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            widgetProps: {maxLength: RENTAL_DENY_ENTRY_EMAIL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "licenseNumber",
                            widget: "#Input",
                            label: "form.licenseNumberLabel",
                            placeholder: "form.licenseNumberPlaceholder",
                            widgetProps: {
                                maxLength: RENTAL_DENY_ENTRY_LICENSE_NUMBER_MAX,
                            },
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "reason",
                    widget: "#Textarea",
                    label: "form.reasonLabel",
                    placeholder: "form.reasonPlaceholder",
                    required: true,
                    widgetProps: {rows: 3, maxLength: RENTAL_DENY_ENTRY_REASON_MAX},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.statusSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "isActive",
                    widget: "#Switch",
                    label: "form.isActiveLabel",
                },
            },
        ],
    },
];

const rentalDenyEntryEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.personSectionTitle"},
        permissions: {readAny: ["email", "licenseNumber", "reason"], writeAny: ["email", "licenseNumber", "reason"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "email", write: "email"},
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            widgetProps: {maxLength: RENTAL_DENY_ENTRY_EMAIL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "licenseNumber", write: "licenseNumber"},
                        field: {
                            name: "licenseNumber",
                            widget: "#Input",
                            label: "form.licenseNumberLabel",
                            placeholder: "form.licenseNumberPlaceholder",
                            widgetProps: {
                                maxLength: RENTAL_DENY_ENTRY_LICENSE_NUMBER_MAX,
                            },
                        },
                    },
                ],
            },
            {
                render: "#Field",
                permissions: {read: "reason", write: "reason"},
                field: {
                    name: "reason",
                    widget: "#Textarea",
                    label: "form.reasonLabel",
                    placeholder: "form.reasonPlaceholder",
                    required: true,
                    widgetProps: {rows: 3, maxLength: RENTAL_DENY_ENTRY_REASON_MAX},
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.statusSectionTitle"},
        permissions: {readAny: ["isActive"], writeAny: ["isActive"]},
        children: [
            {
                render: "#Field",
                permissions: {read: "isActive", write: "isActive"},
                field: {
                    name: "isActive",
                    widget: "#Switch",
                    label: "form.isActiveLabel",
                },
            },
        ],
    },
];

export const rentalDenyEntryCreateFormView: ViewConfig = {
    model: "rentaldenyentries",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentaldenyentries",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalDenyEntryCreateFormNodes,
};

export const rentalDenyEntryEditFormView: ViewConfig = {
    model: "rentaldenyentries",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentaldenyentries",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalDenyEntryEditFormNodes,
};

export const rentalDenyEntryViews: ViewConfig[] = [
    rentalDenyEntrySheetView,
    rentalDenyEntryCreateFormView,
    rentalDenyEntryEditFormView,
];
