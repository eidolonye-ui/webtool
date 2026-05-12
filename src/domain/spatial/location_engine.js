/**
 * @file domain/spatial/location_engine.js
 * @description OSM-based location analysis — amenity scoring + detailed amenity lists.
 * @version 2.0.0 - Added school buses, detailed per-amenity data, richer breakdown.
 */

import { ENV } from '../../core/config/env_config';

// Haversine distance in metres between two lat/lon points
const distM = (lat1, lon1, lat2, lon2) => {
  const dx = (lat1 - lat2) * 111320;
  const dy = (lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.round(Math.sqrt(dx * dx + dy * dy));
};

// Format a distance for display: "350 m" or "1.2 km"
const fmtDist = (m) => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m';

export const runLocationAnalysis = async (lat, lon) => {
  const latF = parseFloat(lat);
  const lonF = parseFloat(lon);

  const q = `[out:json][timeout:30];(
    node["railway"="station"](around:3000,${latF},${lonF});
    node["railway"="halt"](around:3000,${latF},${lonF});
    node["railway"="tram_stop"](around:1500,${latF},${lonF});
    node["highway"="bus_stop"](around:700,${latF},${lonF});
    node["highway"="bus_stop"]["school_bus"="yes"](around:2000,${latF},${lonF});
    way["highway"="bus_stop"]["school_bus"="yes"](around:2000,${latF},${lonF});
    node["amenity"="school"](around:2500,${latF},${lonF});
    way["amenity"="school"](around:2500,${latF},${lonF});
    node["amenity"="university"](around:5000,${latF},${lonF});
    way["amenity"="university"](around:5000,${latF},${lonF});
    node["amenity"="kindergarten"](around:1500,${latF},${lonF});
    way["amenity"="kindergarten"](around:1500,${latF},${lonF});
    node["amenity"="childcare"](around:2000,${latF},${lonF});
    node["shop"="supermarket"](around:2000,${latF},${lonF});
    way["shop"="supermarket"](around:2000,${latF},${lonF});
    node["shop"="mall"](around:4000,${latF},${lonF});
    way["landuse"="retail"](around:2000,${latF},${lonF});
    way["leisure"="park"](around:1000,${latF},${lonF});
    node["leisure"="pitch"](around:1000,${latF},${lonF});
    way["leisure"="pitch"](around:1000,${latF},${lonF});
    node["amenity"="hospital"](around:6000,${latF},${lonF});
    node["amenity"="doctors"](around:2000,${latF},${lonF});
    node["amenity"="pharmacy"](around:1500,${latF},${lonF});
    node["amenity"="cafe"](around:800,${latF},${lonF});
    node["amenity"="restaurant"](around:800,${latF},${lonF});
    node["leisure"="fitness_centre"](around:2000,${latF},${lonF});
    node["amenity"="library"](around:2000,${latF},${lonF});
    node["amenity"="community_centre"](around:2000,${latF},${lonF});
    node["amenity"="cinema"](around:2000,${latF},${lonF});
    node["amenity"="swimming_pool"](around:3000,${latF},${lonF});
    way["leisure"="swimming_pool"](around:3000,${latF},${lonF});
  );out body center;`;

  const mirrors = [
    ENV?.spatial?.overpass || 'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ];

  let osmResp = null;
  for (const mirror of mirrors) {
    try {
      osmResp = await fetch(mirror + '?data=' + encodeURIComponent(q), {
        signal: AbortSignal.timeout(25000),
      });
      if (osmResp.ok) break;
    } catch (e) {
      osmResp = null;
    }
  }
  if (!osmResp || !osmResp.ok) throw new Error('Location analysis: all Overpass mirrors failed');

  const json = await osmResp.json();
  const el   = json.elements || [];

  // Build a normalised amenity list from an element array
  const toList = (filter, maxD = 9999) =>
    el
      .filter(filter)
      .map(e => {
        const eLat = e.lat || e.center?.lat || 0;
        const eLon = e.lon || e.center?.lon || 0;
        const d    = distM(latF, lonF, eLat, eLon);
        return {
          id:       e.id,
          d,
          distLabel: fmtDist(d),
          name:     e.tags?.name || e.tags?.['name:en'] || e.tags?.operator || '',
          tags:     e.tags || {},
        };
      })
      .filter(x => x.d <= maxD)
      .sort((a, b) => a.d - b.d);

  // -------------------------------------------------------------------------
  // Category lists
  // -------------------------------------------------------------------------
  const loc = {
    trains:       toList(e => ['station','halt'].includes(e.tags?.railway), 3000),
    trams:        toList(e => e.tags?.railway === 'tram_stop', 1500),
    buses:        toList(e => e.tags?.highway === 'bus_stop' && e.tags?.school_bus !== 'yes', 700),
    schoolBuses:  toList(e => e.tags?.highway === 'bus_stop' && e.tags?.school_bus === 'yes', 2000),
    schools:      toList(e => e.tags?.amenity === 'school', 2500),
    unis:         toList(e => e.tags?.amenity === 'university', 5000),
    kinders:      toList(e => e.tags?.amenity === 'kindergarten', 1500),
    childcare:    toList(e => e.tags?.amenity === 'childcare', 2000),
    supermarkets: toList(e => e.tags?.shop === 'supermarket', 2000),
    parks:        toList(e => e.tags?.leisure === 'park', 1000),
    hospitals:    toList(e => e.tags?.amenity === 'hospital', 6000),
    doctors:      toList(e => e.tags?.amenity === 'doctors', 2000),
    pharmacies:   toList(e => e.tags?.amenity === 'pharmacy', 1500),
    cafes:        toList(e => e.tags?.amenity === 'cafe', 800),
    restaurants:  toList(e => e.tags?.amenity === 'restaurant', 800),
    gyms:         toList(e => e.tags?.leisure === 'fitness_centre', 2000),
    libraries:    toList(e => e.tags?.amenity === 'library', 2000),
    community:    toList(e => e.tags?.amenity === 'community_centre', 2000),
    cinemas:      toList(e => e.tags?.amenity === 'cinema', 2000),
    pools:        toList(e => ['swimming_pool'].includes(e.tags?.leisure) || e.tags?.amenity === 'swimming_pool', 3000),
  };

  // -------------------------------------------------------------------------
  // Scoring — 100 pts total
  // -------------------------------------------------------------------------

  // Transport (30 pts)
  const td   = loc.trains[0]?.d || 9999;
  const tPts = td <= 400 ? 30 : td <= 800 ? 23 : td <= 1200 ? 15 : td <= 2000 ? 7 : 0;
  const tramBonus = loc.trams.some(t => t.d <= 600) ? 4 : 0;
  const busPts    = loc.buses.some(b => b.d <= 300) ? 3 : loc.buses.some(b => b.d <= 500) ? 1 : 0;
  const tScore    = Math.min(30, tPts + tramBonus + busPts);

  // Education (20 pts)
  const sd   = loc.schools[0]?.d || 9999;
  const sPts = sd <= 600 ? 12 : sd <= 1000 ? 9 : sd <= 1500 ? 5 : sd <= 2500 ? 2 : 0;
  const uniBonus  = loc.unis.length    ? 3 : 0;
  const kindBonus = loc.kinders.length ? 3 : loc.childcare.length ? 2 : 0;
  const eScore    = Math.min(20, sPts + uniBonus + kindBonus);

  // Shopping (20 pts)
  const supD  = loc.supermarkets[0]?.d || 9999;
  const shPts = supD <= 400 ? 20 : supD <= 800 ? 15 : supD <= 1200 ? 9 : supD <= 2000 ? 4 : 0;
  const shScore = shPts;

  // Lifestyle (15 pts)
  const pD    = loc.parks[0]?.d || 9999;
  const pPts  = pD <= 400 ? 7 : pD <= 700 ? 5 : pD <= 1000 ? 2 : 0;
  const cafePts = loc.cafes.length >= 8 ? 5 : loc.cafes.length >= 4 ? 3 : loc.cafes.length >= 1 ? 1 : 0;
  const gymPts  = loc.gyms.length ? 3 : 0;
  const lScore  = Math.min(15, pPts + cafePts + gymPts);

  // Health (15 pts)
  const hD    = loc.hospitals[0]?.d || 9999;
  const hPts  = hD <= 2000 ? 7 : hD <= 4000 ? 4 : hD <= 6000 ? 2 : 0;
  const drPts = loc.doctors.some(d => d.d <= 800) ? 5 : loc.doctors.some(d => d.d <= 1500) ? 3 : 0;
  const phPts = loc.pharmacies.some(p => p.d <= 600) ? 3 : 0;
  const hScore = Math.min(15, hPts + drPts + phPts);

  const score = tScore + eScore + shScore + lScore + hScore;
  const label = score >= 80 ? 'Premium Location'
    : score >= 65 ? 'Good Location'
    : score >= 50 ? 'Average Location'
    : score >= 35 ? 'Below Average'
    : 'Remote / Poor Access';

  // -------------------------------------------------------------------------
  // Detailed breakdown per pillar — includes itemised amenity lists
  // -------------------------------------------------------------------------
  const breakdown = {
    transport: {
      score: tScore, max: 30,
      detail: `Train: ${td <= 9000 ? fmtDist(td) : 'none'} · ${loc.trams.length} tram stop(s) · ${loc.buses.length} bus stop(s)`,
      items: [
        ...loc.trains.slice(0, 3).map(x => ({ icon: '🚂', label: x.name || 'Train Station', dist: x.distLabel })),
        ...loc.trams.slice(0, 3).map(x => ({ icon: '🚋', label: x.name || 'Tram Stop',      dist: x.distLabel })),
        ...loc.buses.slice(0, 4).map(x => ({ icon: '🚌', label: x.name || 'Bus Stop',       dist: x.distLabel })),
      ],
    },
    schoolBuses: {
      score: 0, max: 0, // informational only — not scored
      detail: loc.schoolBuses.length
        ? `${loc.schoolBuses.length} school bus stop(s) within 2 km`
        : 'No school bus stops found within 2 km',
      items: loc.schoolBuses.slice(0, 6).map(x => ({
        icon: '🚐',
        label: x.name || (x.tags?.operator ? 'School Bus — ' + x.tags.operator : 'School Bus Stop'),
        dist: x.distLabel,
        operator: x.tags?.operator || x.tags?.network || '',
        ref: x.tags?.ref || x.tags?.route_ref || '',
      })),
    },
    education: {
      score: eScore, max: 20,
      detail: `${loc.schools.length} school(s) · ${loc.unis.length} uni(s) · ${loc.kinders.length} kinder(s) · ${loc.childcare.length} childcare`,
      items: [
        ...loc.schools.slice(0, 4).map(x => ({ icon: '🏫', label: x.name || 'School',          dist: x.distLabel, type: x.tags?.['school:type'] || x.tags?.['school:level'] || '' })),
        ...loc.unis.slice(0, 2).map(x =>    ({ icon: '🎓', label: x.name || 'University',       dist: x.distLabel, type: 'University' })),
        ...loc.kinders.slice(0, 2).map(x => ({ icon: '🌱', label: x.name || 'Kindergarten',     dist: x.distLabel, type: 'Kindergarten' })),
        ...loc.childcare.slice(0, 2).map(x =>({ icon: '👶', label: x.name || 'Childcare Centre', dist: x.distLabel, type: 'Childcare' })),
      ],
    },
    shopping: {
      score: shScore, max: 20,
      detail: `${loc.supermarkets.length} supermarket(s), nearest ${supD <= 9000 ? fmtDist(supD) : 'none'}`,
      items: [
        ...loc.supermarkets.slice(0, 4).map(x => ({ icon: '🛒', label: x.name || 'Supermarket', dist: x.distLabel })),
      ],
    },
    lifestyle: {
      score: lScore, max: 15,
      detail: `${loc.parks.length} park(s) · ${loc.cafes.length} café(s) · ${loc.restaurants.length} restaurant(s) · ${loc.gyms.length} gym(s)`,
      items: [
        ...loc.parks.slice(0, 3).map(x =>      ({ icon: '🌳', label: x.name || 'Park',           dist: x.distLabel })),
        ...loc.cafes.slice(0, 4).map(x =>      ({ icon: '☕', label: x.name || 'Café',            dist: x.distLabel })),
        ...loc.restaurants.slice(0, 2).map(x =>({ icon: '🍽', label: x.name || 'Restaurant',      dist: x.distLabel })),
        ...loc.gyms.slice(0, 2).map(x =>       ({ icon: '🏋', label: x.name || 'Fitness Centre',  dist: x.distLabel })),
        ...loc.pools.slice(0, 1).map(x =>      ({ icon: '🏊', label: x.name || 'Swimming Pool',   dist: x.distLabel })),
        ...loc.cinemas.slice(0, 1).map(x =>    ({ icon: '🎬', label: x.name || 'Cinema',          dist: x.distLabel })),
      ],
    },
    health: {
      score: hScore, max: 15,
      detail: `${loc.hospitals.length} hospital(s) · ${loc.doctors.length} GP clinic(s) · ${loc.pharmacies.length} pharmacy(ies)`,
      items: [
        ...loc.hospitals.slice(0, 2).map(x =>  ({ icon: '🏥', label: x.name || 'Hospital',  dist: x.distLabel })),
        ...loc.doctors.slice(0, 4).map(x =>    ({ icon: '👨‍⚕️', label: x.name || 'GP Clinic', dist: x.distLabel })),
        ...loc.pharmacies.slice(0, 3).map(x => ({ icon: '💊', label: x.name || 'Pharmacy',  dist: x.distLabel })),
        ...loc.libraries.slice(0, 1).map(x =>  ({ icon: '📚', label: x.name || 'Library',   dist: x.distLabel })),
        ...loc.community.slice(0, 1).map(x =>  ({ icon: '🏛', label: x.name || 'Community Centre', dist: x.distLabel })),
      ],
    },
  };

  return { ...loc, score, label, breakdown };
};
