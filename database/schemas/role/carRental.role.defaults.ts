import type {DefaultRoleDefinition} from "@coreModule/database/schemas/role/role.defaults";

// RolePermission groups are the capitalised collection names.
const FLEET = [
    "Vehiclecategories",
    "Vehicles",
    "Vehicleblocks",
    "Rentalextras",
    "Rentallocations",
    "Vehicleinsurances",
    "Vehicledocuments",
    "Vehiclemaintenances",
    "Vehicledamages",
    "Rentalpromocodes",
    "Vehiclefines",
    "Vehicletransfers",
    "Rentalbusinessaccounts",
    "Rentaldenyentrys",
];
const RESERVATIONS = ["Rentalreservations", "Rentalreviews", "Rentalsubscriptions"];
const SETTINGS = ["Carrentalconfigs"];

function rentalRole(
    name: string,
    slug: string,
    description: string,
    permissionGroups: string[],
    readPermissionGroups: string[],
): DefaultRoleDefinition {
    return {
        name,
        slug,
        description,
        isAdmin: false,
        isSignupDefault: false,
        canEdit: true,
        canDelete: false,
        permissionGroups,
        readPermissionGroups,
    };
}

export const carRentalDefaultRoles: DefaultRoleDefinition[] = [
    rentalRole(
        "Rental Manager",
        "rental_manager",
        "Runs the rental business: settings, locations, fleet, prices, extras and every reservation.",
        [...SETTINGS, ...FLEET, ...RESERVATIONS],
        ["Paymenttransactions", "Invoices"],
    ),
    rentalRole(
        "Rental Agent",
        "rental_agent",
        "Works the counter: books, hands over and takes back cars, records payments and damage, blocks cars for maintenance. Cannot change prices or settings.",
        [...RESERVATIONS, "Vehicleblocks", "Vehicledamages"],
        ["Invoices", "Vehicles", "Vehiclecategories", "Rentalextras", "Rentallocations", "Vehicleinsurances", "Vehicledocuments", "Vehiclemaintenances", "Rentalbusinessaccounts", ...SETTINGS],
    ),
];
