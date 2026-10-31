import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_PROMO_CODE_CODE_MAX,
    RENTAL_PROMO_CODE_DESCRIPTION_MAX,
    RENTAL_PROMO_CODE_TYPES,
} from "armonia/src/modules/carRental/api/carRental/private/rentalPromoCode/rentalPromoCode.schema-def";

const API_URL = "/api/carRental/rentalPromoCode";

const typeOptions = RENTAL_PROMO_CODE_TYPES.map((value) => ({
    value,
    label: `form.type.${value}`,
}));

export const rentalPromoCodeSheetView: ViewConfig = {
    model: "rentalpromocodes",
    viewType: "sheet",
    accessModel: "rentalpromocodes",
    apiUrl: API_URL,
    header: {
        titleField: "code",
        subtitleKey: "rentalPromoCodeSubtitle",
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
                            permissions: {read: "code"},
                            field: {
                                name: "code",
                                widget: "#DisplayCard",
                                label: "code",
                                widgetProps: {icon: "#IconTicket"},
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
                                    icon: "#IconPercentage",
                                    type: "enum",
                                    languageKeyCategory: "typeValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "value"},
                            field: {
                                name: "value",
                                widget: "#DisplayCard",
                                label: "value",
                                widgetProps: {
                                    icon: "#IconDiscount",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "category"},
                            field: {
                                name: "category.name",
                                widget: "#DisplayCard",
                                label: "category",
                                widgetProps: {icon: "#IconCategory"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "bookableFrom"},
                            field: {
                                name: "bookableFrom",
                                widget: "#DisplayCard",
                                label: "bookableFrom",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "bookableUntil"},
                            field: {
                                name: "bookableUntil",
                                widget: "#DisplayCard",
                                label: "bookableUntil",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "tripFrom"},
                            field: {
                                name: "tripFrom",
                                widget: "#DisplayCard",
                                label: "tripFrom",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "tripUntil"},
                            field: {
                                name: "tripUntil",
                                widget: "#DisplayCard",
                                label: "tripUntil",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "minRentalDays"},
                            field: {
                                name: "minRentalDays",
                                widget: "#DisplayCard",
                                label: "minRentalDays",
                                widgetProps: {
                                    icon: "#IconHash",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "usageLimit"},
                            field: {
                                name: "usageLimit",
                                widget: "#DisplayCard",
                                label: "usageLimit",
                                widgetProps: {
                                    icon: "#IconHash",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "usageLimitPerEmail"},
                            field: {
                                name: "usageLimitPerEmail",
                                widget: "#DisplayCard",
                                label: "usageLimitPerEmail",
                                widgetProps: {
                                    icon: "#IconMail",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "usageCount"},
                            field: {
                                name: "usageCount",
                                widget: "#DisplayCard",
                                label: "usageCount",
                                widgetProps: {
                                    icon: "#IconChecks",
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
                        widgetProps: {icon: "#IconNotes"},
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const rentalPromoCodeCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        children: [
            {
                render: "#Field",
                field: {
                    name: "code",
                    widget: "#Input",
                    label: "form.codeLabel",
                    placeholder: "form.codePlaceholder",
                    required: true,
                    widgetProps: {maxLength: RENTAL_PROMO_CODE_CODE_MAX},
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
                    name: "value",
                    widget: "#Input",
                    label: "form.valueLabel",
                    placeholder: "form.valuePlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 0, step: "any"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "category",
                    widget: "#ApiSelect",
                    label: "form.categoryLabel",
                    placeholder: "form.categoryPlaceholder",
                    widgetProps: {
                        apiUrl: "/api/carRental/vehicleCategory/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name: "bookableFrom",
                    widget: "#DateInput",
                    label: "form.bookableFromLabel",
                    placeholder: "form.bookableFromPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "bookableUntil",
                    widget: "#DateInput",
                    label: "form.bookableUntilLabel",
                    placeholder: "form.bookableUntilPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "tripFrom",
                    widget: "#DateInput",
                    label: "form.tripFromLabel",
                    placeholder: "form.tripFromPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "tripUntil",
                    widget: "#DateInput",
                    label: "form.tripUntilLabel",
                    placeholder: "form.tripUntilPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "minRentalDays",
                    widget: "#Input",
                    label: "form.minRentalDaysLabel",
                    placeholder: "form.minRentalDaysPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "usageLimit",
                    widget: "#Input",
                    label: "form.usageLimitLabel",
                    placeholder: "form.usageLimitPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "usageLimitPerEmail",
                    widget: "#Input",
                    label: "form.usageLimitPerEmailLabel",
                    placeholder: "form.usageLimitPerEmailPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
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
    {
        render: "#Field",
        field: {
            name: "description",
            widget: "#Textarea",
            label: "form.descriptionLabel",
            placeholder: "form.descriptionPlaceholder",
            widgetProps: {
                rows: 3,
                maxLength: RENTAL_PROMO_CODE_DESCRIPTION_MAX,
            },
        },
    },
];

const rentalPromoCodeEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        permissions: {
            readAny: [
                "code",
                "type",
                "value",
                "category",
                "bookableFrom",
                "bookableUntil",
                "tripFrom",
                "tripUntil",
                "minRentalDays",
                "usageLimit",
                "usageLimitPerEmail",
                "isActive",
            ],
            writeAny: [
                "code",
                "type",
                "value",
                "category",
                "bookableFrom",
                "bookableUntil",
                "tripFrom",
                "tripUntil",
                "minRentalDays",
                "usageLimit",
                "usageLimitPerEmail",
                "isActive",
            ],
        },
        children: [
            {
                render: "#Field",
                permissions: {read: "code", write: "code"},
                field: {
                    name: "code",
                    widget: "#Input",
                    label: "form.codeLabel",
                    placeholder: "form.codePlaceholder",
                    required: true,
                    widgetProps: {maxLength: RENTAL_PROMO_CODE_CODE_MAX},
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
                permissions: {read: "value", write: "value"},
                field: {
                    name: "value",
                    widget: "#Input",
                    label: "form.valueLabel",
                    placeholder: "form.valuePlaceholder",
                    required: true,
                    widgetProps: {type: "number", min: 0, step: "any"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "category", write: "category"},
                field: {
                    name: "category",
                    widget: "#ApiSelect",
                    label: "form.categoryLabel",
                    placeholder: "form.categoryPlaceholder",
                    widgetProps: {
                        apiUrl: "/api/carRental/vehicleCategory/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "bookableFrom", write: "bookableFrom"},
                field: {
                    name: "bookableFrom",
                    widget: "#DateInput",
                    label: "form.bookableFromLabel",
                    placeholder: "form.bookableFromPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "bookableUntil", write: "bookableUntil"},
                field: {
                    name: "bookableUntil",
                    widget: "#DateInput",
                    label: "form.bookableUntilLabel",
                    placeholder: "form.bookableUntilPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "tripFrom", write: "tripFrom"},
                field: {
                    name: "tripFrom",
                    widget: "#DateInput",
                    label: "form.tripFromLabel",
                    placeholder: "form.tripFromPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "tripUntil", write: "tripUntil"},
                field: {
                    name: "tripUntil",
                    widget: "#DateInput",
                    label: "form.tripUntilLabel",
                    placeholder: "form.tripUntilPlaceholder",
                    widgetProps: {valueFormat: "yyyy-MM-dd"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "minRentalDays", write: "minRentalDays"},
                field: {
                    name: "minRentalDays",
                    widget: "#Input",
                    label: "form.minRentalDaysLabel",
                    placeholder: "form.minRentalDaysPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
                },
            },
            {
                render: "#Field",
                permissions: {read: "usageLimit", write: "usageLimit"},
                field: {
                    name: "usageLimit",
                    widget: "#Input",
                    label: "form.usageLimitLabel",
                    placeholder: "form.usageLimitPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
                },
            },
            {
                render: "#Field",
                permissions: {
                    read: "usageLimitPerEmail",
                    write: "usageLimitPerEmail",
                },
                field: {
                    name: "usageLimitPerEmail",
                    widget: "#Input",
                    label: "form.usageLimitPerEmailLabel",
                    placeholder: "form.usageLimitPerEmailPlaceholder",
                    widgetProps: {type: "number", min: 1, step: "any"},
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
    {
        render: "#Field",
        permissions: {read: "description", write: "description"},
        field: {
            name: "description",
            widget: "#Textarea",
            label: "form.descriptionLabel",
            placeholder: "form.descriptionPlaceholder",
            widgetProps: {
                rows: 3,
                maxLength: RENTAL_PROMO_CODE_DESCRIPTION_MAX,
            },
        },
    },
];

export const rentalPromoCodeCreateFormView: ViewConfig = {
    model: "rentalpromocodes",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalpromocodes",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalPromoCodeCreateFormNodes,
};

export const rentalPromoCodeEditFormView: ViewConfig = {
    model: "rentalpromocodes",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentalpromocodes",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalPromoCodeEditFormNodes,
};

export const rentalPromoCodeViews: ViewConfig[] = [
    rentalPromoCodeSheetView,
    rentalPromoCodeCreateFormView,
    rentalPromoCodeEditFormView,
];
