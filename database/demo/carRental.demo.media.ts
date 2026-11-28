/**
 * Demo media for the car-rental fleet. Unsplash photo ids per model (each one
 * checked to show that make and model) with each category showing its own models,
 * and Pexels clips per category. Both are free to use; the seed downloads them
 * once and caches them (core demoMedia).
 */

import type {VehicleColor} from "armonia/src/modules/carRental/api/carRental/private/vehicle/vehicle.schema-def";
import type {DemoCategorySlug} from "./carRental.demo.data";

export const CATEGORY_PHOTO_SIZE = {width: 1200, height: 750};

export const CATEGORY_PHOTOS: Record<DemoCategorySlug, string[]> = {
    mini: ["1536667842290-7602f6a43a2b", "1720343012322-40620ced673f", "1628066961967-de52104e87a4", "1627907361729-3f084212cf96"],
    economy: ["1666335009164-2597314da8e7", "1596429916858-6f97b5b9cf48", "1671918206273-90126206dad1", "1656579770042-2d9cdbf3c8ee", "1703098916487-ab6668147d50", "1631831905906-d9c44601ec7f"],
    compact: ["1767949374162-5cbb31071b8f", "1571561944842-542037875b50", "1638618164682-12b986ec2a75", "1579272154060-4e7a4d0f5033", "1756664825476-0b78d1f1b5d0"],
    sedan: ["1670488645266-e11deb6c75d2", "1682351963603-5e033fa29b2b", "1551836989-b4622a17a792", "1658662160331-62f7e52e63de"],
    estate: ["1673822317444-b461165dcd4a", "1658328565782-d633a267102d", "1629896428945-349a9a86e6ba"],
    "compact-suv": ["1652509328308-7f0d7804e678", "1650003678540-e0576a7702ba", "1646029642262-022158ff5794", "1604395924490-a3a18bb7193e", "1733149085735-78ab905d4ae1", "1705229810194-dd78431dcb78"],
    "suv-4x4": ["1709620435533-56483034bdd4", "1675228205797-12a79151cd32", "1760713173223-59ef015ad368"],
    premium: ["1769641241035-cb136ab256cb", "1675016677618-46b11d65924c", "1652254182724-040f8089b611"],
    electric: ["1560958089-b8a1929cea89", "1767949374120-098159f02be9", "1655288115919-7f8b6480ce53"],
    special: ["1756704756051-9aa48231c440", "1659611807210-917ac61ff451", "1655468332000-18ecac4ab2c8", "1772593547280-d480065a9f73", "1632823469217-b0ff8f4f9197"],
    minivan: ["1672216197924-89b8d14a47b1", "1716166411581-5f4099a753b1", "1665053897558-a79bba9fe417"],
};

