import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_BUSINESS_ACCOUNT_ADDRESS_MAX,
    RENTAL_BUSINESS_ACCOUNT_BILLING_EMAIL_MAX,
    RENTAL_BUSINESS_ACCOUNT_NAME_MAX,
    RENTAL_BUSINESS_ACCOUNT_NOTES_MAX,
    RENTAL_BUSINESS_ACCOUNT_VAT_NUMBER_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalBusinessAccount/rentalBusinessAccount.schema-def";

const API_URL = "/api/carRental/rentalBusinessAccount";

export const rentalBusinessAccountSheetView: ViewConfig = {
    model: "rentalbusinessaccounts",
    viewType: "sheet",
    accessModel: "rentalbusinessaccounts",
    apiUrl: API_URL,
    header: {
        titleField: "name",
        subtitleKey: "rentalBusinessAccountSubtitle",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "companyGroup"},
            permissions: {
                readAny: ["name", "vatNumber", "billingEmail", "address"],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "name"},
                            field: {
                                name: "name",
                                widget: "#DisplayCard",
                                label: "name",
                                widgetProps: {icon: "#IconBuildingBank"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "vatNumber"},
                            field: {
                                name: "vatNumber",
                                widget: "#DisplayCard",
                                label: "vatNumber",
                                widgetProps: {icon: "#IconReceipt"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "billingEmail"},
                            field: {
                                name: "billingEmail",
                                widget: "#DisplayCard",
                                label: "billingEmail",
                                widgetProps: {icon: "#IconMail"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "address"},
                            field: {
                                name: "address",
                                widget: "#DisplayCard",
                                label: "address",
                                widgetProps: {icon: "#IconMapPin"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "termsGroup"},
            permissions: {
                readAny: ["discountPercent", "paymentTermsDays", "isActive"],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "discountPercent"},
                            field: {
                                name: "discountPercent",
                                widget: "#DisplayCard",
                                label: "discountPercent",
                                widgetProps: {
                                    icon: "#IconDiscount",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "paymentTermsDays"},
                            field: {
                                name: "paymentTermsDays",
                                widget: "#DisplayCard",
                                label: "paymentTermsDays",
                                widgetProps: {
                                    icon: "#IconCalendarDue",
                                    type: "number",
                                },
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
                                    icon: "#IconCircleCheck",
                                    type: "boolean",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "notesGroup"},
            permissions: {read: "notes"},
            children: [
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
        lifecycleSheetGroup,
    ],
};

const rentalBusinessAccountCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.companySectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_BUSINESS_ACCOUNT_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vatNumber",
                            widget: "#Input",
                            label: "form.vatNumberLabel",
                            placeholder: "form.vatNumberPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_VAT_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "billingEmail",
                            widget: "#Input",
                            label: "form.billingEmailLabel",
                            placeholder: "form.billingEmailPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_BILLING_EMAIL_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "address",
                            widget: "#Input",
                            label: "form.addressLabel",
                            placeholder: "form.addressPlaceholder",
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_ADDRESS_MAX,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.termsSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "discountPercent",
                            widget: "#Input",
                            label: "form.discountPercentLabel",
                            placeholder: "form.discountPercentPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "paymentTermsDays",
                            widget: "#Input",
                            label: "form.paymentTermsDaysLabel",
                            placeholder: "form.paymentTermsDaysPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
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
                    widgetProps: {
                        rows: 4,
                        maxLength: RENTAL_BUSINESS_ACCOUNT_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
];

const rentalBusinessAccountEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.companySectionTitle"},
        permissions: {
            readAny: ["name", "vatNumber", "billingEmail", "address"],
            writeAny: ["name", "vatNumber", "billingEmail", "address"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "name", write: "name"},
                        field: {
                            name: "name",
                            widget: "#Input",
                            label: "form.nameLabel",
                            placeholder: "form.namePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_BUSINESS_ACCOUNT_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "vatNumber", write: "vatNumber"},
                        field: {
                            name: "vatNumber",
                            widget: "#Input",
                            label: "form.vatNumberLabel",
                            placeholder: "form.vatNumberPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_VAT_NUMBER_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "billingEmail", write: "billingEmail"},
                        field: {
                            name: "billingEmail",
                            widget: "#Input",
                            label: "form.billingEmailLabel",
                            placeholder: "form.billingEmailPlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_BILLING_EMAIL_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "address", write: "address"},
                        field: {
                            name: "address",
                            widget: "#Input",
                            label: "form.addressLabel",
                            placeholder: "form.addressPlaceholder",
                            widgetProps: {
                                maxLength: RENTAL_BUSINESS_ACCOUNT_ADDRESS_MAX,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.termsSectionTitle"},
        permissions: {
            readAny: ["discountPercent", "paymentTermsDays", "isActive"],
            writeAny: ["discountPercent", "paymentTermsDays", "isActive"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {
                            read: "discountPercent",
                            write: "discountPercent",
                        },
                        field: {
                            name: "discountPercent",
                            widget: "#Input",
                            label: "form.discountPercentLabel",
                            placeholder: "form.discountPercentPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "paymentTermsDays",
                            write: "paymentTermsDays",
                        },
                        field: {
                            name: "paymentTermsDays",
                            widget: "#Input",
                            label: "form.paymentTermsDaysLabel",
                            placeholder: "form.paymentTermsDaysPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
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
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.notesSectionTitle"},
        permissions: {readAny: ["notes"], writeAny: ["notes"]},
        children: [
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
                        maxLength: RENTAL_BUSINESS_ACCOUNT_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
];

export const rentalBusinessAccountCreateFormView: ViewConfig = {
    model: "rentalbusinessaccounts",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalbusinessaccounts",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalBusinessAccountCreateFormNodes,
};

export const rentalBusinessAccountEditFormView: ViewConfig = {
    model: "rentalbusinessaccounts",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentalbusinessaccounts",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalBusinessAccountEditFormNodes,
};

export const rentalBusinessAccountViews: ViewConfig[] = [
    rentalBusinessAccountSheetView,
    rentalBusinessAccountCreateFormView,
    rentalBusinessAccountEditFormView,
];
