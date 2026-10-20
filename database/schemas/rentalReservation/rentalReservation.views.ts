import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_CONTACT_NAME_MAX,
    RENTAL_CONTACT_PHONE_MAX,
    RENTAL_NOTES_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReservation/rentalReservation.constants";

const API_URL = "/api/carRental/rentalReservation";

export const rentalReservationSheetView: ViewConfig = {
    model: "rentalreservations",
    viewType: "sheet",
    accessModel: "rentalreservations",
    apiUrl: API_URL,
    header: {titleField: "number", subtitleKey: "rentalReservationSubtitle", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#IconStatusChange", type: "enum", languageKeyCategory: "statusValues"}}},
                        {render: "#DisplayCard", permissions: {read: "paymentStatus"}, field: {name: "paymentStatus", widget: "#DisplayCard", label: "paymentStatus", widgetProps: {icon: "#IconCreditCard", type: "enum", languageKeyCategory: "paymentStatusValues"}}},
                        {render: "#DisplayCard", permissions: {read: "paymentChoice"}, field: {name: "paymentChoice", widget: "#DisplayCard", label: "paymentChoice", widgetProps: {icon: "#IconCash", type: "enum", languageKeyCategory: "paymentChoiceValues"}}},
                        {render: "#DisplayCard", permissions: {read: "category"}, field: {name: "category.name", widget: "#DisplayCard", label: "category", widgetProps: {icon: "#IconCategory"}}},
                        {render: "#DisplayCard", permissions: {read: "vehicle"}, field: {name: "vehicle.plate", widget: "#DisplayCard", label: "vehicle", widgetProps: {icon: "#IconCar"}}},
                        {render: "#DisplayCard", permissions: {read: "source"}, field: {name: "source", widget: "#DisplayCard", label: "source", widgetProps: {icon: "#IconWorld", type: "enum", languageKeyCategory: "sourceValues"}}},
                        {render: "#DisplayCard", permissions: {read: "pickupLocation"}, field: {name: "pickupLocation.name", widget: "#DisplayCard", label: "pickupLocation", widgetProps: {icon: "#IconMapPin"}}},
                        {render: "#DisplayCard", permissions: {read: "pickupAt"}, field: {name: "pickupAt", widget: "#DisplayCard", label: "pickupAt", widgetProps: {icon: "#IconCalendarEvent", type: "dateTime"}}},
                        {render: "#DisplayCard", permissions: {read: "holdExpiresAt"}, field: {name: "holdExpiresAt", widget: "#DisplayCard", label: "holdExpiresAt", widgetProps: {icon: "#IconHourglass", type: "dateTime"}}},
                        {render: "#DisplayCard", permissions: {read: "returnLocation"}, field: {name: "returnLocation.name", widget: "#DisplayCard", label: "returnLocation", widgetProps: {icon: "#IconMapPin"}}},
                        {render: "#DisplayCard", permissions: {read: "returnAt"}, field: {name: "returnAt", widget: "#DisplayCard", label: "returnAt", widgetProps: {icon: "#IconCalendarEvent", type: "dateTime"}}},
                        {render: "#DisplayCard", permissions: {read: "customer"}, field: {name: "customer.name", widget: "#DisplayCard", label: "customer", widgetProps: {icon: "#IconUser"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "contact"},
            permissions: {read: "contact"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "contact"}, field: {name: "contact.firstName", widget: "#DisplayCard", label: "firstName", widgetProps: {icon: "#IconUser"}}},
                        {render: "#DisplayCard", permissions: {read: "contact"}, field: {name: "contact.lastName", widget: "#DisplayCard", label: "lastName", widgetProps: {icon: "#IconUser"}}},
                        {render: "#DisplayCard", permissions: {read: "contact"}, field: {name: "contact.email", widget: "#DisplayCard", label: "email", widgetProps: {icon: "#IconMail"}}},
                        {render: "#DisplayCard", permissions: {read: "contact"}, field: {name: "contact.phone", widget: "#DisplayCard", label: "phone", widgetProps: {icon: "#Phone"}}},
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "pricing"},
            permissions: {read: "pricing"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "pricing"}, field: {name: "pricing.rentalDays", widget: "#DisplayCard", label: "rentalDays", widgetProps: {icon: "#IconCalendar", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "pricing"}, field: {name: "pricing.grandTotal", widget: "#DisplayCard", label: "grandTotal", widgetProps: {icon: "#IconCash", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "amountPaid"}, field: {name: "amountPaid", widget: "#DisplayCard", label: "amountPaid", widgetProps: {icon: "#IconCashBanknote", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "pricing"}, field: {name: "pricing.vatAmount", widget: "#DisplayCard", label: "vatAmount", widgetProps: {icon: "#IconReceiptTax", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "pricing"}, field: {name: "pricing.depositAmount", widget: "#DisplayCard", label: "depositAmount", widgetProps: {icon: "#IconShieldLock", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "pricing"}, field: {name: "pricing.currency.abbreviation", widget: "#DisplayCard", label: "currency", widgetProps: {icon: "#IconCurrency"}}},
                    ],
                },
                {
                    render: "#SheetEmbeddedItemsList",
                    permissions: {read: "pricing"},
                    field: {
                        name: "pricing.lines",
                        widget: "#SheetEmbeddedItemsList",
                        widgetProps: {
                            cardColumns: 2,
                            fields: [
                                {name: "label", type: "text", labelKey: "lineLabel", className: "text-sm font-medium"},
                                {name: "quantity", type: "text", labelKey: "quantity", className: "text-sm"},
                                {name: "unitPrice", type: "text", labelKey: "unitPrice", className: "text-sm"},
                                {name: "total", type: "text", labelKey: "total", className: "text-sm"},
                            ],
                            compactSummaryFields: ["label", "total"],
                            compactSummaryJoinSeparator: " · ",
                        },
                    },
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "timeline", defaultOpen: false},
            permissions: {read: "timeline"},
            children: [
                {
                    render: "#SheetEmbeddedItemsList",
                    permissions: {read: "timeline"},
                    field: {
                        name: "timeline",
                        widget: "#SheetEmbeddedItemsList",
                        widgetProps: {
                            cardColumns: 1,
                            sortField: "at",
                            fields: [
                                {name: "event", type: "text", languageKeyCategory: "timelineEvent", labelKey: "event", className: "text-sm font-medium"},
                                {name: "at", type: "text", format: "dateTime", labelKey: "at", className: "text-sm"},
                                {name: "note", type: "text", labelKey: "note", className: "text-sm"},
                            ],
                            compactSummaryFields: ["event", "at"],
                            compactSummaryJoinSeparator: " · ",
                        },
                    },
                },
            ],
        },
        {render: "#DisplayCard", permissions: {read: "notes"}, field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconNotes"}}},
        lifecycleSheetGroup,
    ],
};

/** Staff booking (phone, walk-in). Immutable after create — every change is an action. */
export const rentalReservationCreateFormView: ViewConfig = {
    model: "rentalreservations",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalreservations",
    apiUrl: API_URL,
    method: "PUT",
    nodes: [
        {
            render: "#TitleWithCollapse",
            props: {title: "form.tripSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
                        {render: "#Field", field: {name: "category", widget: "#ApiSelect", label: "form.categoryLabel", placeholder: "form.categoryPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/vehicleCategory/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, cascadeClearFormFields: ["vehicle"]}}},
                        {
                            render: "#Field",
                            field: {
                                name: "vehicle",
                                widget: "#ApiSelect",
                                label: "form.vehicleLabel",
                                placeholder: "form.vehiclePlaceholder",
                                widgetProps: {
                                    apiUrl: "/api/carRental/vehicle/select",
                                    method: "POST",
                                    pageSize: 50,
                                    normalizeEmptyToUndefined: true,
                                    postBodyFromFormFields: [{field: "category", paramName: "category"}],
                                    enableWhenFormFieldsNonEmpty: ["category"],
                                },
                            },
                        },
                        {render: "#Field", field: {name: "pickupLocation", widget: "#ApiSelect", label: "form.pickupLocationLabel", placeholder: "form.pickupLocationPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/rentalLocation/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                        {render: "#Field", field: {name: "returnLocation", widget: "#ApiSelect", label: "form.returnLocationLabel", placeholder: "form.returnLocationPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/rentalLocation/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                        {render: "#Field", field: {name: "pickupDate", widget: "#DateInput", label: "form.pickupDateLabel", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                        {render: "#Field", field: {name: "pickupTime", widget: "#DateInput", label: "form.pickupTimeLabel", required: true, widgetProps: {valueFormat: "HH:mm", timeOnly: true}}},
                        {render: "#Field", field: {name: "returnDate", widget: "#DateInput", label: "form.returnDateLabel", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                        {render: "#Field", field: {name: "returnTime", widget: "#DateInput", label: "form.returnTimeLabel", required: true, widgetProps: {valueFormat: "HH:mm", timeOnly: true}}},
                    ],
                },
                {render: "#FormAlert", props: {message: "form.localTimeHint"}},
            ],
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.contactSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 2},
                    children: [
                        {render: "#Field", field: {name: "contact.firstName", widget: "#Input", label: "form.firstNameLabel", placeholder: "form.firstNamePlaceholder", required: true, widgetProps: {maxLength: RENTAL_CONTACT_NAME_MAX}}},
                        {render: "#Field", field: {name: "contact.lastName", widget: "#Input", label: "form.lastNameLabel", placeholder: "form.lastNamePlaceholder", required: true, widgetProps: {maxLength: RENTAL_CONTACT_NAME_MAX}}},
                        {render: "#Field", field: {name: "contact.email", widget: "#Input", label: "form.emailLabel", placeholder: "form.emailPlaceholder", required: true, widgetProps: {type: "email"}}},
                        {render: "#Field", field: {name: "contact.phone", widget: "#Input", label: "form.phoneLabel", placeholder: "form.phonePlaceholder", required: true, widgetProps: {maxLength: RENTAL_CONTACT_PHONE_MAX}}},
                        {render: "#Field", field: {name: "customer", widget: "#ApiSelect", label: "form.customerLabel", placeholder: "form.customerPlaceholder", widgetProps: {apiUrl: "/api/company/users/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                    ],
                },
            ],
        },
        {
            render: "#Field",
            field: {
                name: "extras",
                widget: "#FormRepeater",
                widgetProps: {
                    title: "form.extrasSectionTitle",
                    arrayField: "extras",
                    defaultItem: {extra: "", quantity: 1},
                    addLabel: "form.extraAddRow",
                    removeLabel: "form.extraRemoveRow",
                    rowTitleFields: ["quantity"],
                    rowTitlePlaceholder: "form.extraRowTitle",
                    rowTemplate: [
                        {
                            render: "#FormGrid",
                            props: {columns: 2},
                            children: [
                                {render: "#Field", field: {name: "extra", widget: "#ApiSelect", label: "form.extraLabel", placeholder: "form.extraPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/rentalExtra/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}}},
                                {render: "#Field", field: {name: "quantity", widget: "#Input", label: "form.quantityLabel", required: true, widgetProps: {type: "number", min: 1, max: 10}}},
                            ],
                        },
                    ],
                },
            },
        },
        {
            render: "#Field",
            field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {rows: 3, maxLength: RENTAL_NOTES_MAX}},
        },
    ],
};

export const rentalReservationViews: ViewConfig[] = [rentalReservationSheetView, rentalReservationCreateFormView];