/** Each model's own photos (D198/D199): every set checked by eye to show that make and model, with no readable plate. */
const MODEL_PHOTOS: Record<string, string[]> = {
    "Fiat 500": ["1536667842290-7602f6a43a2b", "1549317661-bd32c8ce0db2", "1604410869154-3c16714cd476"],
    "MINI Hatch": ["1720343012322-40620ced673f", "1660085708912-82d316354ab7", "1569240652144-971dd0050718"],
    "Kia Picanto": ["1628066961967-de52104e87a4", "1628066984051-a9109560ccb9", "1628066962109-a0b97f4d4810"],
    "Suzuki Ignis": ["1627907361729-3f084212cf96"],
    "Renault Clio": ["1666335009164-2597314da8e7", "1666335009171-3ddc17937d6d", "1666335009169-a9505c436d80"],
    "Toyota Yaris": ["1596429916858-6f97b5b9cf48", "1665986808660-5d8c2c9be86b", "1654617783689-9e85155659da"],
    "Volkswagen Polo": ["1671918206273-90126206dad1", "1671917565837-73b809e96742", "1671917501165-c99426010640"],
    "Peugeot 208": ["1656579770042-2d9cdbf3c8ee", "1636331997172-805266998102", "1693841115118-44f0c748b93d"],
    "Opel Corsa": ["1703098916487-ab6668147d50", "1703098916508-56dfc8d96e9c", "1703098916444-10c32cf34933"],
    "Ford Fiesta": ["1631831905906-d9c44601ec7f", "1653232041322-fc073b6ae7c7", "1631831766585-80a9476e116b"],
    "Volkswagen Golf": ["1767949374162-5cbb31071b8f", "1760688964516-1012e0ece2a8", "1678120609593-1e86e6a631b8"],
    "Hyundai i30": ["1571561944842-542037875b50", "1573899754191-bd20f600141c", "1765891628083-cbabd2a0c3a8"],
    "Toyota Corolla": ["1638618164682-12b986ec2a75", "1711978477980-a0f1a05039a0", "1623869675781-80aa31012a5a"],
    "Ford Focus": ["1579272154060-4e7a4d0f5033", "1669123220791-6f12efd2f9f5", "1671342352273-35bf118111b8"],
    "Mazda 3": ["1756664825476-0b78d1f1b5d0", "1756664825749-d481c5a94a57", "1639241952473-83176474e286"],
    "Hyundai Elantra": ["1670488645266-e11deb6c75d2", "1682570965698-9eb843b9bd13", "1723515822985-78e20eafa790"],
    "Audi A3 Sedan": ["1682351963603-5e033fa29b2b", "1681118556254-037a0f4ea6bb", "1776932136984-66624bad40f0"],
    "Mercedes-Benz C-Class": ["1551836989-b4622a17a792", "1686562483617-3cf08d81e117", "1605556816125-d752c226247b"],
    "Mazda 6": ["1658662160331-62f7e52e63de", "1662896797516-7a2fc5e831b4", "1614450089597-fb658814e4ed"],
    "Skoda Octavia Combi": ["1673822317444-b461165dcd4a", "1673822317395-69d21d618e38", "1673822317394-6fd502a324e6"],
    "Volkswagen Passat Variant": ["1658328565782-d633a267102d", "1783108883640-f454d54c95f6"],
    "Volvo V90": ["1629896428945-349a9a86e6ba", "1629898150594-a6ae2c6e5194", "1678120958515-ad620ef2b0c9"],
    "Toyota C-HR": ["1652509328308-7f0d7804e678", "1652509328322-3b18daa0111e", "1652509328300-9578821756c9"],
    "Kia Niro": ["1650003678540-e0576a7702ba", "1648537152031-b177997270e3", "1651218792622-92a0f7c5558b"],
    "Hyundai Tucson": ["1646029642262-022158ff5794", "1706082072635-d19df8f0f3fb", "1575090536203-2a6193126514"],
    "Dacia Duster": ["1604395924490-a3a18bb7193e", "1675024281913-f1e53966b136", "1739440318515-be6dadfa6cfb"],
    "Nissan Qashqai": ["1733149085735-78ab905d4ae1", "1551817280-6d59c77ce1b8", "1684839310553-f877b26935a9"],
    "Volkswagen T-Roc": ["1705229810194-dd78431dcb78", "1635519085748-51739bb0fae0"],
    "Toyota Land Cruiser": ["1709620435533-56483034bdd4", "1654688554491-69d21d38fb91", "1603094539392-0d73239f4682"],
    "Suzuki Jimny": ["1675228205797-12a79151cd32", "1622071356556-47f1b87743de", "1675231304947-010c6b57953a"],
    "Volkswagen Tiguan 4Motion": ["1760713173223-59ef015ad368", "1655286182008-2a6578c7f487", "1655286203099-916c6f36da48"],
    "BMW 5 Series": ["1769641241035-cb136ab256cb", "1769641240951-14c26e38c527", "1769641241029-16c2727e0996"],
    "Mercedes-Benz E-Class": ["1675016677618-46b11d65924c", "1765446925577-59a34c05f778", "1679049864217-d845dccae8dd"],
    "Audi A6": ["1652254182724-040f8089b611", "1682408138755-878e5079775a", "1656335889409-808b4119393f"],
    "Tesla Model 3": ["1560958089-b8a1929cea89", "1767949374128-58d3592a273d", "1561580125-028ee3bd62eb"],
    "Volkswagen ID.3": ["1767949374120-098159f02be9", "1655286366299-492c76b5e678", "1609521549292-65cb68a3fac8"],
    "Cupra Born": ["1655288115919-7f8b6480ce53", "1655288137266-e0f6e6bccd1c", "1655288137033-188a83286bae"],
    "Kia Carnival": ["1672216197924-89b8d14a47b1", "1653022779664-3a9d0616548c", "1709791195523-4e9382c2dc6b"],
    "Hyundai Staria": ["1716166411581-5f4099a753b1", "1638850846828-fcb8f537180a", "1646206272308-1c5a2dd21475"],
    "Volkswagen Multivan": ["1665053897558-a79bba9fe417", "1646422462528-0a48ac201c3b", "1634109725557-d2b8ac9f6c5c"],
    "Mercedes-Benz G-Class": ["1756704756051-9aa48231c440", "1569240651611-302c9897bde5", "1648413653877-ade5eefd2f1b"],
    "Porsche 911 Cabriolet": ["1659611807210-917ac61ff451", "1667070884824-c80435b3457b", "1631568440988-54e5aa8f1f24"],
    "Land Rover Defender 110": ["1655468332000-18ecac4ab2c8", "1741905358565-5ae6835ac172", "1741905358583-1999b08d6e2e"],
    "Ford Mustang Convertible": ["1772593547280-d480065a9f73", "1731392913970-737fcafc893b", "1708979418859-5533d33f952b"],
    "Mercedes-Benz S-Class": ["1632823469217-b0ff8f4f9197", "1610099610040-ab19f3a5ec35", "1680446983373-853872fb667a"],
};

