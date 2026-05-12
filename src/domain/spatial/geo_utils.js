/**
 * Geographic Utility Functions
 * Faithfully migrated from legacy monolith.
 */

/**
 * Calculate distance to Melbourne CBD
 * Coordinates: -37.8136, 144.9631
 */
export function calcCBDDist(lat, lon) {
  const R = 6371,
    dLat = ((lat - -37.8136) * Math.PI) / 180,
    dLon = ((lon - 144.9631) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((-37.8136 * Math.PI) / 180) *
    Math.cos((lat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Zone Code Normaliser (e.g., "GRZ1" -> "GRZ")
 */
export function normaliseZone(code) {
  if (!code) return "";
  const m = (code + "")
    .toUpperCase()
    .match(
      /^(GRZ|NRZ|RGZ|MUZ|C1Z|C2Z|LDRZ|TZ|PUZ|FZ|RCZ|PCRZ|CCZ|CAZ|MHZ)/,
    );
  return m ? m[1] : "";
}

/**
 * Extract Zone Schedule Number (e.g., "GRZ1" -> "1")
 */
export function getZoneScheduleNum(code) {
  if (!code) return "";
  const m = (code + "")
    .toUpperCase()
    .match(/^(?:GRZ|NRZ|RGZ|MUZ|C1Z)(\d+)$/);
  return m ? m[1] : "";
}
