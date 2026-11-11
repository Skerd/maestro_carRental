import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_COLOR_MAX,
    VEHICLE_IMAGES_MAX,
    VEHICLE_MAKE_MAX,
    VEHICLE_MODEL_MAX,
    VEHICLE_NOTES_MAX,
    VEHICLE_PLATE_MAX,
    VEHICLE_VIDEOS_MAX,
    VEHICLE_VIN_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

export const vehicleSheetView: ViewConfig = {
    model: "vehicles",
    viewType: "sheet",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    header: {
        titleField: "plate",
        subtitleKey: "vehicleSubtitle",
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
                            permissions: {read: "plate"},
                            field: {
                                name: "plate",
                                widget: "#DisplayCard",
                                label: "plate",
                                widgetProps: {icon: "#IconLicense"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "make"},
                            field: {
                                name: "make",
                                widget: "#DisplayCard",
                                label: "make",
                                widgetProps: {icon: "#IconCar"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "model"},
                            field: {
                                name: "model",
                                widget: "#DisplayCard",
                                label: "model",
                                widgetProps: {icon: "#IconCar"},
                            },
                        },
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
                            permissions: {read: "homeLocation"},
                            field: {
                                name: "homeLocation.name",
                                widget: "#DisplayCard",
                                label: "homeLocation",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    linkedRefPath: "homeLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "currentLocation"},
                            field: {
                                name: "currentLocation.name",
                                widget: "#DisplayCard",
                                label: "currentLocation",
                                widgetProps: {
                                    icon: "#IconMapPinFilled",
                                    linkedRefPath: "currentLocation",
                                    linkedSheetModel: "rentallocations",
                                    linkedSheetWidget:
                                        "#RentalLocationSheetView",
                                    linkedSheetEntityProp: "rentalLocation",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "readiness"},
                            field: {
                                name: "readiness",
                                widget: "#DisplayCard",
                                label: "readiness",
                                widgetProps: {
                                    icon: "#IconSparkles",
                                    type: "enum",
                                    languageKeyCategory: "readinessValues",
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
                            permissions: {read: "year"},
                            field: {
                                name: "year",
                                widget: "#DisplayCard",
                                label: "year",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "color"},
                            field: {
                                name: "color",
                                widget: "#DisplayCard",
                                label: "color",
                                widgetProps: {icon: "#IconPalette"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "odometerKm"},
                            field: {
                                name: "odometerKm",
                                widget: "#DisplayCard",
                                label: "odometerKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "vin"},
                            field: {
                                name: "vin",
                                widget: "#DisplayCard",
                                label: "vin",
                                widgetProps: {icon: "#Hash"},
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
        {
            render: "#SheetGroup",
            permissions: {
                readAny: [
                    "nextServiceDueAt",
                    "nextServiceDueKm",
                    "acquiredAt",
                    "purchasePrice",
                ],
            },
            props: {title: "fleet"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "nextServiceDueAt"},
                            field: {
                                name: "nextServiceDueAt",
                                widget: "#DisplayCard",
                                label: "nextServiceDueAt",
                                widgetProps: {
                                    icon: "#IconTool",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "nextServiceDueKm"},
                            field: {
                                name: "nextServiceDueKm",
                                widget: "#DisplayCard",
                                label: "nextServiceDueKm",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "acquiredAt"},
                            field: {
                                name: "acquiredAt",
                                widget: "#DisplayCard",
                                label: "acquiredAt",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "purchasePrice"},
                            field: {
                                name: "purchasePrice",
                                widget: "#DisplayCard",
                                label: "purchasePrice",
                                widgetProps: {
                                    icon: "#IconCash",
                                    format: "locale",
                                    valuePath: ["currency.symbol", "purchasePrice"],
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
                            permissions: {read: "trackerId"},
                            field: {
                                name: "trackerId",
                                widget: "#DisplayCard",
                                label: "trackerId",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    type: "text",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "lastLatitude"},
                            field: {
                                name: "lastLatitude",
                                widget: "#DisplayCard",
                                label: "lastLatitude",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "lastLongitude"},
                            field: {
                                name: "lastLongitude",
                                widget: "#DisplayCard",
                                label: "lastLongitude",
                                widgetProps: {
                                    icon: "#IconMapPin",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "lastReportedAt"},
                            field: {
                                name: "lastReportedAt",
                                widget: "#DisplayCard",
                                label: "lastReportedAt",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    format: "date",
                                    type: "date",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "images"},
            permissions: {readAny: ["images", "videos"]},
            children: [
                {
                    render: "div",
                    props: {className: "max-w-full"},
                    children: [
                        {
                            render: "#GalleryCarousel",
                            permissions: {readAny: ["images", "videos"]},
                            field: {
                                name: "images",
                                widget: "#GalleryCarousel",
                                widgetProps: {
                                    imageGalleryField: "images",
                                    videoGalleryField: "videos",
                                    showThumbnails: false,
                                    allowFullScreen: false,
                                    coverAfterFirst: false,
                                    showPreviews: true,
                                    previewLocation: "right",
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

const statusOptions = ["active", "maintenance", "retired"].map((value) => ({
    value,
    label: `form.status.${value}`,
}));

const vehicleCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.vehicleSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "plate",
                            widget: "#Input",
                            label: "form.plateLabel",
                            placeholder: "form.platePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_PLATE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "make",
                            widget: "#Input",
                            label: "form.makeLabel",
                            placeholder: "form.makePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MAKE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "model",
                            widget: "#Input",
                            label: "form.modelLabel",
                            placeholder: "form.modelPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MODEL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "year",
                            widget: "#Input",
                            label: "form.yearLabel",
                            placeholder: "form.yearPlaceholder",
                            widgetProps: {type: "number", min: 1950, max: 2100},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "color",
                            widget: "#Input",
                            label: "form.colorLabel",
                            placeholder: "form.colorPlaceholder",
                            widgetProps: {maxLength: VEHICLE_COLOR_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "vin",
                            widget: "#Input",
                            label: "form.vinLabel",
                            placeholder: "form.vinPlaceholder",
                            widgetProps: {maxLength: VEHICLE_VIN_MAX},
                        },
                    },
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
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "notes",
                    widget: "#Textarea",
                    label: "form.notesLabel",
                    placeholder: "form.notesPlaceholder",
                    widgetProps: {
                        rows: 4,
                        maxLength: VEHICLE_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.fleetSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "homeLocation",
                            widget: "#ApiSelect",
                            label: "form.homeLocationLabel",
                            placeholder: "form.homeLocationPlaceholder",
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
                            name: "odometerKm",
                            widget: "#Input",
                            label: "form.odometerKmLabel",
                            placeholder: "form.odometerKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "acquiredAt",
                            widget: "#DateInput",
                            label: "form.acquiredAtLabel",
                            placeholder: "form.acquiredAtPlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "purchasePrice",
                            widget: "#Input",
                            label: "form.purchasePriceLabel",
                            placeholder: "form.purchasePricePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "trackerId",
                            widget: "#Input",
                            label: "form.trackerIdLabel",
                            placeholder: "form.trackerIdPlaceholder",
                            widgetProps: {maxLength: 64},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.photosSectionTitle"},
        children: [
            {
                render: "#Field",
                field: {
                    name: "images",
                    widget: "#MediaField",
                    label: "form.imagesLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_IMAGES_MAX,
                    },
                },
            },
            {
                render: "#Field",
                field: {
                    name: "videos",
                    widget: "#MediaField",
                    label: "form.videosLabel",
                    widgetProps: {
                        mediaType: "video",
                        mode: "multiple",
                        maxCount: VEHICLE_VIDEOS_MAX,
                    },
                },
            },
        ],
    },
];

const vehicleEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.vehicleSectionTitle"},
        permissions: {
            readAny: [
                "plate",
                "make",
                "model",
                "year",
                "color",
                "vin",
                "category",
                "notes",
            ],
            writeAny: [
                "plate",
                "make",
                "model",
                "year",
                "color",
                "vin",
                "category",
                "notes",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "plate", write: "plate"},
                        field: {
                            name: "plate",
                            widget: "#Input",
                            label: "form.plateLabel",
                            placeholder: "form.platePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_PLATE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "make", write: "make"},
                        field: {
                            name: "make",
                            widget: "#Input",
                            label: "form.makeLabel",
                            placeholder: "form.makePlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MAKE_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "model", write: "model"},
                        field: {
                            name: "model",
                            widget: "#Input",
                            label: "form.modelLabel",
                            placeholder: "form.modelPlaceholder",
                            required: true,
                            widgetProps: {maxLength: VEHICLE_MODEL_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "year", write: "year"},
                        field: {
                            name: "year",
                            widget: "#Input",
                            label: "form.yearLabel",
                            placeholder: "form.yearPlaceholder",
                            widgetProps: {type: "number", min: 1950, max: 2100},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "color", write: "color"},
                        field: {
                            name: "color",
                            widget: "#Input",
                            label: "form.colorLabel",
                            placeholder: "form.colorPlaceholder",
                            widgetProps: {maxLength: VEHICLE_COLOR_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "vin", write: "vin"},
                        field: {
                            name: "vin",
                            widget: "#Input",
                            label: "form.vinLabel",
                            placeholder: "form.vinPlaceholder",
                            widgetProps: {maxLength: VEHICLE_VIN_MAX},
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
                            required: true,
                            widgetProps: {
                                apiUrl: "/api/carRental/vehicleCategory/select",
                                method: "POST",
                                pageSize: 50,
                                normalizeEmptyToUndefined: true,
                            },
                        },
                    },
                ],
            },
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
                        maxLength: VEHICLE_NOTES_MAX,
                        className:
                            "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.fleetSectionTitle"},
        permissions: {
            readAny: [
                "homeLocation",
                "status",
                "odometerKm",
                "acquiredAt",
                "purchasePrice",
                "trackerId",
            ],
            writeAny: [
                "homeLocation",
                "status",
                "odometerKm",
                "acquiredAt",
                "purchasePrice",
                "trackerId",
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
                            read: "homeLocation",
                            write: "homeLocation",
                        },
                        field: {
                            name: "homeLocation",
                            widget: "#ApiSelect",
                            label: "form.homeLocationLabel",
                            placeholder: "form.homeLocationPlaceholder",
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
                        permissions: {read: "odometerKm", write: "odometerKm"},
                        field: {
                            name: "odometerKm",
                            widget: "#Input",
                            label: "form.odometerKmLabel",
                            placeholder: "form.odometerKmPlaceholder",
                            widgetProps: {type: "number", min: 0},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "acquiredAt", write: "acquiredAt"},
                        field: {
                            name: "acquiredAt",
                            widget: "#DateInput",
                            label: "form.acquiredAtLabel",
                            placeholder: "form.acquiredAtPlaceholder",
                            widgetProps: {valueFormat: "YYYY-MM-DD"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "purchasePrice",
                            write: "purchasePrice",
                        },
                        field: {
                            name: "purchasePrice",
                            widget: "#Input",
                            label: "form.purchasePriceLabel",
                            placeholder: "form.purchasePricePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "0.01"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "trackerId", write: "trackerId"},
                        field: {
                            name: "trackerId",
                            widget: "#Input",
                            label: "form.trackerIdLabel",
                            placeholder: "form.trackerIdPlaceholder",
                            widgetProps: {maxLength: 64},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.photosSectionTitle"},
        permissions: {
            readAny: ["images", "videos"],
            writeAny: ["images", "videos"],
        },
        children: [
            {
                render: "#Field",
                permissions: {read: "images", write: "images"},
                field: {
                    name: "images",
                    widget: "#MediaField",
                    label: "form.imagesLabel",
                    widgetProps: {
                        mediaType: "image",
                        mode: "multiple",
                        maxCount: VEHICLE_IMAGES_MAX,
                    },
                },
            },
            {
                render: "#Field",
                permissions: {read: "videos", write: "videos"},
                field: {
                    name: "videos",
                    widget: "#MediaField",
                    label: "form.videosLabel",
                    widgetProps: {
                        mediaType: "video",
                        mode: "multiple",
                        maxCount: VEHICLE_VIDEOS_MAX,
                    },
                },
            },
        ],
    },
];

export const vehicleCreateFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    method: "PUT",
    nodes: vehicleCreateFormNodes,
};

export const vehicleEditFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicles",
    apiUrl: "/api/carRental/vehicle",
    method: "PATCH",
    nodes: vehicleEditFormNodes,
};

export const vehicleViews: ViewConfig[] = [
    vehicleSheetView,
    vehicleCreateFormView,
    vehicleEditFormView,
];