/** The colour of the car in each model's first photo, so a car's card reads as it looks (the special cars set theirs). */
export const MODEL_COLORS: Record<string, VehicleColor> = {
    "Fiat 500": "white",
    "MINI Hatch": "red",
    "Kia Picanto": "yellow",
    "Suzuki Ignis": "yellow",
    "Renault Clio": "black",
    "Toyota Yaris": "white",
    "Volkswagen Polo": "grey",
    "Peugeot 208": "blue",
    "Opel Corsa": "white",
    "Ford Fiesta": "silver",
    "Volkswagen Golf": "white",
    "Hyundai i30": "red",
    "Toyota Corolla": "white",
    "Ford Focus": "grey",
    "Mazda 3": "white",
    "Hyundai Elantra": "silver",
    "Audi A3 Sedan": "grey",
    "Mercedes-Benz C-Class": "silver",
    "Mazda 6": "red",
    "Skoda Octavia Combi": "silver",
    "Volkswagen Passat Variant": "black",
    "Volvo V90": "grey",
    "Toyota C-HR": "silver",
    "Kia Niro": "grey",
    "Hyundai Tucson": "red",
    "Dacia Duster": "grey",
    "Nissan Qashqai": "grey",
    "Volkswagen T-Roc": "silver",
    "Toyota Land Cruiser": "white",
    "Suzuki Jimny": "yellow",
    "Volkswagen Tiguan 4Motion": "blue",
    "BMW 5 Series": "grey",
    "Mercedes-Benz E-Class": "white",
    "Audi A6": "white",
    "Tesla Model 3": "white",
    "Volkswagen ID.3": "blue",
    "Cupra Born": "white",
    "Kia Carnival": "white",
    "Hyundai Staria": "white",
    "Volkswagen Multivan": "white",
};

/** A car's photos: its model's own set. A model without one (a later addition) shows its category's photos. */
export function modelPhotos(category: DemoCategorySlug, modelKey: string): string[] {
    return MODEL_PHOTOS[modelKey] ?? CATEGORY_PHOTOS[category];
}

const CLIPS = {
    coastRoad: "https://videos.pexels.com/video-files/8524557/8524557-sd_960_540_30fps.mp4",
    mountainRoad: "https://videos.pexels.com/video-files/15291824/15291824-sd_960_406_24fps.mp4",
    offRoad: "https://videos.pexels.com/video-files/27203969/12093963_960_540_30fps.mp4",
    charging: "https://videos.pexels.com/video-files/9790139/9790139-sd_960_540_30fps.mp4",
};

export const DEMO_VIDEO_URLS = Object.values(CLIPS);

/** Which clips each category shows on the rental site. */
export const CATEGORY_VIDEOS: Partial<Record<DemoCategorySlug, string[]>> = {
    compact: [CLIPS.mountainRoad],
    sedan: [CLIPS.mountainRoad],
    estate: [CLIPS.coastRoad],
    "compact-suv": [CLIPS.coastRoad],
    "suv-4x4": [CLIPS.offRoad, CLIPS.coastRoad],
    premium: [CLIPS.mountainRoad],
    electric: [CLIPS.charging],
    minivan: [CLIPS.offRoad],
};

/** Clips on the cars themselves (panel only): the premium cars. */
export const VEHICLE_VIDEOS: Partial<Record<DemoCategorySlug, string[]>> = {
    premium: [CLIPS.mountainRoad],
};
