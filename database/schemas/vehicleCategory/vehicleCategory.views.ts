import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_CATEGORY_DESCRIPTION_MAX,
    VEHICLE_CATEGORY_FEATURE_MAX,
    VEHICLE_CATEGORY_NAME_MAX,
    VEHICLE_CATEGORY_SLUG_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";

const API_URL = "/api/carRental/vehicleCategory";

export const vehicleCategorySheetView: ViewConfig = {
    model: "vehiclecategories",
    viewType: "sheet",
    accessModel: "vehiclecategories",
    apiUrl: API_URL,
    header: {
        titleField: "name",
        subtitleKey: "vehicleCategorySubtitle",
        showCloseButton: true,
    },
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#DisplayCard",
                    permissions: {readAny: ["images", "videos"]},
                    field: {
                        name: "images",
                        widget: "#GalleryCarousel",
                        label: "images",
                        widgetProps: {
                            icon: "#IconPhoto",
                            imageGalleryField: "images",
                            videoGalleryField: "videos",
                            showThumbnails: false,
                            allowFullScreen: false,
                            coverAfterFirst: false,
                        },
                    },
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "slug"},
                            field: {
                                name: "slug",
                                widget: "#DisplayCard",
                                label: "slug",
                                widgetProps: {icon: "#Hash"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "seats"},
                            field: {
                                name: "seats",
                                widget: "#DisplayCard",
                                label: "seats",
                                widgetProps: {
                                    icon: "#IconArmchair",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "doors"},
                            field: {
                                name: "doors",
                                widget: "#DisplayCard",
                                label: "doors",
                                widgetProps: {
                                    icon: "#IconDoor",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "luggage"},
                            field: {
                                name: "luggage",
                                widget: "#DisplayCard",
                                label: "luggage",
                                widgetProps: {
                                    icon: "#IconLuggage",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "transmission"},
                            field: {
                                name: "transmission",
                                widget: "#DisplayCard",
                                label: "transmission",
                                widgetProps: {
                                    icon: "#IconManualGearbox",
                                    type: "enum",
                                    languageKeyCategory: "transmissionValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "fuelType"},
                            field: {
                                name: "fuelType",
                                widget: "#DisplayCard",
                                label: "fuelType",
                                widgetProps: {
                                    icon: "#IconGasStation",
                                    type: "enum",
                                    languageKeyCategory: "fuelTypeValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "isPublic"},
                            field: {
                                name: "isPublic",
                                widget: "#DisplayCard",
                                label: "isPublic",
                                widgetProps: {
                                    icon: "#IconWorld",
                                    type: "boolean",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "sortOrder"},
                            field: {
                                name: "sortOrder",
                                widget: "#DisplayCard",
                                label: "sortOrder",
                                widgetProps: {icon: "#Hash", type: "number"},
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "minDriverAge"},
                            field: {
                                name: "minDriverAge",
                                widget: "#DisplayCard",
                                label: "minDriverAge",
                                widgetProps: {
                                    icon: "#IconUser",
                                    type: "number",
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
                {
                    render: "#DisplayCard",
                    permissions: {read: "features"},
                    field: {
                        name: "features",
                        widget: "#DisplayCard",
                        label: "features",
                        widgetProps: {icon: "#IconListCheck"},
                    },
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "pricing"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {
                            render: "#DisplayCard",
                            permissions: {read: "dailyRate"},
                            field: {
                                name: "dailyRate",
                                widget: "#DisplayCard",
                                label: "dailyRate",
                                widgetProps: {
                                    icon: "#IconCash",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "weekendDailyRate"},
                            field: {
                                name: "weekendDailyRate",
                                widget: "#DisplayCard",
                                label: "weekendDailyRate",
                                widgetProps: {
                                    icon: "#IconCalendarWeek",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "weeklyRate"},
                            field: {
                                name: "weeklyRate",
                                widget: "#DisplayCard",
                                label: "weeklyRate",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "depositAmount"},
                            field: {
                                name: "depositAmount",
                                widget: "#DisplayCard",
                                label: "depositAmount",
                                widgetProps: {
                                    icon: "#IconShieldLock",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "mileagePolicy"},
                            field: {
                                name: "mileagePolicy",
                                widget: "#DisplayCard",
                                label: "mileagePolicy",
                                widgetProps: {
                                    icon: "#IconRoad",
                                    type: "enum",
                                    languageKeyCategory: "mileagePolicyValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "includedKmPerDay"},
                            field: {
                                name: "includedKmPerDay",
                                widget: "#DisplayCard",
                                label: "includedKmPerDay",
                                widgetProps: {
                                    icon: "#IconGauge",
                                    type: "number",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            permissions: {read: "extraKmPrice"},
                            field: {
                                name: "extraKmPrice",
                                widget: "#DisplayCard",
                                label: "extraKmPrice",
                                widgetProps: {
                                    icon: "#IconCash",
                                    type: "number",
                                },
                            },
                        },
                    ],
                },
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "rateSeasons"},
            dependent: "rateSeasons",
            permissions: {read: "rateSeasons"},
            children: [
                {
                    render: "#SheetEmbeddedItemsList",
                    permissions: {read: "rateSeasons"},
                    field: {
                        name: "rateSeasons",
                        widget: "#SheetEmbeddedItemsList",
                        widgetProps: {
                            cardColumns: 3,
                            fields: [
                                {
                                    name: "startDate",
                                    type: "text",
                                    labelKey: "startDate",
                                    className: "text-sm font-medium",
                                },
                                {
                                    name: "endDate",
                                    type: "text",
                                    labelKey: "endDate",
                                    className: "text-sm",
                                },
                                {
                                    name: "dailyRate",
                                    type: "text",
                                    labelKey: "dailyRate",
                                    className: "text-sm",
                                },
                            ],
                            compactSummaryFields: [
                                "startDate",
                                "endDate",
                                "dailyRate",
                            ],
                            compactSummaryJoinSeparator: " · ",
                        },
                    },
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const transmissionOptions = [
    {value: "manual", label: "form.transmission.manual"},
    {value: "automatic", label: "form.transmission.automatic"},
];
const fuelTypeOptions = ["petrol", "diesel", "hybrid", "electric", "other"].map(
    (value) => ({value, label: `form.fuelType.${value}`}),
);
const mileagePolicyOptions = [
    {value: "unlimited", label: "form.mileagePolicy.unlimited"},
    {value: "limited", label: "form.mileagePolicy.limited"},
];

const vehicleCategoryCreateFormNodes: ViewConfig["nodes"] = [
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
                    widgetProps: {maxLength: VEHICLE_CATEGORY_NAME_MAX},
                },
            },
            {
                render: "#Field",
                field: {
                    name: "slug",
                    widget: "#Input",
                    label: "form.slugLabel",
                    placeholder: "form.slugPlaceholder",
                    required: true,
                    widgetProps: {maxLength: VEHICLE_CATEGORY_SLUG_MAX},
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
                rows: 5,
                maxLength: VEHICLE_CATEGORY_DESCRIPTION_MAX,
                className:
                    "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
            },
        },
    },
    {
        render: "#Field",
        field: {
            name: "images",
            widget: "#MediaField",
            label: "form.imagesLabel",
            widgetProps: {mediaType: "image", mode: "multiple", maxCount: 12},
        },
    },
    {
        render: "#Field",
        field: {
            name: "videos",
            widget: "#MediaField",
            label: "form.videosLabel",
            widgetProps: {mediaType: "video", mode: "multiple", maxCount: 3},
        },
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.specsSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "seats",
                            widget: "#Input",
                            label: "form.seatsLabel",
                            placeholder: "form.seatsPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 1, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "doors",
                            widget: "#Input",
                            label: "form.doorsLabel",
                            placeholder: "form.doorsPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "luggage",
                            widget: "#Input",
                            label: "form.luggageLabel",
                            placeholder: "form.luggagePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "transmission",
                            widget: "#SimpleSelect",
                            label: "form.transmissionLabel",
                            placeholder: "form.transmissionPlaceholder",
                            required: true,
                            widgetProps: {
                                options: transmissionOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "fuelType",
                            widget: "#SimpleSelect",
                            label: "form.fuelTypeLabel",
                            placeholder: "form.fuelTypePlaceholder",
                            required: true,
                            widgetProps: {
                                options: fuelTypeOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "minDriverAge",
                            widget: "#Input",
                            label: "form.minDriverAgeLabel",
                            placeholder: "form.minDriverAgePlaceholder",
                            widgetProps: {type: "number", min: 16, step: "any"},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "features",
                    widget: "#StringArrayInput",
                    label: "form.featuresLabel",
                    placeholder: "form.featuresPlaceholder",
                    widgetProps: {
                        removeTooltipKey: "form.removeFeature",
                        maxLength: VEHICLE_CATEGORY_FEATURE_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.pricingSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "dailyRate",
                            widget: "#Input",
                            label: "form.dailyRateLabel",
                            placeholder: "form.dailyRatePlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "weekendDailyRate",
                            widget: "#Input",
                            label: "form.weekendDailyRateLabel",
                            placeholder: "form.weekendDailyRatePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "weeklyRate",
                            widget: "#Input",
                            label: "form.weeklyRateLabel",
                            placeholder: "form.weeklyRatePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "depositAmount",
                            widget: "#Input",
                            label: "form.depositAmountLabel",
                            placeholder: "form.depositAmountPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "mileagePolicy",
                            widget: "#SimpleSelect",
                            label: "form.mileagePolicyLabel",
                            placeholder: "form.mileagePolicyPlaceholder",
                            required: true,
                            widgetProps: {
                                options: mileagePolicyOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "mileagePolicy", whenValues: ["limited"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "includedKmPerDay",
                                    widget: "#Input",
                                    label: "form.includedKmPerDayLabel",
                                    placeholder:
                                        "form.includedKmPerDayPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        step: "any",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "extraKmPrice",
                                    widget: "#Input",
                                    label: "form.extraKmPriceLabel",
                                    placeholder: "form.extraKmPricePlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        step: "any",
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                render: "#Field",
                field: {
                    name: "rateSeasons",
                    widget: "#FormRepeater",
                    widgetProps: {
                        title: "form.rateSeasonsSectionTitle",
                        arrayField: "rateSeasons",
                        defaultItem: {startDate: "", endDate: "", dailyRate: 0},
                        addLabel: "form.seasonAddRow",
                        removeLabel: "form.seasonRemoveRow",
                        rowTitleFields: ["startDate", "endDate", "dailyRate"],
                        rowTitleSeparators: [" – ", " · "],
                        rowTitlePlaceholder: "form.seasonRowTitle",
                        rowTemplate: [
                            {
                                render: "#FormGrid",
                                props: {columns: 3},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "startDate",
                                            widget: "#DateInput",
                                            label: "form.seasonStartLabel",
                                            required: true,
                                            widgetProps: {
                                                valueFormat: "yyyy-MM-dd",
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "endDate",
                                            widget: "#DateInput",
                                            label: "form.seasonEndLabel",
                                            required: true,
                                            widgetProps: {
                                                valueFormat: "yyyy-MM-dd",
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "dailyRate",
                                            widget: "#Input",
                                            label: "form.seasonDailyRateLabel",
                                            required: true,
                                            widgetProps: {
                                                type: "number",
                                                min: 0,
                                                step: "any",
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        ],
    },
    {
        render: "#Field",
        field: {
            name: "sortOrder",
            widget: "#Input",
            label: "form.sortOrderLabel",
            placeholder: "form.sortOrderPlaceholder",
            widgetProps: {type: "number", min: 0, step: "any"},
        },
    },
];

const vehicleCategoryEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#FormGrid",
        props: {columns: 2},
        permissions: {readAny: ["name", "slug"], writeAny: ["name", "slug"]},
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
                    widgetProps: {maxLength: VEHICLE_CATEGORY_NAME_MAX},
                },
            },
            {
                render: "#Field",
                permissions: {read: "slug", write: "slug"},
                field: {
                    name: "slug",
                    widget: "#Input",
                    label: "form.slugLabel",
                    placeholder: "form.slugPlaceholder",
                    required: true,
                    widgetProps: {maxLength: VEHICLE_CATEGORY_SLUG_MAX},
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
                rows: 5,
                maxLength: VEHICLE_CATEGORY_DESCRIPTION_MAX,
                className:
                    "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto",
            },
        },
    },
    {
        render: "#Field",
        permissions: {read: "images", write: "images"},
        field: {
            name: "images",
            widget: "#MediaField",
            label: "form.imagesLabel",
            widgetProps: {mediaType: "image", mode: "multiple", maxCount: 12},
        },
    },
    {
        render: "#Field",
        permissions: {read: "videos", write: "videos"},
        field: {
            name: "videos",
            widget: "#MediaField",
            label: "form.videosLabel",
            widgetProps: {mediaType: "video", mode: "multiple", maxCount: 3},
        },
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.specsSectionTitle"},
        permissions: {
            readAny: [
                "seats",
                "doors",
                "luggage",
                "transmission",
                "fuelType",
                "minDriverAge",
                "features",
            ],
            writeAny: [
                "seats",
                "doors",
                "luggage",
                "transmission",
                "fuelType",
                "minDriverAge",
                "features",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "seats", write: "seats"},
                        field: {
                            name: "seats",
                            widget: "#Input",
                            label: "form.seatsLabel",
                            placeholder: "form.seatsPlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 1, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "doors", write: "doors"},
                        field: {
                            name: "doors",
                            widget: "#Input",
                            label: "form.doorsLabel",
                            placeholder: "form.doorsPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "luggage", write: "luggage"},
                        field: {
                            name: "luggage",
                            widget: "#Input",
                            label: "form.luggageLabel",
                            placeholder: "form.luggagePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "transmission",
                            write: "transmission",
                        },
                        field: {
                            name: "transmission",
                            widget: "#SimpleSelect",
                            label: "form.transmissionLabel",
                            placeholder: "form.transmissionPlaceholder",
                            required: true,
                            widgetProps: {
                                options: transmissionOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "fuelType", write: "fuelType"},
                        field: {
                            name: "fuelType",
                            widget: "#SimpleSelect",
                            label: "form.fuelTypeLabel",
                            placeholder: "form.fuelTypePlaceholder",
                            required: true,
                            widgetProps: {
                                options: fuelTypeOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "minDriverAge",
                            write: "minDriverAge",
                        },
                        field: {
                            name: "minDriverAge",
                            widget: "#Input",
                            label: "form.minDriverAgeLabel",
                            placeholder: "form.minDriverAgePlaceholder",
                            widgetProps: {type: "number", min: 16, step: "any"},
                        },
                    },
                ],
            },
            {
                render: "#Field",
                permissions: {read: "features", write: "features"},
                field: {
                    name: "features",
                    widget: "#StringArrayInput",
                    label: "form.featuresLabel",
                    placeholder: "form.featuresPlaceholder",
                    widgetProps: {
                        removeTooltipKey: "form.removeFeature",
                        maxLength: VEHICLE_CATEGORY_FEATURE_MAX,
                    },
                },
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.pricingSectionTitle"},
        permissions: {
            readAny: [
                "dailyRate",
                "weekendDailyRate",
                "weeklyRate",
                "depositAmount",
                "mileagePolicy",
                "includedKmPerDay",
                "extraKmPrice",
                "rateSeasons",
            ],
            writeAny: [
                "dailyRate",
                "weekendDailyRate",
                "weeklyRate",
                "depositAmount",
                "mileagePolicy",
                "includedKmPerDay",
                "extraKmPrice",
                "rateSeasons",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 3},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "dailyRate", write: "dailyRate"},
                        field: {
                            name: "dailyRate",
                            widget: "#Input",
                            label: "form.dailyRateLabel",
                            placeholder: "form.dailyRatePlaceholder",
                            required: true,
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "weekendDailyRate",
                            write: "weekendDailyRate",
                        },
                        field: {
                            name: "weekendDailyRate",
                            widget: "#Input",
                            label: "form.weekendDailyRateLabel",
                            placeholder: "form.weekendDailyRatePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "weeklyRate", write: "weeklyRate"},
                        field: {
                            name: "weeklyRate",
                            widget: "#Input",
                            label: "form.weeklyRateLabel",
                            placeholder: "form.weeklyRatePlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "depositAmount",
                            write: "depositAmount",
                        },
                        field: {
                            name: "depositAmount",
                            widget: "#Input",
                            label: "form.depositAmountLabel",
                            placeholder: "form.depositAmountPlaceholder",
                            widgetProps: {type: "number", min: 0, step: "any"},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {
                            read: "mileagePolicy",
                            write: "mileagePolicy",
                        },
                        field: {
                            name: "mileagePolicy",
                            widget: "#SimpleSelect",
                            label: "form.mileagePolicyLabel",
                            placeholder: "form.mileagePolicyPlaceholder",
                            required: true,
                            widgetProps: {
                                options: mileagePolicyOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "mileagePolicy", whenValues: ["limited"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                permissions: {
                                    read: "includedKmPerDay",
                                    write: "includedKmPerDay",
                                },
                                field: {
                                    name: "includedKmPerDay",
                                    widget: "#Input",
                                    label: "form.includedKmPerDayLabel",
                                    placeholder:
                                        "form.includedKmPerDayPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        step: "any",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                permissions: {
                                    read: "extraKmPrice",
                                    write: "extraKmPrice",
                                },
                                field: {
                                    name: "extraKmPrice",
                                    widget: "#Input",
                                    label: "form.extraKmPriceLabel",
                                    placeholder: "form.extraKmPricePlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        step: "any",
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                render: "#Field",
                permissions: {read: "rateSeasons", write: "rateSeasons"},
                field: {
                    name: "rateSeasons",
                    widget: "#FormRepeater",
                    widgetProps: {
                        title: "form.rateSeasonsSectionTitle",
                        arrayField: "rateSeasons",
                        defaultItem: {startDate: "", endDate: "", dailyRate: 0},
                        addLabel: "form.seasonAddRow",
                        removeLabel: "form.seasonRemoveRow",
                        rowTitleFields: ["startDate", "endDate", "dailyRate"],
                        rowTitleSeparators: [" – ", " · "],
                        rowTitlePlaceholder: "form.seasonRowTitle",
                        rowTemplate: [
                            {
                                render: "#FormGrid",
                                props: {columns: 3},
                                children: [
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "startDate",
                                            widget: "#DateInput",
                                            label: "form.seasonStartLabel",
                                            required: true,
                                            widgetProps: {
                                                valueFormat: "yyyy-MM-dd",
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "endDate",
                                            widget: "#DateInput",
                                            label: "form.seasonEndLabel",
                                            required: true,
                                            widgetProps: {
                                                valueFormat: "yyyy-MM-dd",
                                            },
                                        },
                                    },
                                    {
                                        render: "#Field",
                                        field: {
                                            name: "dailyRate",
                                            widget: "#Input",
                                            label: "form.seasonDailyRateLabel",
                                            required: true,
                                            widgetProps: {
                                                type: "number",
                                                min: 0,
                                                step: "any",
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        ],
    },
    {
        render: "#Field",
        permissions: {read: "sortOrder", write: "sortOrder"},
        field: {
            name: "sortOrder",
            widget: "#Input",
            label: "form.sortOrderLabel",
            placeholder: "form.sortOrderPlaceholder",
            widgetProps: {type: "number", min: 0, step: "any"},
        },
    },
];

export const vehicleCategoryCreateFormView: ViewConfig = {
    model: "vehiclecategories",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehiclecategories",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleCategoryCreateFormNodes,
};

export const vehicleCategoryEditFormView: ViewConfig = {
    model: "vehiclecategories",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehiclecategories",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleCategoryEditFormNodes,
};

export const vehicleCategoryViews: ViewConfig[] = [
    vehicleCategorySheetView,
    vehicleCategoryCreateFormView,
    vehicleCategoryEditFormView,
];
