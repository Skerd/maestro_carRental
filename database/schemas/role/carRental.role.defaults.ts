import type {DefaultRoleDefinition} from "@coreModule/database/schemas/role/role.defaults";

// RolePermission groups are the capitalised collection names.
const FLEET = ["Vehiclecategories", "Vehicles", "Vehicleblocks", "Rentalextras", "Rentallocations"];
const RESERVATIONS = ["Rentalreservations"];
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
        ["Paymenttransactions"],
    ),
    rentalRole(
        "Rental Agent",
        "rental_agent",
        "Works the counter: books, hands over and takes back cars, records payments, blocks cars for maintenance. Cannot change prices or settings.",
        [...RESERVATIONS, "Vehicleblocks"],
        ["Vehicles", "Vehiclecategories", "Rentalextras", "Rentallocations", ...SETTINGS],
    ),
];
