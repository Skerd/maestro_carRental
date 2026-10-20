import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {RENTAL_TERMS_TEXT_MAX, RENTAL_TERMS_VERSION_MAX} from "armonia/src/modules/carRental/api/carRental/private/carRentalConfig/carRentalConfig.schema-def";

const API_URL = "/api/carRental/carRentalConfig";

const numberField = (name: string, min: number, max: number) => ({
    render: "#Field",
    field: {
        name,
        widget: "#Input",
        label: `form.${name}Label`,
        placeholder: `form.${name}Placeholder`,
        required: true,
        widgetProps: {type: "number", min, max},
    },
    permissions: {read: name, write: name},
});

const switchField = (name: string) => ({
    render: "#Field",
    field: {name, widget: "#Switch", label: `form.${name}Label`},
    permissions: {read: name, write: name},
});

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
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        switchField("publicBookingEnabled"),
                        switchField("guestBookingAllowed"),
                        {
                            render: "#Field",
                            field: {
                                name: "currency",
                                widget: "#ApiSelect",
                                label: "form.currencyLabel",
                                placeholder: "form.currencyPlaceholder",
                                required: true,
                                widgetProps: {apiUrl: "/api/finance/currency/select", method: "POST", pageSize: 50},
                            },
                            permissions: {read: "currency", write: "currency"},
                        },
                        numberField("minRentalHours", 1, 720),
                        numberField("maxRentalDays", 1, 365),
                        numberField("minLeadTimeHours", 0, 720),
                        numberField("maxAdvanceDays", 1, 730),
                        numberField("turnaroundBufferMinutes", 0, 1440),
                        numberField("lateGraceMinutes", 0, 720),
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.paymentSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#Field",
                            field: {
                                name: "paymentPolicy",
                                widget: "#Select",
                                label: "form.paymentPolicyLabel",
                                placeholder: "form.paymentPolicyPlaceholder",
                                required: true,
                                widgetProps: {
                                    options: [
                                        {value: "pay_at_pickup", label: "form.paymentPolicy.pay_at_pickup"},
                                        {value: "prepay_online", label: "form.paymentPolicy.prepay_online"},
                                        {value: "customer_choice", label: "form.paymentPolicy.customer_choice"},
                                    ],
                                    className: "grow w-full",
                                },
                            },
                            permissions: {read: "paymentPolicy", write: "paymentPolicy"},
                        },
                        numberField("holdMinutes", 5, 120),
                        numberField("vatRate", 0, 100),
                        switchField("pricesIncludeVat"),
                        numberField("freeCancellationHours", 0, 720),
                        numberField("cancellationFeePercent", 0, 100),
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
                    props: {columns: 1},
                    children: [
                        {
                            render: "#Field",
                            field: {
                                name: "termsVersion",
                                widget: "#Input",
                                label: "form.termsVersionLabel",
                                placeholder: "form.termsVersionPlaceholder",
                                widgetProps: {maxLength: RENTAL_TERMS_VERSION_MAX},
                            },
                            permissions: {read: "termsVersion", write: "termsVersion"},
                        },
                        {
                            render: "#Field",
                            field: {
                                name: "termsText",
                                widget: "#Textarea",
                                label: "form.termsTextLabel",
                                placeholder: "form.termsTextPlaceholder",
                                widgetProps: {rows: 10, maxLength: RENTAL_TERMS_TEXT_MAX, className: "field-sizing-fixed max-h-96 min-h-40 overflow-y-auto"},
                            },
                            permissions: {read: "termsText", write: "termsText"},
                        },
                    ],
                },
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.notificationsSectionTitle"},
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
