import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_BODY_STYLES,
    VEHICLE_CATALOG_LEVELS,
    VEHICLE_CATALOG_NAME_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCatalog/vehicleCatalog.schema-def";
import {
    VEHICLE_FUEL_TYPES,
    VEHICLE_TRANSMISSIONS,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleCategory/vehicleCategory.schema-def";

/** The platform's vehicle catalog (D199): a type, a make of a type, or a model of a make. */
export const vehicleCatalogSheetView: ViewConfig = {
    model: "vehiclecatalogentries",
    viewType: "sheet",
    sheetWidget: "#VehicleCatalogSheetView",
    accessModel: "vehiclecatalogentries",
    apiUrl: "/api/carRental/vehicleCatalog",
    header: {
        titleField: "name",
        subtitleKey: "vehicleCatalogSubtitle",
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
                            permissions: {read: "level"},
                            field: {
                                name: "level",
                                widget: "#DisplayCard",
                                label: "level",
                                widgetProps: {
                                    icon: "#IconCategory",
                                    type: "enum",
                                    languageKeyCategory: "levelValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "parentEntry",
                            permissions: {read: "parentEntry"},
                            field: {
                                name: "parentEntry.name",
                                widget: "#DisplayCard",
                                label: "parentEntry",
                                widgetProps: {
                                    icon: "#IconCategory2",
                                    linkedRefPath: "parentEntry",
                                    linkedSheetModel: "vehiclecatalogentries",
                                    linkedSheetWidget:
                                        "#VehicleCatalogSheetView",
                                    linkedSheetEntityProp:
                                        "vehicleCatalogEntry",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "bodyStyle",
                            permissions: {read: "bodyStyle"},
                            field: {
                                name: "bodyStyle",
                                widget: "#DisplayCard",
                                label: "bodyStyle",
                                widgetProps: {
                                    icon: "#IconCar",
                                    type: "enum",
                                    languageKeyCategory: "bodyStyleValues",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "seats",
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
                            dependent: "doors",
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
                            dependent: "fuelType",
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
                            dependent: "transmission",
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
                            dependent: "yearFrom",
                            permissions: {read: "yearFrom"},
                            field: {
                                name: "yearFrom",
                                widget: "#DisplayCard",
                                label: "yearFrom",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "string",
                                },
                            },
                        },
                        {
                            render: "#DisplayCard",
                            dependent: "yearTo",
                            permissions: {read: "yearTo"},
                            field: {
                                name: "yearTo",
                                widget: "#DisplayCard",
                                label: "yearTo",
                                widgetProps: {
                                    icon: "#IconCalendar",
                                    type: "string",
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

const levelOptions = VEHICLE_CATALOG_LEVELS.map((value) => ({
    value,
    label: `form.levels.${value}`,
}));
const bodyStyleOptions = VEHICLE_BODY_STYLES.map((value) => ({
    value,
    label: `form.bodyStyles.${value}`,
}));
const fuelTypeOptions = VEHICLE_FUEL_TYPES.map((value) => ({
    value,
    label: `form.fuelTypes.${value}`,
}));
const transmissionOptions = VEHICLE_TRANSMISSIONS.map((value) => ({
    value,
    label: `form.transmissions.${value}`,
}));

const vehicleCatalogCreateFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.basicsSectionTitle"},
        children: [
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
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "level",
                            widget: "#SimpleSelect",
                            label: "form.levelLabel",
                            placeholder: "form.levelPlaceholder",
                            required: true,
                            widgetProps: {
                                options: levelOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "level", whenValues: ["make"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "parentEntry",
                                    widget: "#ApiSelect",
                                    label: "form.parentEntryLabel.make",
                                    placeholder:
                                        "form.parentEntryPlaceholder.make",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/carRental/vehicleCatalog/select",
                                        postBody: {level: "type"},
                                        normalizeEmptyToUndefined: true,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "level", whenValues: ["model"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "parentEntry",
                                    widget: "#ApiSelect",
                                    label: "form.parentEntryLabel.model",
                                    placeholder:
                                        "form.parentEntryPlaceholder.model",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/carRental/vehicleCatalog/select",
                                        postBody: {level: "make"},
                                        normalizeEmptyToUndefined: true,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.specsSectionTitle"},
        children: [
            {
                render: "#FormWhenFieldValueIn",
                props: {
                    watchField: "level",
                    whenValues: ["model"],
                    clearFields: [
                        "bodyStyle",
                        "seats",
                        "doors",
                        "fuelType",
                        "transmission",
                        "yearFrom",
                        "yearTo",
                    ],
                },
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 3},
                        children: [
                            {
                                render: "#Field",
                                field: {
                                    name: "bodyStyle",
                                    widget: "#SimpleSelect",
                                    label: "form.bodyStyleLabel",
                                    placeholder: "form.bodyStylePlaceholder",
                                    widgetProps: {
                                        options: bodyStyleOptions,
                                        className: "grow w-full",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "seats",
                                    widget: "#Input",
                                    label: "form.seatsLabel",
                                    placeholder: "form.seatsPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 1,
                                        max: 60,
                                        step: 1,
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "doors",
                                    widget: "#Input",
                                    label: "form.doorsLabel",
                                    placeholder: "form.doorsPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        max: 10,
                                        step: 1,
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
                                    widgetProps: {
                                        options: fuelTypeOptions,
                                        className: "grow w-full",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "transmission",
                                    widget: "#SimpleSelect",
                                    label: "form.transmissionLabel",
                                    placeholder: "form.transmissionPlaceholder",
                                    widgetProps: {
                                        options: transmissionOptions,
                                        className: "grow w-full",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "yearFrom",
                                    widget: "#Input",
                                    label: "form.yearFromLabel",
                                    placeholder: "form.yearFromPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 1900,
                                        max: 2100,
                                        step: 1,
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                field: {
                                    name: "yearTo",
                                    widget: "#Input",
                                    label: "form.yearToLabel",
                                    placeholder: "form.yearToPlaceholder",
                                    description: "form.yearToDescription",
                                    widgetProps: {
                                        type: "number",
                                        min: 1900,
                                        max: 2100,
                                        step: 1,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.namesSectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "names.en",
                            widget: "#Input",
                            label: "form.names.en",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "names.sq",
                            widget: "#Input",
                            label: "form.names.sq",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "names.de",
                            widget: "#Input",
                            label: "form.names.de",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "names.fr",
                            widget: "#Input",
                            label: "form.names.fr",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        field: {
                            name: "names.it",
                            widget: "#Input",
                            label: "form.names.it",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.visibilitySectionTitle"},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        field: {
                            name: "order",
                            widget: "#Input",
                            label: "form.orderLabel",
                            placeholder: "form.orderPlaceholder",
                            widgetProps: {type: "number", min: 0, step: 1},
                        },
                    },
                ],
            },
        ],
    },
];

const vehicleCatalogEditFormNodes: ViewConfig["nodes"] = [
    {
        render: "#TitleWithCollapse",
        props: {title: "form.basicsSectionTitle"},
        permissions: {
            readAny: ["name", "level", "parentEntry"],
            writeAny: ["name", "level", "parentEntry"],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
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
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "level", write: "level"},
                        field: {
                            name: "level",
                            widget: "#SimpleSelect",
                            label: "form.levelLabel",
                            placeholder: "form.levelPlaceholder",
                            required: true,
                            widgetProps: {
                                options: levelOptions,
                                className: "grow w-full",
                            },
                        },
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "level", whenValues: ["make"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                permissions: {
                                    read: "parentEntry",
                                    write: "parentEntry",
                                },
                                field: {
                                    name: "parentEntry",
                                    widget: "#ApiSelect",
                                    label: "form.parentEntryLabel.make",
                                    placeholder:
                                        "form.parentEntryPlaceholder.make",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/carRental/vehicleCatalog/select",
                                        postBody: {level: "type"},
                                        normalizeEmptyToUndefined: true,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                render: "#FormWhenFieldValueIn",
                props: {watchField: "level", whenValues: ["model"]},
                children: [
                    {
                        render: "#FormGrid",
                        props: {columns: 2},
                        children: [
                            {
                                render: "#Field",
                                permissions: {
                                    read: "parentEntry",
                                    write: "parentEntry",
                                },
                                field: {
                                    name: "parentEntry",
                                    widget: "#ApiSelect",
                                    label: "form.parentEntryLabel.model",
                                    placeholder:
                                        "form.parentEntryPlaceholder.model",
                                    required: true,
                                    widgetProps: {
                                        apiUrl: "/api/carRental/vehicleCatalog/select",
                                        postBody: {level: "make"},
                                        normalizeEmptyToUndefined: true,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.specsSectionTitle"},
        permissions: {
            readAny: [
                "bodyStyle",
                "seats",
                "doors",
                "fuelType",
                "transmission",
                "yearFrom",
                "yearTo",
            ],
            writeAny: [
                "bodyStyle",
                "seats",
                "doors",
                "fuelType",
                "transmission",
                "yearFrom",
                "yearTo",
            ],
        },
        children: [
            {
                render: "#FormWhenFieldValueIn",
                props: {
                    watchField: "level",
                    whenValues: ["model"],
                    clearFields: [
                        "bodyStyle",
                        "seats",
                        "doors",
                        "fuelType",
                        "transmission",
                        "yearFrom",
                        "yearTo",
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
                                    read: "bodyStyle",
                                    write: "bodyStyle",
                                },
                                field: {
                                    name: "bodyStyle",
                                    widget: "#SimpleSelect",
                                    label: "form.bodyStyleLabel",
                                    placeholder: "form.bodyStylePlaceholder",
                                    widgetProps: {
                                        options: bodyStyleOptions,
                                        className: "grow w-full",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                permissions: {read: "seats", write: "seats"},
                                field: {
                                    name: "seats",
                                    widget: "#Input",
                                    label: "form.seatsLabel",
                                    placeholder: "form.seatsPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 1,
                                        max: 60,
                                        step: 1,
                                    },
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
                                    widgetProps: {
                                        type: "number",
                                        min: 0,
                                        max: 10,
                                        step: 1,
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                permissions: {
                                    read: "fuelType",
                                    write: "fuelType",
                                },
                                field: {
                                    name: "fuelType",
                                    widget: "#SimpleSelect",
                                    label: "form.fuelTypeLabel",
                                    placeholder: "form.fuelTypePlaceholder",
                                    widgetProps: {
                                        options: fuelTypeOptions,
                                        className: "grow w-full",
                                    },
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
                                    widgetProps: {
                                        options: transmissionOptions,
                                        className: "grow w-full",
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                permissions: {
                                    read: "yearFrom",
                                    write: "yearFrom",
                                },
                                field: {
                                    name: "yearFrom",
                                    widget: "#Input",
                                    label: "form.yearFromLabel",
                                    placeholder: "form.yearFromPlaceholder",
                                    widgetProps: {
                                        type: "number",
                                        min: 1900,
                                        max: 2100,
                                        step: 1,
                                    },
                                },
                            },
                            {
                                render: "#Field",
                                permissions: {read: "yearTo", write: "yearTo"},
                                field: {
                                    name: "yearTo",
                                    widget: "#Input",
                                    label: "form.yearToLabel",
                                    placeholder: "form.yearToPlaceholder",
                                    description: "form.yearToDescription",
                                    widgetProps: {
                                        type: "number",
                                        min: 1900,
                                        max: 2100,
                                        step: 1,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.namesSectionTitle"},
        permissions: {
            readAny: [
                "names.en",
                "names.sq",
                "names.de",
                "names.fr",
                "names.it",
            ],
            writeAny: [
                "names.en",
                "names.sq",
                "names.de",
                "names.fr",
                "names.it",
            ],
        },
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "names.en", write: "names.en"},
                        field: {
                            name: "names.en",
                            widget: "#Input",
                            label: "form.names.en",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "names.sq", write: "names.sq"},
                        field: {
                            name: "names.sq",
                            widget: "#Input",
                            label: "form.names.sq",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "names.de", write: "names.de"},
                        field: {
                            name: "names.de",
                            widget: "#Input",
                            label: "form.names.de",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "names.fr", write: "names.fr"},
                        field: {
                            name: "names.fr",
                            widget: "#Input",
                            label: "form.names.fr",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                    {
                        render: "#Field",
                        permissions: {read: "names.it", write: "names.it"},
                        field: {
                            name: "names.it",
                            widget: "#Input",
                            label: "form.names.it",
                            widgetProps: {maxLength: VEHICLE_CATALOG_NAME_MAX},
                        },
                    },
                ],
            },
        ],
    },
    {
        render: "#TitleWithCollapse",
        props: {title: "form.visibilitySectionTitle"},
        permissions: {readAny: ["order"], writeAny: ["order"]},
        children: [
            {
                render: "#FormGrid",
                props: {columns: 2},
                children: [
                    {
                        render: "#Field",
                        permissions: {read: "order", write: "order"},
                        field: {
                            name: "order",
                            widget: "#Input",
                            label: "form.orderLabel",
                            placeholder: "form.orderPlaceholder",
                            widgetProps: {type: "number", min: 0, step: 1},
                        },
                    },
                ],
            },
        ],
    },
];

export const vehicleCatalogCreateFormView: ViewConfig = {
    model: "vehiclecatalogentries",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehiclecatalogentries",
    apiUrl: "/api/carRental/vehicleCatalog",
    method: "PUT",
    nodes: vehicleCatalogCreateFormNodes,
};

export const vehicleCatalogEditFormView: ViewConfig = {
    model: "vehiclecatalogentries",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehiclecatalogentries",
    apiUrl: "/api/carRental/vehicleCatalog",
    method: "PATCH",
    nodes: vehicleCatalogEditFormNodes,
};

export const vehicleCatalogViews: ViewConfig[] = [
    vehicleCatalogSheetView,
    vehicleCatalogCreateFormView,
    vehicleCatalogEditFormView,
];
