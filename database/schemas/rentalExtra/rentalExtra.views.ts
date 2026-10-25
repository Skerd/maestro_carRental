import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_EXTRA_DESCRIPTION_MAX,
    RENTAL_EXTRA_NAME_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalExtra/rentalExtra.schema-def";

const API_URL = "/api/carRental/rentalExtra";

export const rentalExtraSheetView: ViewConfig = {
    model: "rentalextras",
    viewType: "sheet",
    accessModel: "rentalextras",
    apiUrl: API_URL,
    header: {
        titleField: "name",
        subtitleKey: "rentalExtraSubtitle",
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
                            permissions: {read: "price"},
                            field: {
                                name: "price",
                                widget: "#DisplayCard",
                                label: "price",
                                widgetProps: {
                                    icon: "#IconCash",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pricing"},
                            field: {
                                name: "pricing",
                                widget: "#DisplayCard",
                                label: "pricing",
                                widgetProps: {
                                    icon: "#IconReceipt",
                                    type: "enum",
                                    languageKeyCategory: "pricingValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "maxQuantity"},
                            field: {
                                name: "maxQuantity",
                                widget: "#DisplayCard",
                                label: "maxQuantity",
                                widgetProps: {icon: "#Hash", type: "number"},
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
                                    icon: "#IconToggleRight",
                                    type: "boolean",
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
                        widgetProps: {icon: "#IconAlignLeft"},
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const pricingOptions = [
    {value: "per_day", label: "form.pricing.per_day"},
    {value: "per_rental", label: "form.pricing.per_rental"},
];

const rentalExtraCreateFormNodes: ViewConfig["nodes"] = [
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
                    widgetProps: {maxLength: RENTAL_EXTRA_NAME_MAX},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "pricing",
                    widget: "#SimpleSelect",
                    label: "form.pricingLabel",
                    placeholder: "form.pricingPlaceholder",
                    required: true,
                    widgetProps: {
                        options: pricingOptions,
                        className: "grow w-full",
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name: "price",
                    widget: "#Input",
                    label: "form.priceLabel",
                    placeholder: "form.pricePlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 0, step: "any"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "maxQuantity",
                    widget: "#Input",
                    label: "form.maxQuantityLabel",
                    placeholder: "form.maxQuantityPlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 1, max: 10},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "sortOrder",
                    widget: "#Input",
                    label: "form.sortOrderLabel",
                    placeholder: "form.sortOrderPlaceholder",
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
            widgetProps: {rows: 3, maxLength: RENTAL_EXTRA_DESCRIPTION_MAX},
        },
    },
];

const rentalExtraEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        permissions: {
            readAny: ["name", "pricing", "price", "maxQuantity", "sortOrder"],
            writeAny: ["name", "pricing", "price", "maxQuantity", "sortOrder"],
        },
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
                    widgetProps: {maxLength: RENTAL_EXTRA_NAME_MAX},
                },
            },
            {
                render: "#Field",
                permissions: {read: "pricing", write: "pricing"},
                field: {
                    name: "pricing",
                    widget: "#SimpleSelect",
                    label: "form.pricingLabel",
                    placeholder: "form.pricingPlaceholder",
                    required: true,
                    widgetProps: {
                        options: pricingOptions,
                        className: "grow w-full",
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "price", write: "price"},
                field: {
                    name: "price",
                    widget: "#Input",
                    label: "form.priceLabel",
                    placeholder: "form.pricePlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 0, step: "any"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "maxQuantity", write: "maxQuantity"},
                field: {
                    name: "maxQuantity",
                    widget: "#Input",
                    label: "form.maxQuantityLabel",
                    placeholder: "form.maxQuantityPlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 1, max: 10},
                },
            },
            {
                render: "#Field",
                permissions: {read: "sortOrder", write: "sortOrder"},
                field: {
                    name: "sortOrder",
                    widget: "#Input",
                    label: "form.sortOrderLabel",
                    placeholder: "form.sortOrderPlaceholder",
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
            widgetProps: {rows: 3, maxLength: RENTAL_EXTRA_DESCRIPTION_MAX},
        },
    },
];

export const rentalExtraCreateFormView: ViewConfig = {
    model: "rentalextras",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalextras",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalExtraCreateFormNodes,
};

export const rentalExtraEditFormView: ViewConfig = {
    model: "rentalextras",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentalextras",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalExtraEditFormNodes,
};

export const rentalExtraViews: ViewConfig[] = [
    rentalExtraSheetView,
    rentalExtraCreateFormView,
    rentalExtraEditFormView,
];
