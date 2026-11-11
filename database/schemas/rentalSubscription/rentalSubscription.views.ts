import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_SUBSCRIPTION_CONTACT_NAME_MAX,
    RENTAL_SUBSCRIPTION_EMAIL_MAX,
    RENTAL_SUBSCRIPTION_PERIODS,
    RENTAL_SUBSCRIPTION_PHONE_MAX,
    RENTAL_SUBSCRIPTION_STATUSS,
} from "armonia/src/modules/carRental/api/carRental/private/rentalSubscription/rentalSubscription.schema-def";

const API_URL = "/api/carRental/rentalSubscription";

const periodOptions = RENTAL_SUBSCRIPTION_PERIODS.map((value) => ({
    value,
    label: `form.period.${value}`,
}));
const statusOptions = RENTAL_SUBSCRIPTION_STATUSS.map((value) => ({
    value,
    label: `form.status.${value}`,
}));

export const rentalSubscriptionSheetView: ViewConfig = {
    model: "rentalsubscriptions",
    viewType: "sheet",
    accessModel: "rentalsubscriptions",
    apiUrl: API_URL,
    header: {
        titleField: "contactName",
        subtitleKey: "rentalSubscriptionSubtitle",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "contactGroup"},
            permissions: {readAny: ["contactName", "email", "phone"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "contactName"},
                            field: {
                                name: "contactName",
                                widget: "#DisplayCard",
                                label: "contactName",
                                widgetProps: {icon: "#IconUser"},
                            },
                        },
                        {
                            render: "#DisplayCard",
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
                            permissions: {read: "phone"},
                            field: {
                                name: "phone",
                                widget: "#DisplayCard",
                                label: "phone",
                                widgetProps: {icon: "#IconPhone"},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "bookingGroup"},
            permissions: {readAny: ["category", "pickupLocation"]},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "category"},
                            field: {
                                name: "category.name",
                                widget: "#DisplayCard",
                                label: "category",
                                widgetProps: {
                                    icon: "#IconCategory",
                                    linkedRefPath: "category",
                                    linkedSheetModel: "vehiclecategories",
                                    linkedSheetWidget: "#VehicleCategorySheetView",
                                    linkedSheetEntityProp: "vehicleCategory",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "pickupLocation"},
                            field: {
                                name: "pickupLocation.name",
                                widget: "#DisplayCard",
                                label: "pickupLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "pickupLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget: "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "scheduleGroup"},
            permissions: {
                readAny: ["period", "price", "status", "nextRunAt"],
            },
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "period"},
                            field: {
                                name: "period",
                                widget: "#DisplayCard",
                                label: "period",
                                widgetProps: {
                                    icon: "#IconRepeat",
                                    type: "enum",
                                    languageKeyCategory: "periodValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "price"},
                            field: {
                                name: "price",
                                widget: "#DisplayCard",
                                label: "price",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "price"],
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
                            permissions: {read: "nextRunAt"},
                            field: {
                                name: "nextRunAt",
                                widget: "#DisplayCard",
                                label: "nextRunAt",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    type: "dateTime",
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

const rentalSubscriptionCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.contactSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "contactName",
                            widget: "#Input",
                            label: "form.contactNameLabel",
                            placeholder: "form.contactNamePlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_SUBSCRIPTION_CONTACT_NAME_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_SUBSCRIPTION_EMAIL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "phone",
                            widget: "#Input",
                            label: "form.phoneLabel",
                            placeholder: "form.phonePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_SUBSCRIPTION_PHONE_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.bookingSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "category",
                            widget: "#ApiSelect",
                            label: "form.categoryLabel",
                            placeholder: "form.categoryPlaceholder",
                            required: true,
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
                            name: "pickupLocation",
                            widget: "#ApiSelect",
                            label: "form.pickupLocationLabel",
                            placeholder: "form.pickupLocationPlaceholder",
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
                            name: "businessAccount",
                            widget: "#ApiSelect",
                            label: "form.businessAccountLabel",
                            placeholder: "form.businessAccountPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalBusinessAccount/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.scheduleSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "period",
                            widget: "#SimpleSelect",
                            label: "form.periodLabel",
                            placeholder: "form.periodPlaceholder",
                            required: true,
                            widgetProps: {
                                options: periodOptions,
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
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            required: true,
                            widgetProps: {
                                options: statusOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "nextRunAt",
                            widget: "#DateInput",
                            label: "form.nextRunAtLabel",
                            placeholder: "form.nextRunAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                ],
            },
        ],
    },
];

const rentalSubscriptionEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.contactSectionTitle"},
        permissions: {
            readAny: ["contactName", "email", "phone"],
            writeAny: ["contactName", "email", "phone"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "contactName", write: "contactName"},
                        field: {
                            name: "contactName",
                            widget: "#Input",
                            label: "form.contactNameLabel",
                            placeholder: "form.contactNamePlaceholder",
                            required: true,
                            widgetProps: {
                                maxLength: RENTAL_SUBSCRIPTION_CONTACT_NAME_MAX,
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "email", write: "email"},
                        field: {
                            name: "email",
                            widget: "#Input",
                            label: "form.emailLabel",
                            placeholder: "form.emailPlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_SUBSCRIPTION_EMAIL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "phone", write: "phone"},
                        field: {
                            name: "phone",
                            widget: "#Input",
                            label: "form.phoneLabel",
                            placeholder: "form.phonePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_SUBSCRIPTION_PHONE_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.bookingSectionTitle"},
        permissions: {
            readAny: ["category", "pickupLocation", "businessAccount"],
            writeAny: ["category", "pickupLocation", "businessAccount"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "category", write: "category"},
                        field: {
                            name: "category",
                            widget: "#ApiSelect",
                            label: "form.categoryLabel",
                            placeholder: "form.categoryPlaceholder",
                            required: true,
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
                        permissions: {read: "pickupLocation", write: "pickupLocation"},
                        field: {
                            name: "pickupLocation",
                            widget: "#ApiSelect",
                            label: "form.pickupLocationLabel",
                            placeholder: "form.pickupLocationPlaceholder",
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
                        permissions: {
                            read: "businessAccount",
                            write: "businessAccount",
                        },
                        field: {
                            name: "businessAccount",
                            widget: "#ApiSelect",
                            label: "form.businessAccountLabel",
                            placeholder: "form.businessAccountPlaceholder",
                            widgetProps: {
                                apiUrl: "/api/carRental/rentalBusinessAccount/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.scheduleSectionTitle"},
        permissions: {
            readAny: ["period", "price", "status", "nextRunAt"],
            writeAny: ["period", "price", "status", "nextRunAt"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "period", write: "period"},
                        field: {
                            name: "period",
                            widget: "#SimpleSelect",
                            label: "form.periodLabel",
                            placeholder: "form.periodPlaceholder",
                            required: true,
                            widgetProps: {
                                options: periodOptions,
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
                        permissions: {read: "status", write: "status"},
                        field: {
                            name: "status",
                            widget: "#SimpleSelect",
                            label: "form.statusLabel",
                            placeholder: "form.statusPlaceholder",
                            required: true,
                            widgetProps: {
                                options: statusOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "nextRunAt", write: "nextRunAt"},
                        field: {
                            name: "nextRunAt",
                            widget: "#DateInput",
                            label: "form.nextRunAtLabel",
                            placeholder: "form.nextRunAtPlaceholder",
                            required: true,
                            widgetProps: {valueFormat: "YYYY-MM-DD HH:mm"},
                        },
                    },
                ],
            },
        ],
    },
];

export const rentalSubscriptionCreateFormView: ViewConfig = {
    model: "rentalsubscriptions",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalsubscriptions",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalSubscriptionCreateFormNodes,
};

export const rentalSubscriptionEditFormView: ViewConfig = {
    model: "rentalsubscriptions",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentalsubscriptions",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalSubscriptionEditFormNodes,
};

export const rentalSubscriptionViews: ViewConfig[] = [
    rentalSubscriptionSheetView,
    rentalSubscriptionCreateFormView,
    rentalSubscriptionEditFormView,
];
