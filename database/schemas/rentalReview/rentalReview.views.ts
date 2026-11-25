import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";

const API_URL = "/api/carRental/rentalReview";

export const rentalReviewSheetView: ViewConfig = {
    model: "rentalreviews",
    viewType: "sheet",
    sheetWidget: "#RentalReviewSheetView",
    accessModel: "rentalreviews",
    apiUrl: API_URL,
    header: {
        titleField: "authorName",
        subtitleKey: "rentalReviewSubtitle",
        showCloseButton: true,
    },
    nodes: [
        // The platform hid it after a report (D191): staff still see it, and why the public no longer does.
        {
            render: "#SheetGroup",
            dependent: "hiddenByPlatform",
            props: {title: "hiddenByPlatform", titleIcon: "#IconEyeOff", accent: "danger", defaultOpen: true},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 1},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "hiddenByPlatform"},
                            field: {
                                name: "hiddenByPlatform",
                                widget: "#DisplayCard",
                                label: "hiddenByPlatformNote",
                                widgetProps: {icon: "#IconEyeOff", dontRenderValue: true},
                            },
                        },
                    ],
                },
            ],
        },
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
                            permissions: {read: "reservation"},
                            field: {
                                name: "reservation.number",
                                widget: "#DisplayCard",
                                label: "reservation",
                                widgetProps: {
                                    icon: "#IconCalendarEvent",
                                    linkedRefPath: "reservation",
                                    linkedSheetModel: "rentalreservations",
                                    linkedSheetWidget: "#RentalReservationSheetView",
                                    linkedSheetEntityProp: "rentalReservation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "rating"},
                            field: {
                                name: "rating",
                                widget: "#DisplayCard",
                                label: "rating",
                                widgetProps: {
                                    icon: "#IconStar",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "authorName"},
                            field: {
                                name: "authorName",
                                widget: "#DisplayCard",
                                label: "authorName",
                                widgetProps: {icon: "#IconUser"},
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
                            dependent: "comment",
                            permissions: {read: "comment"},
                            field: {
                                name: "comment",
                                widget: "#DisplayCard",
                                label: "comment",
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

/** No create or edit form: the customer writes the review from their booking's manage link and it shows at once (D191). */
export const rentalReviewViews: ViewConfig[] = [rentalReviewSheetView];
