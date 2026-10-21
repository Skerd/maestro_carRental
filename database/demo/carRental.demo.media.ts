/**
 * Demo media for the car-rental fleet. Unsplash photo ids per category (each one
 * checked to show a car of that kind) and Pexels clips per category. Both are
 * free to use; the seed downloads them once and caches them (core demoMedia).
 */

import type {DemoCategorySlug} from "./carRental.demo.data";

export const CATEGORY_PHOTO_SIZE = {width: 1200, height: 750};

export const CATEGORY_PHOTOS: Record<DemoCategorySlug, string[]> = {
    mini: ["1549317661-bd32c8ce0db2", "1698307861902-1b8a64f9be19", "1692970056104-6487775297e8", "1776901259131-ded8999eee1c"],
    economy: ["1541899481282-d53bffe3c35d", "1624543345260-c1f7ad0b7be6", "1572811298797-9eecadf6cb24", "1763604993367-c92cbf4efc57"],
    compact: ["1471444928139-48c5bf5173f8", "1655285142221-2ecd4a91776f", "1573899754191-bd20f600141c", "1611760394284-e2c6b98141cc"],
    sedan: ["1619767886558-efdc259cde1a", "1560009320-c01920eef9f8", "1612287970084-4eb0bc4d4e34", "1546614042-7df3c24c9e5d", "1765446925602-e000af0bfa55"],
    estate: ["1777907158296-e5cd1e31be68", "1766918070462-20206f5610f6", "1763211321083-ccd63db5be94", "1780332524552-9119274359a8", "1777284748695-437c22a7ee50"],
    "compact-suv": ["1630051191354-932e27e318fe", "1575090536203-2a6193126514", "1748214547306-360d11024747", "1519641471654-76ce0107ad1b", "1609521263047-f8f205293f24"],
    "suv-4x4": ["1623013274387-45cbcbc1725b", "1765519697974-5429f4804c48", "1730470577490-40dd6677623a", "1533473359331-0135ef1b58bf", "1563720223185-11003d516935"],
    premium: ["1503376780353-7e6692767b70", "1616422285623-13ff0162193c", "1590362891991-f776e747a588", "1555215695-3004980ad54e", "1768522982031-1ed947a091b0"],
    electric: ["1560958089-b8a1929cea89", "1655288115919-7f8b6480ce53", "1763543007050-4dac73ffc67f", "1639302610362-4c86747e8680"],
    minivan: ["1675311183084-755007dbb223", "1653978681856-ab2f1feb221b", "1623371857133-6d5552bbdc13", "1724479839764-65981526641d", "1649553324097-dec0c232be42"],
};

/** A car's photos: three from its category's set, starting at a different photo per model. */
export function modelPhotos(category: DemoCategorySlug, modelOffset: number): string[] {
    const pool = CATEGORY_PHOTOS[category];
    return [0, 1, 2].map((n) => pool[(modelOffset + n) % pool.length]);
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
