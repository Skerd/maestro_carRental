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
    header: {titleField: "name", subtitleKey: "vehicleCategorySubtitle", showCloseButton: true},
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
                        widgetProps: {icon: "#IconPhoto", imageGalleryField: "images", videoGalleryField: "videos", showThumbnails: false, allowFullScreen: false, coverAfterFirst: false},
                    },
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "slug"}, field: {name: "slug", widget: "#DisplayCard", label: "slug", widgetProps: {icon: "#Hash"}}},
                        {render: "#DisplayCard", permissions: {read: "seats"}, field: {name: "seats", widget: "#DisplayCard", label: "seats", widgetProps: {icon: "#IconArmchair", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "doors"}, field: {name: "doors", widget: "#DisplayCard", label: "doors", widgetProps: {icon: "#IconDoor", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "luggage"}, field: {name: "luggage", widget: "#DisplayCard", label: "luggage", widgetProps: {icon: "#IconLuggage", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "transmission"}, field: {name: "transmission", widget: "#DisplayCard", label: "transmission", widgetProps: {icon: "#IconManualGearbox", type: "enum", languageKeyCategory: "transmissionValues"}}},
                        {render: "#DisplayCard", permissions: {read: "fuelType"}, field: {name: "fuelType", widget: "#DisplayCard", label: "fuelType", widgetProps: {icon: "#IconGasStation", type: "enum", languageKeyCategory: "fuelTypeValues"}}},
                        {render: "#DisplayCard", permissions: {read: "isPublic"}, field: {name: "isPublic", widget: "#DisplayCard", label: "isPublic", widgetProps: {icon: "#IconWorld", type: "boolean"}}},
                        {render: "#DisplayCard", permissions: {read: "minDriverAge"}, field: {name: "minDriverAge", widget: "#DisplayCard", label: "minDriverAge", widgetProps: {icon: "#IconUser", type: "number"}}},
                    ],
                },
                {render: "#DisplayCard", permissions: {read: "description"}, field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconAlignLeft"}}},
                {render: "#DisplayCard", permissions: {read: "features"}, field: {name: "features", widget: "#DisplayCard", label: "features", widgetProps: {icon: "#IconListCheck"}}},
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
                        {render: "#DisplayCard", permissions: {read: "dailyRate"}, field: {name: "dailyRate", widget: "#DisplayCard", label: "dailyRate", widgetProps: {icon: "#IconCash", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "weekendDailyRate"}, field: {name: "weekendDailyRate", widget: "#DisplayCard", label: "weekendDailyRate", widgetProps: {icon: "#IconCalendarWeek", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "weeklyRate"}, field: {name: "weeklyRate", widget: "#DisplayCard", label: "weeklyRate", widgetProps: {icon: "#IconCalendar", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "depositAmount"}, field: {name: "depositAmount", widget: "#DisplayCard", label: "depositAmount", widgetProps: {icon: "#IconShieldLock", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "mileagePolicy"}, field: {name: "mileagePolicy", widget: "#DisplayCard", label: "mileagePolicy", widgetProps: {icon: "#IconRoad", type: "enum", languageKeyCategory: "mileagePolicyValues"}}},
                        {render: "#DisplayCard", permissions: {read: "includedKmPerDay"}, field: {name: "includedKmPerDay", widget: "#DisplayCard", label: "includedKmPerDay", widgetProps: {icon: "#IconGauge", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "extraKmPrice"}, field: {name: "extraKmPrice", widget: "#DisplayCard", label: "extraKmPrice", widgetProps: {icon: "#IconCash", type: "number"}}},
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
                                {name: "startDate", type: "text", labelKey: "startDate", className: "text-sm font-medium"},
                                {name: "endDate", type: "text", labelKey: "endDate", className: "text-sm"},
                                {name: "dailyRate", type: "text", labelKey: "dailyRate", className: "text-sm"},
                            ],
                            compactSummaryFields: ["startDate", "endDate", "dailyRate"],
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
const fuelTypeOptions = ["petrol", "diesel", "hybrid", "electric", "other"].map((value) => ({value, label: `form.fuelType.${value}`}));
const mileagePolicyOptions = [
    {value: "unlimited", label: "form.mileagePolicy.unlimited"},
    {value: "limited", label: "form.mileagePolicy.limited"},
];

function vehicleCategoryFormNodes(edit: boolean): ViewConfig["nodes"] {
    const perm = (name: string) => (edit ? {permissions: {read: name, write: name}} : {});
    const number = (name: string, required = false, min = 0) => ({
        render: "#Field",
        ...perm(name),
        field: {name, widget: "#Input", label: `form.${name}Label`, placeholder: `form.${name}Placeholder`, ...(required ? {required: true} : {}), widgetProps: {type: "number", min, step: "any"}},
    });
    return [
        {
            render: "#FormGrid",
            props: {columns: 2},
            children: [
                {render: "#Field", ...perm("name"), field: {name: "name", widget: "#Input", label: "form.nameLabel", placeholder: "form.namePlaceholder", required: true, widgetProps: {maxLength: VEHICLE_CATEGORY_NAME_MAX}}},
                {render: "#Field", ...perm("slug"), field: {name: "slug", widget: "#Input", label: "form.slugLabel", placeholder: "form.slugPlaceholder", required: true, widgetProps: {maxLength: VEHICLE_CATEGORY_SLUG_MAX}}},
            ],
        },
        {
            render: "#Field",
            ...perm("description"),
            field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", widgetProps: {rows: 5, maxLength: VEHICLE_CATEGORY_DESCRIPTION_MAX, className: "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto"}},
        },
        {
            render: "#Field",
            ...perm("images"),
            field: {name: "images", widget: "#MediaField", label: "form.imagesLabel", widgetProps: {mediaType: "image", mode: "multiple", maxCount: 12}},
        },
        {
            render: "#Field",
            ...perm("videos"),
            field: {name: "videos", widget: "#MediaField", label: "form.videosLabel", widgetProps: {mediaType: "video", mode: "multiple", maxCount: 3}},
        },
        {
            render: "#TitleWithCollapse",
            props: {title: "form.specsSectionTitle"},
            children: [
                {
                    render: "#FormGrid",
                    props: {columns: 3},
                    children: [
                        number("seats", true, 1),
                        number("doors"),
                        number("luggage"),
                        {render: "#Field", ...perm("transmission"), field: {name: "transmission", widget: "#Select", label: "form.transmissionLabel", placeholder: "form.transmissionPlaceholder", required: true, widgetProps: {options: transmissionOptions, className: "grow w-full"}}},
                        {render: "#Field", ...perm("fuelType"), field: {name: "fuelType", widget: "#Select", label: "form.fuelTypeLabel", placeholder: "form.fuelTypePlaceholder", required: true, widgetProps: {options: fuelTypeOptions, className: "grow w-full"}}},
                        number("minDriverAge", false, 16),
                    ],
                },
                {
                    render: "#Field",
                    ...perm("features"),
                    field: {name: "features", widget: "#StringArrayInput", label: "form.featuresLabel", placeholder: "form.featuresPlaceholder", widgetProps: {removeTooltipKey: "form.removeFeature", maxLength: VEHICLE_CATEGORY_FEATURE_MAX}},
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
                        number("dailyRate", true),
                        number("weekendDailyRate"),
                        number("weeklyRate"),
                        number("depositAmount"),
                        {render: "#Field", ...perm("mileagePolicy"), field: {name: "mileagePolicy", widget: "#Select", label: "form.mileagePolicyLabel", placeholder: "form.mileagePolicyPlaceholder", required: true, widgetProps: {options: mileagePolicyOptions, className: "grow w-full"}}},
                    ],
                },
                {
                    render: "#FormWhenFieldValueIn",
                    props: {watchField: "mileagePolicy", whenValues: ["limited"]},
                    children: [
                        {render: "#FormGrid", props: {columns: 2}, children: [number("includedKmPerDay"), number("extraKmPrice")]},
                    ],
                },
                {
                    render: "#Field",
                    ...(edit ? {permissions: {write: "rateSeasons"}} : {}),
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
                                        {render: "#Field", field: {name: "startDate", widget: "#DateInput", label: "form.seasonStartLabel", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                                        {render: "#Field", field: {name: "endDate", widget: "#DateInput", label: "form.seasonEndLabel", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                                        {render: "#Field", field: {name: "dailyRate", widget: "#Input", label: "form.seasonDailyRateLabel", required: true, widgetProps: {type: "number", min: 0, step: "any"}}},
                                    ],
                                },
                            ],
                        },
                    },
                },
            ],
        },
        {
            render: "#FormGrid",
            props: {columns: 2},
            children: [
                {render: "#Field", ...perm("isPublic"), field: {name: "isPublic", widget: "#Switch", label: "form.isPublicLabel"}},
                number("sortOrder"),
            ],
        },
    ];
}

export const vehicleCategoryCreateFormView: ViewConfig = {
    model: "vehiclecategories",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehiclecategories",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleCategoryFormNodes(false),
};

export const vehicleCategoryEditFormView: ViewConfig = {
    model: "vehiclecategories",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehiclecategories",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleCategoryFormNodes(true),
};

export const vehicleCategoryViews: ViewConfig[] = [vehicleCategorySheetView, vehicleCategoryCreateFormView, vehicleCategoryEditFormView];
