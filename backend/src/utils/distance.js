const EARTH_RADIUS_KM = 6371;

/**
 * Returns the great-circle distance in km between two lat/lng points
 * using the Haversine formula.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Returns estimated driving time in minutes assuming ~30 km/h average city speed.
 */
function travelMinutes(distKm) {
  return Math.max(1, Math.round((distKm / 30) * 60));
}

module.exports = { haversineKm, travelMinutes };
