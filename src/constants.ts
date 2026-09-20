export const MEDIUMS = ["HIGHWAY", "RAIL", "MARITIME", "AVIATION", "ORBITAL"] as const;
export type Medium = (typeof MEDIUMS)[number];
