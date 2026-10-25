import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {
    RENTAL_TERMS_TEXT_MAX,
    RENTAL_TERMS_VERSION_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.schema-def";

const API_URL = "/api/carRental/carRentalConfig";

const paymentPolicyOptions = [
    {value: "pay_at_pickup", label: "form.paymentPolicy.pay_at_pickup"},
    {value: "prepay_online", label: "form.paymentPolicy.prepay_online"},
    {value: "customer_choice", label: "form.paymentPolicy.customer_choice"},
];

/** Settings are edited in place from the settings page; there is no create form or sheet. */
export const carRentalConfigEditFormView: ViewConfig = {
    model: "carrentalconfigs",
    viewType: "form",
    viewMode: "edit",
    accessModel: "carrentalconfigs",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: [
        {
            render: "#TitleWithCollapse",
            props: {title: "form.bookingSectionTitle"},
            permissions: {
                readAny: [
                    "publicBookingEnabled",
                    "guestBookingAllowed",
                    "currency",
                    "minRentalHours",
                    "maxRentalDays",
                    "minLeadTimeHours",
                    "maxAdvanceDays",
                    "turnaroundBufferMinutes",
                    "lateGraceMinutes",
                ],
                writeAny: [
                    "publicBookingEnabled",
                    "guestBookingAllowed",
                    "currency",
                    "minRentalHours",
                    "maxRentalDays",
                    "minLeadTimeHours",
                    "maxAdvanceDays",
                    "turnaroundBufferMinutes",
                    "lateGraceMinutes",
                ],
            },
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#Field",
                            permissions: {
                                read: "publicBookingEnabled",
                                write: "publicBookingEnabled",
                            },
                            field: {
                                name: "publicBookingEnabled",
                                widget: "#Switch",
                                label: "form.publicBookingEnabledLabel",
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "guestBookingAllowed",
                                write: "guestBookingAllowed",
                            },
                            field: {
                                name: "guestBookingAllowed",
                                widget: "#Switch",
                                label: "form.guestBookingAllowedLabel",
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {read: "currency", write: "currency"},
                            field: {
                                name: "currency",
                                widget: "#ApiSelect",
                                label: "form.currencyLabel",
                                placeholder: "form.currencyPlaceholder",
                                required: true,
                                widgetProps: {
                                    apiUrl: "/api/finance/currency/select",
                                    method: "POST",
                                    pageSize: 50,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "minRentalHours",
                                write: "minRentalHours",
                            },
                            field: {
                                name: "minRentalHours",
                                widget: "#Input",
                                label: "form.minRentalHoursLabel",
                                placeholder: "form.minRentalHoursPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 1, max: 720},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "maxRentalDays",
                                write: "maxRentalDays",
                            },
                            field: {
                                name: "maxRentalDays",
                                widget: "#Input",
                                label: "form.maxRentalDaysLabel",
                                placeholder: "form.maxRentalDaysPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 1, max: 365},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "minLeadTimeHours",
                                write: "minLeadTimeHours",
                            },
                            field: {
                                name: "minLeadTimeHours",
                                widget: "#Input",
                                label: "form.minLeadTimeHoursLabel",
                                placeholder: "form.minLeadTimeHoursPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 0, max: 720},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "maxAdvanceDays",
                                write: "maxAdvanceDays",
                            },
                            field: {
                                name: "maxAdvanceDays",
                                widget: "#Input",
                                label: "form.maxAdvanceDaysLabel",
                                placeholder: "form.maxAdvanceDaysPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 1, max: 730},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "turnaroundBufferMinutes",
                                write: "turnaroundBufferMinutes",
                            },
                            field: {
                                name: "turnaroundBufferMinutes",
                                widget: "#Input",
                                label: "form.turnaroundBufferMinutesLabel",
                                placeholder:
                                    "form.turnaroundBufferMinutesPlaceholder",
                                required: true,
                                widgetProps: {
                                    type: "number",
                                    min: 0,
                                    max: 1440,
                                },
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "lateGraceMinutes",
                                write: "lateGraceMinutes",
                            },
                            field: {
                                name: "lateGraceMinutes",
                                widget: "#Input",
                                label: "form.lateGraceMinutesLabel",
                                placeholder: "form.lateGraceMinutesPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 0, max: 720},
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.paymentSectionTitle"},
            permissions: {
                readAny: [
                    "paymentPolicy",
                    "holdMinutes",
                    "vatRate",
                    "pricesIncludeVat",
                    "freeCancellationHours",
                    "cancellationFeePercent",
                ],
                writeAny: [
                    "paymentPolicy",
                    "holdMinutes",
                    "vatRate",
                    "pricesIncludeVat",
                    "freeCancellationHours",
                    "cancellationFeePercent",
                ],
            },
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#Field",
                            permissions: {
                                read: "paymentPolicy",
                                write: "paymentPolicy",
                            },
                            field: {
                                name: "paymentPolicy",
                                widget: "#SimpleSelect",
                                label: "form.paymentPolicyLabel",
                                placeholder: "form.paymentPolicyPlaceholder",
                                required: true,
                                widgetProps: {
                                    options: paymentPolicyOptions,
                                    className: "grow w-full",
                                },
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "holdMinutes",
                                write: "holdMinutes",
                            },
                            field: {
                                name: "holdMinutes",
                                widget: "#Input",
                                label: "form.holdMinutesLabel",
                                placeholder: "form.holdMinutesPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 5, max: 120},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {read: "vatRate", write: "vatRate"},
                            field: {
                                name: "vatRate",
                                widget: "#Input",
                                label: "form.vatRateLabel",
                                placeholder: "form.vatRatePlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 0, max: 100},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "pricesIncludeVat",
                                write: "pricesIncludeVat",
                            },
                            field: {
                                name: "pricesIncludeVat",
                                widget: "#Switch",
                                label: "form.pricesIncludeVatLabel",
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "freeCancellationHours",
                                write: "freeCancellationHours",
                            },
                            field: {
                                name: "freeCancellationHours",
                                widget: "#Input",
                                label: "form.freeCancellationHoursLabel",
                                placeholder:
                                    "form.freeCancellationHoursPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 0, max: 720},
                            },
                        },
                        {
                            render: "#Field",
                            permissions: {
                                read: "cancellationFeePercent",
                                write: "cancellationFeePercent",
                            },
                            field: {
                                name: "cancellationFeePercent",
                                widget: "#Input",
                                label: "form.cancellationFeePercentLabel",
                                placeholder:
                                    "form.cancellationFeePercentPlaceholder",
                                required: true,
                                widgetProps: {type: "number", min: 0, max: 100},
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
                readAny: ["termsVersion", "termsText"],
                writeAny: ["termsVersion", "termsText"],
            },
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#Field",
                            field: {
                                name: "termsVersion",
                                widget: "#Input",
                                label: "form.termsVersionLabel",
                                placeholder: "form.termsVersionPlaceholder",
                                widgetProps: {
                                    maxLength: RENTAL_TERMS_VERSION_MAX,
                                },
                            },
                            permissions: {
                                read: "termsVersion",
                                write: "termsVersion",
                            },
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "termsText",
                                widget: "#Textarea",
                                label: "form.termsTextLabel",
                                placeholder: "form.termsTextPlaceholder",
                                widgetProps: {
                                    rows: 10,
                                    maxLength: RENTAL_TERMS_TEXT_MAX,
                                    className:
                                        "field-sizing-fixed max-h-96 min-h-40 overflow-y-auto",
                                },
                            },
                            permissions: {
                                read: "termsText",
                                write: "termsText",
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.notificationsSectionTitle"},
            permissions: {readAny: ["notifyUsers"], writeAny: ["notifyUsers"]},
            children: [
                {
                    render: "#Field",
                    field: {
                        name: "notifyUsers",
                        widget: "#ObjectIdChipsInput",
                        label: "form.notifyUsersLabel",
                        widgetProps: {
                            apiUrl: "/api/company/users/select",
                            method: "POST",
                            placeholderKey: "form.selectUser",
                            removeTooltipKey: "form.removeUser",
                            selectPageSizeCreate: 50,
                            selectPageSizeEdit: 200,
                            labelRefFormExtraKey: "notifyUsers",
                        },
                    },
                    permissions: {read: "notifyUsers", write: "notifyUsers"},
                },
            ],
        },
    ],
};

export const carRentalConfigViews: ViewConfig[] = [carRentalConfigEditFormView];
