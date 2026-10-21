import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {
    VEHICLE_INSURANCE_COVERAGES,
    VEHICLE_INSURANCE_STATUSES,
    VEHICLE_INSURER_MAX,
    VEHICLE_POLICY_NUMBER_MAX,
} from "armonia/src/modules/carRental/api/carRental/private/vehicleInsurance/vehicleInsurance.schema-def";
import {VEHICLE_RECORD_ATTACHMENTS_MAX, VEHICLE_RECORD_NOTES_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";

const API_URL = "/api/carRental/vehicleInsurance";

export const vehicleInsuranceSheetView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "sheet",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    header: {titleField: "policyNumber", subtitleKey: "vehicleInsuranceSubtitle", showCloseButton: true},
    nodes: [
        {
            render: "#SheetGroup",
            props: {title: "overview"},
            children: [
                {
                    render: "#SheetGrid",
                    props: {columns: 2},
                    children: [
                        {render: "#DisplayCard", permissions: {read: "vehicle"}, field: {name: "vehicle.plate", widget: "#DisplayCard", label: "vehicle", widgetProps: {icon: "#IconCar"}}},
                        {render: "#DisplayCard", permissions: {read: "insurer"}, field: {name: "insurer", widget: "#DisplayCard", label: "insurer", widgetProps: {icon: "#IconBuildingBank"}}},
                        {render: "#DisplayCard", permissions: {read: "coverage"}, field: {name: "coverage", widget: "#DisplayCard", label: "coverage", widgetProps: {icon: "#IconShieldCheck", type: "enum", languageKeyCategory: "coverageValues"}}},
                        {render: "#DisplayCard", permissions: {read: "status"}, field: {name: "status", widget: "#DisplayCard", label: "status", widgetProps: {icon: "#IconStatusChange", type: "enum", languageKeyCategory: "statusValues"}}},
                        {render: "#DisplayCard", permissions: {read: "validFrom"}, field: {name: "validFrom", widget: "#DisplayCard", label: "validFrom", widgetProps: {icon: "#IconCalendarEvent", format: "date", type: "date"}}},
                        {render: "#DisplayCard", permissions: {read: "expiresAt"}, field: {name: "expiresAt", widget: "#DisplayCard", label: "expiresAt", widgetProps: {icon: "#IconCalendarDue", format: "date", type: "date"}}},
                        {render: "#DisplayCard", permissions: {read: "premium"}, field: {name: "premium", widget: "#DisplayCard", label: "premium", widgetProps: {icon: "#IconCash", type: "number"}}},
                        {render: "#DisplayCard", permissions: {read: "deductible"}, field: {name: "deductible", widget: "#DisplayCard", label: "deductible", widgetProps: {icon: "#IconCoin", type: "number"}}},
                    ],
                },
                {render: "#DisplayCard", permissions: {read: "notes"}, field: {name: "notes", widget: "#DisplayCard", label: "notes", widgetProps: {icon: "#IconNotes"}}},
            ],
        },
        {
            render: "#SheetGroup",
            props: {title: "attachments", defaultOpen: true},
            dependent: "attachments",
            children: [
                {
                    render: "#SheetMediaFilesStrip",
                    permissions: {read: "attachments"},
                    field: {name: "attachments", widget: "#SheetMediaFilesStrip", widgetProps: {canDownload: true, canRemove: false}},
                },
            ],
        },
        lifecycleSheetGroup,
    ],
};

const coverageOptions = VEHICLE_INSURANCE_COVERAGES.map((value) => ({value, label: `form.coverage.${value}`}));
const statusOptions = VEHICLE_INSURANCE_STATUSES.map((value) => ({value, label: `form.status.${value}`}));

/** A renewal is a new policy: the old one stays as history and stops being reminded about. */
function vehicleInsuranceFormNodes(edit: boolean): ViewConfig["nodes"] {
    const perm = (name: string) => (edit ? {permissions: {read: name, write: name}} : {});
    return [
        {
            render: "#FormGrid",
            props: {columns: 2},
            children: [
                {render: "#Field", ...perm("vehicle"), field: {name: "vehicle", widget: "#ApiSelect", label: "form.vehicleLabel", placeholder: "form.vehiclePlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/vehicle/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true, postBody: {includeInactive: true}}}},
                {render: "#Field", ...perm("insurer"), field: {name: "insurer", widget: "#Input", label: "form.insurerLabel", placeholder: "form.insurerPlaceholder", required: true, widgetProps: {maxLength: VEHICLE_INSURER_MAX}}},
                {render: "#Field", ...perm("policyNumber"), field: {name: "policyNumber", widget: "#Input", label: "form.policyNumberLabel", placeholder: "form.policyNumberPlaceholder", required: true, widgetProps: {maxLength: VEHICLE_POLICY_NUMBER_MAX}}},
                {render: "#Field", ...perm("coverage"), field: {name: "coverage", widget: "#Select", label: "form.coverageLabel", placeholder: "form.coveragePlaceholder", required: true, widgetProps: {options: coverageOptions, className: "grow w-full"}}},
                {render: "#Field", ...perm("validFrom"), field: {name: "validFrom", widget: "#DateInput", label: "form.validFromLabel", placeholder: "form.validFromPlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                {render: "#Field", ...perm("expiresAt"), field: {name: "expiresAt", widget: "#DateInput", label: "form.expiresAtLabel", placeholder: "form.expiresAtPlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd"}}},
                {render: "#Field", ...perm("premium"), field: {name: "premium", widget: "#Input", label: "form.premiumLabel", placeholder: "form.premiumPlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                {render: "#Field", ...perm("deductible"), field: {name: "deductible", widget: "#Input", label: "form.deductibleLabel", placeholder: "form.deductiblePlaceholder", widgetProps: {type: "number", min: 0, step: "0.01"}}},
                {render: "#Field", ...perm("status"), field: {name: "status", widget: "#Select", label: "form.statusLabel", placeholder: "form.statusPlaceholder", widgetProps: {options: statusOptions, className: "grow w-full"}}},
            ],
        },
        {
            render: "#Field",
            ...perm("notes"),
            field: {name: "notes", widget: "#Textarea", label: "form.notesLabel", placeholder: "form.notesPlaceholder", widgetProps: {rows: 4, maxLength: VEHICLE_RECORD_NOTES_MAX, className: "field-sizing-fixed max-h-56 min-h-24 overflow-y-auto"}},
        },
        {
            render: "#Field",
            ...perm("attachments"),
            field: {name: "attachments", widget: "#MediaField", label: "form.attachmentsLabel", widgetProps: {mediaType: "file", mode: "multiple", maxCount: VEHICLE_RECORD_ATTACHMENTS_MAX, accept: "application/pdf,image/*"}},
        },
    ];
}

export const vehicleInsuranceCreateFormView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    method: "PUT",
    nodes: vehicleInsuranceFormNodes(false),
};

export const vehicleInsuranceEditFormView: ViewConfig = {
    model: "vehicleinsurances",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicleinsurances",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: vehicleInsuranceFormNodes(true),
};

export const vehicleInsuranceViews: ViewConfig[] = [vehicleInsuranceSheetView, vehicleInsuranceCreateFormView, vehicleInsuranceEditFormView];
