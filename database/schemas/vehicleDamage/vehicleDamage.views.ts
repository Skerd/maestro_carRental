import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_DAMAGE_AREAS,
    VEHICLE_DAMAGE_PHOTOS_MAX,
    VEHICLE_DAMAGE_SEVERITIES,
    VEHICLE_DAMAGE_STATUSES,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleDamage/vehicleDamage.schema-def";
import {VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleDamage";

export const vehicleDamageSheetView: ViewConfig = {
    model: "vehicledamages",
    viewType: "sheet",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    header: {titleField: "vehicle.plate", subtitleKey: "vehicleDamageSubtitle", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#DisplayCard",
                    permissions: {read: "photos"},
                    field: {
                        name: "photos",
                        widget: "#GalleryCarousel",
                        label: "photos",
                        widgetProps: {icon: "#IconPhoto", imageGalleryField: "photos", showThumbnails: false, allowFullScreen: false, coverAfterFirst: false},
                    },
                },
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "vehicle"}, field: {name: "vehicle.plate", widget: "#DisplayCard", label: "vehicle", widgetProps: {icon: "#IconCar"}}},
                        {render: "#DisplayCard", permissions: {read: "reservation"}, field: {name: "reservation.number", widget: "#DisplayCard", label: "reservation", widgetProps: {icon: "#IconCalendarCheck"}}},
                        {render: "#DisplayCard", permissions: {read: "reportedAt"}, field: {name: "reportedAt", widget: "#DisplayCard", label: "reportedAt", widgetProps: {icon: "#IconCalendarEvent", type: "dateTime"}}},
                        {render: "#DisplayCard", permissions: {read: "area"}, field: {name: "area", widget: "#DisplayCard", label: "area", widgetProps: {icon: "#IconCarCrash", type: "enum", languageKeyCategory: "areaValues"}}},
                        {render: "#DisplayCard", permissions: {read: "severity"}, field: {name: "severity", widget: "#DisplayCard", label: "severity", widgetProps: {icon: "#IconAlertTriangle", type: "enum", languageKeyCategory: "severityValues"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#IconStatusChange", type: "enum", languageKeyCategory: "statusValues"}}},
                        {render: "#DisplayCard", permissions: {read: "estimatedCost"}, field: {name: "estimatedCost", widget: "#DisplayCard", label: "estimatedCost", widgetProps: {icon: "#IconCash", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "repairCost"}, field: {name: "repairCost", widget: "#DisplayCard", label: "repairCost", widgetProps: {icon: "#IconCash", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "repairedAt"}, field: {name: "repairedAt", widget: "#DisplayCard", label: "repairedAt", widgetProps: {icon: "#IconCalendarCheck", format: "date", type: "date"}}},
                    ],
                },
                {render: "#DisplayCard", permissions: {read: "description"}, field: {name: "description", widget: "#DisplayCard", label: "description", widgetProps: {icon: "#IconNotes"}}},
            ],
        },
        lifecycleSheetGroup,
    ],
};

const areaOptions = VEHICLE_DAMAGE_AREAS.map((value) => ({value, label: `form.area.${value}`}));
const severityOptions = VEHICLE_DAMAGE_SEVERITIES.map((value) => ({value, label: `form.severity.${value}`}));
const statusOptions = VEHICLE_DAMAGE_STATUSES.map((value) => ({value, label: `form.status.${value}`}));

/** The booking list only offers bookings of the chosen vehicle. */
function vehicleDamageFormNodes(edit: boolean): ViewConfig["nodes"] {
    const perm = (name: string) => (edit ? {permissions: {read: name, write: name}} : {});
    return [
        {
            render: "#FormGrid",
            props: {columns: 2},
            children: [
                {render: "#Field", ...perm("vehicle"), field: {name: "vehicle", widget: "#ApiSelect", label: "form.vehicleLabel", placeholder: "form.vehiclePlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/vehicle/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBody: {includeInactive: true}}}},
                {render: "#Field", ...perm("reservation"), field: {name: "reservation", widget: "#ApiSelect", label: "form.reservationLabel", placeholder: "form.reservationPlaceholder", widgetProps: {apiUrl: "/api/carRental/rentalReservation/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBodyFromFormFields: [{field: "vehicle", paramName: "vehicle"}], enableWhenFormFieldsNonEmpty: ["vehicle"]}}},
                {render: "#Field", ...perm("reportedAt"), field: {name: "reportedAt", widget: "#DateInput", label: "form.reportedAtLabel", placeholder: "form.reportedAtPlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd HH:mm"}}},
                {render: "#Field", ...perm("area"), field: {name: "area", widget: "#Select", label: "form.areaLabel", placeholder: "form.areaPlaceholder", required: true, widgetProps: {options: areaOptions, className: "grow w-full"}}},
                {render: "#Field", ...perm("severity"), field: {name: "severity", widget: "#Select", label: "form.severityLabel", placeholder: "form.severityPlaceholder", required: true, widgetProps: {options: severityOptions, className: "grow w-full"}}},
                {render: "#Field", ...perm("status"), field: {name: "status", widget: "#Select", label: "form.statusLabel", placeholder: "form.statusPlaceholder", widgetProps: {options: statusOptions, className: "grow w-full"}}},
                {render: "#Field", ...perm("estimatedCost"), field: {name: "estimatedCost", widget: "#Input", label: "form.estimatedCostLabel", placeholder: "form.estimatedCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                {render: "#Field", ...perm("repairCost"), field: {name: "repairCost", widget: "#Input", label: "form.repairCostLabel", placeholder: "form.repairCostPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                {render: "#Field", ...perm("repairedAt"), field: {name: "repairedAt", widget: "#DateInput", label: "form.repairedAtLabel", placeholder: "form.repairedAtPlaceholder", widgetProps: {valueFormat: "yyyy-MM-dd"}}},
            ],
        },
        {
            render: "#Field",
            ...perm("description"),
            field: {name: "description", widget: "#Textarea", label: "form.descriptionLabel", placeholder: "form.descriptionPlaceholder", required: true, widgetProps: {rows: 4, maxLength: VEHICLE_RECORD_NOTES_MAX, className: "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto"}},
        },
        {
            render: "#Field",
            ...perm("photos"),
            field: {name: "photos", widget: "#MediaField", label: "form.photosLabel", widgetProps: {mediaType: "image", mode: "multiple", maxCount: VEHICLE_DAMAGE_PHOTOS_MAX}},
        },
    ];
}

export const vehicleDamageCreateFormView: ViewConfig = {
    model: "vehicledamages",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleDamageFormNodes(false),
};

export const vehicleDamageEditFormView: ViewConfig = {
    model: "vehicledamages",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicledamages",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleDamageFormNodes(true),
};

export const vehicleDamageViews: ViewConfig[] = [vehicleDamageSheetView, vehicleDamageCreateFormView, vehicleDamageEditFormView];
