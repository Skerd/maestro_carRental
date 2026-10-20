import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_COLOR_MAX,
    VEHICLE_MAKE_MAX,
    VEHICLE_MODEL_MAX,
    VEHICLE_NOTES_MAX,
    VEHICLE_PLATE_MAX,
    VEHICLE_VIN_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicle";

export const vehicleSheetView: ViewConfig = {
    model: "vehicles",
    viewType: "sheet",
    accessModel: "vehicles",
    apiUrl: API_URL,
    header: {titleField: "plate", subtitleKey: "vehicleSubtitle", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 3},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "plate"}, field: {name: "plate", widget: "#DisplayCard", label: "plate", widgetProps: {icon: "#IconLicense"}}},
                        {render: "#DisplayCard", permissions: {read: "make"}, field: {name: "make", widget: "#DisplayCard", label: "make", widgetProps: {icon: "#IconCar"}}},
                        {render: "#DisplayCard", permissions: {read: "model"}, field: {name: "model", widget: "#DisplayCard", label: "model", widgetProps: {icon: "#IconCar"}}},
                        {render: "#DisplayCard", permissions: {read: "category"}, field: {name: "category.name", widget: "#DisplayCard", label: "category", widgetProps: {icon: "#IconCategory"}}},
                        {render: "#DisplayCard", permissions: {read: "homeLocation"}, field: {name: "homeLocation.name", widget: "#DisplayCard", label: "homeLocation", widgetProps: {icon: "#IconMapPin"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#IconStatusChange", type: "enum", languageKeyCategory: "statusValues"}}},
                        {render: "#DisplayCard", permissions: {read: "year"}, field: {name: "year", widget: "#DisplayCard", label: "year", widgetProps: {icon: "#IconCalendar", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "color"}, field: {name: "color", widget: "#DisplayCard", label: "color", widgetProps: {icon: "#IconPalette"}}},
                        {render: "#DisplayCard", permissions: {read: "odometerKm"}, field: {name: "odometerKm", widget: "#DisplayCard", label: "odometerKm", widgetProps: {icon: "#IconGauge", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "vin"}, field: {name: "vin", widget: "#DisplayCard", label: "vin", widgetProps: {icon: "#Hash"}}},
                    ],
                },
                {render: "#DisplayCard", permissions: {read: "notes"}, field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconNotes"}}},
            ],
        },
        lifecycleSheetGroup,
    ],
};

const statusOptions = ["active", "maintenance", "retired"].map((value) => ({value, label: `form.status.${value}`}));

function vehicleFormNodes(edit: boolean): ViewConfig["nodes"] {
    const perm = (name: string) => (edit ? {permissions: {read: name, write: name}} : {});
    return [
        {
            render: "#FormGrid",
            props: {columns: 3},
            children: [
                {render: "#Field", ...perm("plate"), field: {name: "plate", widget: "#Input", label: "form.plateLabel", placeholder: "form.platePlaceholder", required: true, widgetProps: {maxLength: VEHICLE_PLATE_MAX}}},
                {render: "#Field", ...perm("make"), field: {name: "make", widget: "#Input", label: "form.makeLabel", placeholder: "form.makePlaceholder", required: true, widgetProps: {maxLength: VEHICLE_MAKE_MAX}}},
                {render: "#Field", ...perm("model"), field: {name: "model", widget: "#Input", label: "form.modelLabel", placeholder: "form.modelPlaceholder", required: true, widgetProps: {maxLength: VEHICLE_MODEL_MAX}}},
                {
                    render: "#Field",
                    ...perm("category"),
                    field: {name: "category", widget: "#ApiSelect", label: "form.categoryLabel", placeholder: "form.categoryPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/vehicleCategory/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}},
                },
                {
                    render: "#Field",
                    ...perm("homeLocation"),
                    field: {name: "homeLocation", widget: "#ApiSelect", label: "form.homeLocationLabel", placeholder: "form.homeLocationPlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/rentalLocation/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}},
                },
                {render: "#Field", ...perm("status"), field: {name: "status", widget: "#Select", label: "form.statusLabel", placeholder: "form.statusPlaceholder", required: true, widgetProps: {options: statusOptions, className: "grow w-full"}}},
                {render: "#Field", ...perm("year"), field: {name: "year", widget: "#Input", label: "form.yearLabel", placeholder: "form.yearPlaceholder", widgetProps: {type: "number", min: 1950, max: 2100}}},
                {render: "#Field", ...perm("color"), field: {name: "color", widget: "#Input", label: "form.colorLabel", placeholder: "form.colorPlaceholder", widgetProps: {maxLength: VEHICLE_COLOR_MAX}}},
                {render: "#Field", ...perm("odometerKm"), field: {name: "odometerKm", widget: "#Input", label: "form.odometerKmLabel", placeholder: "form.odometerKmPlaceholder", widgetProps: {type: "number", min: 0}}},
                {render: "#Field", ...perm("vin"), field: {name: "vin", widget: "#Input", label: "form.vinLabel", placeholder: "form.vinPlaceholder", widgetProps: {maxLength: VEHICLE_VIN_MAX}}},
            ],
        },
        {
            render: "#Field",
            ...perm("notes"),
            field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {rows: 4, maxLength: VEHICLE_NOTES_MAX, className: "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto"}},
        },
    ];
}

export const vehicleCreateFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicles",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleFormNodes(false),
};

export const vehicleEditFormView: ViewConfig = {
    model: "vehicles",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicles",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleFormNodes(true),
};

export const vehicleViews: ViewConfig[] = [vehicleSheetView, vehicleCreateFormView, vehicleEditFormView];
