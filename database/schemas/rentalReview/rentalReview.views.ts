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
                        {
                            render: "#DisplayCard",
                            permissions: {read: "isPublished"},
                            field: {
                                name: "isPublished",
                                widget: "#DisplayCard",
                                label: "isPublished",
                                widgetProps: {
                                    icon: "#IconWorld",
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

/** No create or edit form: the customer writes the review from their booking's manage link, staff only publish it. */
export const rentalReviewViews: ViewConfig[] = [rentalReviewSheetView];
