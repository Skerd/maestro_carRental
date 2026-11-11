import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    RENTAL_REVIEW_AUTHOR_NAME_MAX,
    RENTAL_REVIEW_COMMENT_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/rentalReview/rentalReview.schema-def";

const API_URL = "/api/carRental/rentalReview";

export const rentalReviewSheetView: ViewConfig = {
    model: "rentalreviews",
    viewType: "sheet",
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

const rentalReviewCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.reviewSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "reservation",
                    widget: "#ApiSelect",
                    label: "form.reservationLabel",
                    placeholder: "form.reservationPlaceholder",
                    required: true,
                    widgetProps: {
                        apiUrl: "/api/carRental/rentalReservation/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "rating",
                            widget: "#Input",
                            label: "form.ratingLabel",
                            placeholder: "form.ratingPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 1, max: 5, step: 1},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "authorName",
                            widget: "#Input",
                            label: "form.authorNameLabel",
                            placeholder: "form.authorNamePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_REVIEW_AUTHOR_NAME_MAX},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "comment",
                    widget: "#Textarea",
                    label: "form.commentLabel",
                    placeholder: "form.commentPlaceholder",
                    widgetProps: {rows: 3, maxLength: RENTAL_REVIEW_COMMENT_MAX},
                },
            },
        ],
    },
];

const rentalReviewEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.reviewSectionTitle"},
        permissions: {readAny: ["reservation", "rating", "authorName", "comment"], writeAny: ["reservation", "rating", "authorName", "comment"]},
        children: [
            {
                render: "#Field",
                permissions: {read: "reservation", write: "reservation"},
                field: {
                    name: "reservation",
                    widget: "#ApiSelect",
                    label: "form.reservationLabel",
                    placeholder: "form.reservationPlaceholder",
                    required: true,
                    widgetProps: {
                        apiUrl: "/api/carRental/rentalReservation/select",
                        method: "POST",
                        pageSize: 50,
                        normalizeEmptyToUndefined: true,
                    },
                },
            },
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "rating", write: "rating"},
                        field: {
                            name: "rating",
                            widget: "#Input",
                            label: "form.ratingLabel",
                            placeholder: "form.ratingPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 1, max: 5, step: 1},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "authorName", write: "authorName"},
                        field: {
                            name: "authorName",
                            widget: "#Input",
                            label: "form.authorNameLabel",
                            placeholder: "form.authorNamePlaceholder",
                            required: true,
                            widgetProps: {maxLength: RENTAL_REVIEW_AUTHOR_NAME_MAX},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                permissions: {read: "comment", write: "comment"},
                field: {
                    name: "comment",
                    widget: "#Textarea",
                    label: "form.commentLabel",
                    placeholder: "form.commentPlaceholder",
                    widgetProps: {rows: 3, maxLength: RENTAL_REVIEW_COMMENT_MAX},
                },
            },
        ],
    },
];

export const rentalReviewCreateFormView: ViewConfig = {
    model: "rentalreviews",
    viewType: "form",
    viewMode: "create",
    accessModel: "rentalreviews",
    apiUrl: API_URL,
    method: "PUT",
    nodes: rentalReviewCreateFormNodes,
};

export const rentalReviewEditFormView: ViewConfig = {
    model: "rentalreviews",
    viewType: "form",
    viewMode: "edit",
    accessModel: "rentalreviews",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: rentalReviewEditFormNodes,
};

export const rentalReviewViews: ViewConfig[] = [
    rentalReviewSheetView,
    rentalReviewCreateFormView,
    rentalReviewEditFormView,
];
