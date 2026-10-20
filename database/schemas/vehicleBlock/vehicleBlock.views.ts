import type {ViewConfig} from "armonia/src/modules/core/api/auxiliary/private/viewConfig";
import {lifecycleSheetGroup} from "@coreModule/database/schemas/shared/lifecycleSheetGroup";
import {VEHICLE_BLOCK_NOTE_MAX} from "armonia/src/modules/carRental/api/carRental/private/vehicleBlock/vehicleBlock.schema-def";

const API_URL = "/api/carRental/vehicleBlock";

export const vehicleBlockSheetView: ViewConfig = {
    model: "vehicleblocks",
    viewType: "sheet",
    accessModel: "vehicleblocks",
    apiUrl: API_URL,
    header: {titleField: "vehicle.plate", subtitleKey: "vehicleBlockSubtitle", showCloseButton: true},
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
                        {render: "#DisplayCard", permissions: {read: "reason"}, field: {name: "reason", widget: "#DisplayCard", label: "reason", widgetProps: {icon: "#IconTool", type: "enum", languageKeyCategory: "reasonValues"}}},
                        {render: "#DisplayCard", permissions: {read: "startAt"}, field: {name: "startAt", widget: "#DisplayCard", label: "startAt", widgetProps: {icon: "#IconCalendarEvent", type: "dateTime"}}},
                        {render: "#DisplayCard", permissions: {read: "endAt"}, field: {name: "endAt", widget: "#DisplayCard", label: "endAt", widgetProps: {icon: "#IconCalendarEvent", type: "dateTime"}}},
                    ],
                },
                {render: "#DisplayCard", permissions: {read: "note"}, field: {name: "note", widget: "#DisplayCard", label: "note", widgetProps: {icon: "#IconNotes"}}},
            ],
        },
        lifecycleSheetGroup,
    ],
};

const reasonOptions = ["maintenance", "repair", "transfer", "other"].map((value) => ({value, label: `form.reason.${value}`}));

export const vehicleBlockCreateFormView: ViewConfig = {
    model: "vehicleblocks",
    viewType: "form",
    viewMode: "create",
    accessModel: "vehicleblocks",
    apiUrl: API_URL,
    method: "PUT",
    nodes: [
        {
            render: "#FormGrid",
            props: {columns: 2},
            children: [
                {
                    render: "#Field",
                    field: {name: "vehicle", widget: "#ApiSelect", label: "form.vehicleLabel", placeholder: "form.vehiclePlaceholder", required: true, widgetProps: {apiUrl: "/api/carRental/vehicle/select", method: "POST", pageSize: 50, normalizeEmptyToUndefined: true}},
                },
                {render: "#Field", field: {name: "reason", widget: "#Select", label: "form.reasonLabel", placeholder: "form.reasonPlaceholder", required: true, widgetProps: {options: reasonOptions, className: "grow w-full"}}},
                {render: "#Field", field: {name: "startAt", widget: "#DateInput", label: "form.startAtLabel", placeholder: "form.startAtPlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd HH:mm"}}},
                {render: "#Field", field: {name: "endAt", widget: "#DateInput", label: "form.endAtLabel", placeholder: "form.endAtPlaceholder", required: true, widgetProps: {valueFormat: "yyyy-MM-dd HH:mm"}}},
            ],
        },
        {
            render: "#Field",
            field: {name: "note", widget: "#Textarea", label: "form.noteLabel", placeholder: "form.notePlaceholder", widgetProps: {rows: 3, maxLength: VEHICLE_BLOCK_NOTE_MAX}},
        },
    ],
};

/** The window is fixed once created (it was checked against bookings); only the reason and note change. */
export const vehicleBlockEditFormView: ViewConfig = {
    model: "vehicleblocks",
    viewType: "form",
    viewMode: "edit",
    accessModel: "vehicleblocks",
    apiUrl: API_URL,
    method: "PATCH",
    nodes: [
        {
            render: "#Field",
            permissions: {read: "reason", write: "reason"},
            field: {name: "reason", widget: "#Select", label: "form.reasonLabel", placeholder: "form.reasonPlaceholder", required: true, widgetProps: {options: reasonOptions, className: "grow w-full"}},
        },
        {
            render: "#Field",
            permissions: {read: "note", write: "note"},
            field: {name: "note", widget: "#Textarea", label: "form.noteLabel", placeholder: "form.notePlaceholder", widgetProps: {rows: 3, maxLength: VEHICLE_BLOCK_NOTE_MAX}},
        },
    ],
};

export const vehicleBlockViews: ViewConfig[] = [vehicleBlockSheetView, vehicleBlockCreateFormView, vehicleBlockEditFormView];
