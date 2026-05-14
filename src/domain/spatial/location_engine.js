/**
 * @file domain/spatial/location_engine.js
 * @description OSM-based location analysis — amenity scoring + detailed amenity lists.
 * @version 3.0.0 - Replaced unreliable school-bus OSM tags with private-school list;
 *                  expanded shopping to show malls, Woolworths/Coles, Chemist Warehouse.
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

// True if a school OSM element is identifiably a private/independent/Catholic school.
// Deliberately avoids bare "college" — which matches state secondary colleges (e.g. "Ringwood Secondary College").
// Instead requires explicit private-sector markers or a curated name pattern.
const isPrivateSchool = (tags) =>
  tags.fee === 'yes' ||
  tags['operator:type'] === 'private' ||
  tags['operator:type'] === 'religious' ||
  (tags.denomination && tags.denomination.trim() !== '') ||
  tags['school:type'] === 'private'      ||
  tags['school:type'] === 'catholic'     ||
  tags['school:type'] === 'independent'  ||
  tags['school:type'] === 'Anglican'     ||
  /grammar school|christian college|catholic college|jesuit college|marist college|lasallian|loreto|scotch college|xavier college|penleigh|camberwell grammar|trinity grammar|geelong grammar|st kevin|salesian|assumption college|la trobe christian|methodist ladies|mater christi|mount scopus|emmanuel college|rosehill college|tintern|carey baptist|haileybury|brighton grammar|caulfield grammar|st joseph|parade college|de la salle|st bede|st paul's|marcellin|siena college|pembroke|firbank/i.test(tags.name || '');

export const runLocationAnalysis = async (lat, lon) => {
  const latF = parseFloat(lat);
  const lonF = parseFloat(lon);

  const q = `[out:json][timeout:30];(
    node["railway"="station"](around:3000,${latF},${lonF});
    node["railway"="halt"](around:3000,${latF},${lonF});
    node["railway"="tram_stop"](around:1500,${latF},${lonF});
    node["highway"="bus_stop"](around:700,${latF},${lonF});
    node["amenity"="school"](around:3000,${latF},${lonF});
    way["amenity"="school"](around:3000,${latF},${lonF});
    node["amenity"="university"](around:5000,${latF},${lonF});
    way["amenity"="university"](around:5000,${latF},${lonF});
    node["amenity"="kindergarten"](around:1500,${latF},${lonF});
    way["amenity"="kindergarten"](around:1500,${latF},${lonF});
    node["amenity"="childcare"](around:2000,${latF},${lonF});
    node["shop"="supermarket"](around:3000,${latF},${lonF});
    way["shop"="supermarket"](around:3000,${latF},${lonF});
    node["shop"="mall"](around:5000,${latF},${lonF});
    way["shop"="mall"](around:5000,${latF},${lonF});
    node["shop"="department_store"](around:3000,${latF},${lonF});
    way["shop"="department_store"](around:3000,${latF},${lonF});
    node["shop"="variety_store"](around:3000,${latF},${lonF});
    way["shop"="variety_store"](around:3000,${latF},${lonF});
    node["shop"="chemist"](around:2000,${latF},${lonF});
    way["shop"="chemist"](around:2000,${latF},${lonF});
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
          id:        e.id,
          d,
          distLabel: fmtDist(d),
          name:      e.tags?.name || e.tags?.['name:en'] || e.tags?.operator || '',
          tags:      e.tags || {},
        };
      })
      .filter(x => x.d <= maxD)
      .sort((a, b) => a.d - b.d);

  // -------------------------------------------------------------------------
  // Category lists
  // -------------------------------------------------------------------------
  const allSchools = toList(e => e.tags?.amenity === 'school', 3000);

  const loc = {
    trains:        toList(e => ['station','halt'].includes(e.tags?.railway), 3000),
    trams:         toList(e => e.tags?.railway === 'tram_stop', 1500),
    buses:         toList(e => e.tags?.highway === 'bus_stop', 700),
    schools:       allSchools,
    privateSchools: allSchools.filter(s => isPrivateSchool(s.tags)),
    unis:          toList(e => e.tags?.amenity === 'university', 5000),
    kinders:       toList(e => e.tags?.amenity === 'kindergarten', 1500),
    childcare:     toList(e => e.tags?.amenity === 'childcare', 2000),
    supermarkets:  toList(e => e.tags?.shop === 'supermarket', 3000),
    malls:         toList(e => e.tags?.shop === 'mall', 5000),
    departments:   toList(e => ['department_store','variety_store'].includes(e.tags?.shop), 3000),
    chemists:      toList(e => e.tags?.shop === 'chemist', 2000),
    parks:         toList(e => e.tags?.leisure === 'park', 1000),
    hospitals:     toList(e => e.tags?.amenity === 'hospital', 6000),
    doctors:       toList(e => e.tags?.amenity === 'doctors', 2000),
    pharmacies:    toList(e => e.tags?.amenity === 'pharmacy', 1500),
    cafes:         toList(e => e.tags?.amenity === 'cafe', 800),
    restaurants:   toList(e => e.tags?.amenity === 'restaurant', 800),
    gyms:          toList(e => e.tags?.leisure === 'fitness_centre', 2000),
    libraries:     toList(e => e.tags?.amenity === 'library', 2000),
    community:     toList(e => e.tags?.amenity === 'community_centre', 2000),
    cinemas:       toList(e => e.tags?.amenity === 'cinema', 2000),
    pools:         toList(e => e.tags?.leisure === 'swimming_pool' || e.tags?.amenity === 'swimming_pool', 3000),
  };

  // Branded supermarket splits (by name)
  const woolworths     = loc.supermarkets.filter(x => /woolworths/i.test(x.name));
  const coles          = loc.supermarkets.filter(x => /coles/i.test(x.name));
  const aldi           = loc.supermarkets.filter(x => /aldi/i.test(x.name));
  const iga            = loc.supermarkets.filter(x => /\biga\b/i.test(x.name));
  const otherSuper     = loc.supermarkets.filter(x => !/woolworths|coles|aldi|\biga\b/i.test(x.name));

  // Chemist Warehouse split
  const chemistWarehouse = loc.chemists.filter(x => /chemist warehouse/i.test(x.name));
  const otherChemists    = loc.chemists.filter(x => !/chemist warehouse/i.test(x.name));

  // Branded department stores
  const kmart  = loc.departments.filter(x => /kmart/i.test(x.name));
  const target = loc.departments.filter(x => /\btarget\b/i.test(x.name));
  const bigw   = loc.departments.filter(x => /big\s?w/i.test(x.name));

  // -------------------------------------------------------------------------
  // Scoring — 100 pts total
  // -------------------------------------------------------------------------

  // Transport (30 pts)
  const td      = loc.trains[0]?.d || 9999;
  const tPts    = td <= 400 ? 30 : td <= 800 ? 23 : td <= 1200 ? 15 : td <= 2000 ? 7 : 0;
  const tramBonus = loc.trams.some(t => t.d <= 600) ? 4 : 0;
  const busPts    = loc.buses.some(b => b.d <= 300) ? 3 : loc.buses.some(b => b.d <= 500) ? 1 : 0;
  const tScore    = Math.min(30, tPts + tramBonus + busPts);

  // Education (20 pts)
  const sd      = loc.schools[0]?.d || 9999;
  const sPts    = sd <= 600 ? 12 : sd <= 1000 ? 9 : sd <= 1500 ? 5 : sd <= 2500 ? 2 : 0;
  const uniBonus  = loc.unis.length    ? 3 : 0;
  const kindBonus = loc.kinders.length ? 3 : loc.childcare.length ? 2 : 0;
  const eScore    = Math.min(20, sPts + uniBonus + kindBonus);

  // Shopping (20 pts) — scored on nearest Woolworths/Coles/supermarket within 3 km
  const supD  = loc.supermarkets[0]?.d || 9999;
  const mallD = loc.malls[0]?.d || 9999;
  const shPts = supD <= 400 ? 20 : supD <= 800 ? 15 : supD <= 1200 ? 9 : supD <= 2000 ? 4 : supD <= 3000 ? 2 : 0;
  // Small bonus if a major shopping centre is within 3km
  const mallBonus = mallD <= 1500 ? 3 : mallD <= 3000 ? 1 : 0;
  const shScore   = Math.min(20, shPts + mallBonus);

  // Lifestyle (15 pts)
  const pD      = loc.parks[0]?.d || 9999;
  const pPts    = pD <= 400 ? 7 : pD <= 700 ? 5 : pD <= 1000 ? 2 : 0;
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
  // Detailed breakdown per pillar
  // -------------------------------------------------------------------------

  const nearestItem = (list, fallbackLabel) => {
    if (!list || list.length === 0) return null;
    const first = list[0];
    return { name: first.name || fallbackLabel, dist: first.distLabel, raw: first.d };
  };

  // Best "nearest key amenity" for shopping: nearest mall or nearest Woolworths/Coles
  const shoppingNearestCandidates = [
    loc.malls[0]         ? { icon: '🏬', name: loc.malls[0].name || 'Shopping Centre',   dist: loc.malls[0].distLabel,   raw: loc.malls[0].d } : null,
    woolworths[0]        ? { icon: '🛒', name: woolworths[0].name || 'Woolworths',         dist: woolworths[0].distLabel,  raw: woolworths[0].d } : null,
    coles[0]             ? { icon: '🛒', name: coles[0].name || 'Coles',                  dist: coles[0].distLabel,        raw: coles[0].d } : null,
    loc.supermarkets[0]  ? { icon: '🛒', name: loc.supermarkets[0].name || 'Supermarket', dist: loc.supermarkets[0].distLabel, raw: loc.supermarkets[0].d } : null,
  ].filter(Boolean).sort((a, b) => a.raw - b.raw);

  // Build the shopping items list: malls → Woolworths → Coles → Aldi → IGA → other supers → Chemist Warehouse → other chemists → Kmart/Target/Big W
  const buildShoppingItems = () => {
    const out = [];
    loc.malls.slice(0, 3).forEach(x =>
      out.push({ icon: '🏬', label: x.name || 'Shopping Centre', dist: x.distLabel, type: 'Shopping Centre' }));
    woolworths.slice(0, 2).forEach(x =>
      out.push({ icon: '🟢', label: x.name || 'Woolworths', dist: x.distLabel, type: 'Supermarket' }));
    coles.slice(0, 2).forEach(x =>
      out.push({ icon: '🔴', label: x.name || 'Coles', dist: x.distLabel, type: 'Supermarket' }));
    aldi.slice(0, 1).forEach(x =>
      out.push({ icon: '🛒', label: x.name || 'Aldi', dist: x.distLabel, type: 'Supermarket' }));
    iga.slice(0, 1).forEach(x =>
      out.push({ icon: '🛒', label: x.name || 'IGA', dist: x.distLabel, type: 'Supermarket' }));
    otherSuper.slice(0, 2).forEach(x =>
      out.push({ icon: '🛒', label: x.name || 'Supermarket', dist: x.distLabel, type: 'Supermarket' }));
    chemistWarehouse.slice(0, 2).forEach(x =>
      out.push({ icon: '💊', label: x.name || 'Chemist Warehouse', dist: x.distLabel, type: 'Pharmacy/Chemist' }));
    otherChemists.slice(0, 1).forEach(x =>
      out.push({ icon: '💊', label: x.name || 'Chemist', dist: x.distLabel, type: 'Pharmacy/Chemist' }));
    kmart.slice(0, 1).forEach(x =>
      out.push({ icon: '🏪', label: x.name || 'Kmart', dist: x.distLabel, type: 'Department Store' }));
    target.slice(0, 1).forEach(x =>
      out.push({ icon: '🏪', label: x.name || 'Target', dist: x.distLabel, type: 'Department Store' }));
    bigw.slice(0, 1).forEach(x =>
      out.push({ icon: '🏪', label: x.name || 'Big W', dist: x.distLabel, type: 'Department Store' }));
    return out;
  };

  const breakdown = {
    transport: {
      score: tScore, max: 30,
      nearestKey: td <= 3000
        ? { icon: '🚂', name: loc.trains[0]?.name || 'Train Station', dist: fmtDist(td), raw: td }
        : (loc.trams[0] ? { icon: '🚋', name: loc.trams[0].name || 'Tram Stop', dist: loc.trams[0].distLabel, raw: loc.trams[0].d } : null),
      thresholds: '≤400m = 30pts · ≤800m = 23pts · ≤1.2km = 15pts · ≤2km = 7pts · >2km = 0; +4pts tram ≤600m; +3pts bus ≤300m',
      detail: [
        td <= 3000 ? `Train: ${fmtDist(td)} (${loc.trains[0]?.name || 'Station'})` : 'No train within 3 km',
        loc.trams.length ? `${loc.trams.length} tram stop(s), nearest ${loc.trams[0]?.distLabel}` : null,
        loc.buses.length ? `${loc.buses.length} bus stop(s) within 700m` : 'No bus stops within 700m',
      ].filter(Boolean).join(' · '),
      items: [
        ...loc.trains.slice(0, 3).map(x => ({ icon: '🚂', label: x.name || 'Train Station', dist: x.distLabel })),
        ...loc.trams.slice(0, 3).map(x =>  ({ icon: '🚋', label: x.name || 'Tram Stop',      dist: x.distLabel })),
        ...loc.buses.slice(0, 4).map(x =>  ({ icon: '🚌', label: x.name || 'Bus Stop',       dist: x.distLabel })),
      ],
    },

    // Private schools (replaces unreliable school-bus OSM data)
    privateSchools: {
      score: 0, max: 0, // informational only
      nearestKey: loc.privateSchools[0]
        ? { icon: '🏫', name: loc.privateSchools[0].name || 'Private School', dist: loc.privateSchools[0].distLabel, raw: loc.privateSchools[0].d }
        : null,
      thresholds: 'Informational only — not included in score. Private schools typically run bus routes; contact school directly.',
      detail: loc.privateSchools.length
        ? `${loc.privateSchools.length} private/independent school(s) within 3 km — contact each school for bus route details`
        : 'No private/independent schools identified within 3 km (OSM coverage may be incomplete)',
      items: loc.privateSchools.slice(0, 8).map(x => ({
        icon: '🏫',
        label: x.name || 'Private School',
        dist: x.distLabel,
        type: x.tags?.denomination
          ? x.tags.denomination.charAt(0).toUpperCase() + x.tags.denomination.slice(1)
          : (x.tags?.['school:type'] ? x.tags['school:type'] : 'Independent'),
        operator: x.tags?.operator || '',
      })),
    },

    education: {
      score: eScore, max: 20,
      nearestKey: nearestItem(loc.schools, 'School') ? { icon: '🏫', ...nearestItem(loc.schools, 'School') } : null,
      thresholds: 'School ≤600m = 12pts · ≤1km = 9pts · ≤1.5km = 5pts · ≤2.5km = 2pts; +3pts university; +3pts kindergarten',
      detail: [
        loc.schools.length ? `${loc.schools.length} school(s), nearest ${fmtDist(sd)} (${loc.schools[0]?.name || 'School'})` : 'No schools within 3 km',
        loc.unis.length    ? `${loc.unis.length} university(ies)` : null,
        loc.kinders.length ? `${loc.kinders.length} kindergarten(s)` : null,
        loc.childcare.length ? `${loc.childcare.length} childcare centre(s)` : null,
      ].filter(Boolean).join(' · '),
      items: [
        ...loc.schools.slice(0, 4).map(x =>  ({ icon: '🏫', label: x.name || 'School',          dist: x.distLabel, type: x.tags?.['school:type'] || '' })),
        ...loc.unis.slice(0, 2).map(x =>     ({ icon: '🎓', label: x.name || 'University',       dist: x.distLabel, type: 'University' })),
        ...loc.kinders.slice(0, 2).map(x =>  ({ icon: '🌱', label: x.name || 'Kindergarten',     dist: x.distLabel, type: 'Kindergarten' })),
        ...loc.childcare.slice(0, 2).map(x =>({ icon: '👶', label: x.name || 'Childcare Centre', dist: x.distLabel, type: 'Childcare' })),
      ],
    },

    shopping: {
      score: shScore, max: 20,
      nearestKey: shoppingNearestCandidates[0] || null,
      thresholds: 'Nearest supermarket ≤400m = 20pts · ≤800m = 15pts · ≤1.2km = 9pts · ≤2km = 4pts · ≤3km = 2pts; mall ≤1.5km +3pts',
      detail: [
        loc.malls.length
          ? `${loc.malls.length} shopping centre(s), nearest ${fmtDist(mallD)} (${loc.malls[0]?.name || 'Shopping Centre'})`
          : 'No shopping centre within 5 km',
        woolworths.length ? `Woolworths ${woolworths[0].distLabel}` : null,
        coles.length      ? `Coles ${coles[0].distLabel}` : null,
        chemistWarehouse.length ? `Chemist Warehouse ${chemistWarehouse[0].distLabel}` : null,
        !woolworths.length && !coles.length && loc.supermarkets.length
          ? `${loc.supermarkets.length} supermarket(s), nearest ${fmtDist(supD)}`
          : null,
      ].filter(Boolean).join(' · '),
      items: buildShoppingItems(),
    },

    lifestyle: {
      score: lScore, max: 15,
      nearestKey: nearestItem(loc.parks, 'Park') ? { icon: '🌳', ...nearestItem(loc.parks, 'Park') } : null,
      thresholds: 'Park ≤400m = 7pts · ≤700m = 5pts · ≤1km = 2pts; cafés ≥1 = 1pt · ≥4 = 3pts · ≥8 = 5pts; gym = 3pts',
      detail: [
        loc.parks.length ? `${loc.parks.length} park(s), nearest ${fmtDist(pD)}` : 'No parks within 1 km',
        loc.cafes.length ? `${loc.cafes.length} café(s) within 800m` : 'No cafés within 800m',
        loc.restaurants.length ? `${loc.restaurants.length} restaurant(s)` : null,
        loc.gyms.length ? `${loc.gyms.length} gym(s)` : 'No gyms within 2 km',
      ].filter(Boolean).join(' · '),
      items: [
        ...loc.parks.slice(0, 3).map(x =>      ({ icon: '🌳', label: x.name || 'Park',           dist: x.distLabel })),
        ...loc.cafes.slice(0, 4).map(x =>      ({ icon: '☕', label: x.name || 'Café',            dist: x.distLabel })),
        ...loc.restaurants.slice(0, 2).map(x =>({ icon: '🍽️', label: x.name || 'Restaurant',     dist: x.distLabel })),
        ...loc.gyms.slice(0, 2).map(x =>       ({ icon: '🏋️', label: x.name || 'Fitness Centre', dist: x.distLabel })),
        ...loc.pools.slice(0, 1).map(x =>      ({ icon: '🏊', label: x.name || 'Swimming Pool',  dist: x.distLabel })),
        ...loc.cinemas.slice(0, 1).map(x =>    ({ icon: '🎬', label: x.name || 'Cinema',         dist: x.distLabel })),
      ],
    },

    health: {
      score: hScore, max: 15,
      nearestKey: nearestItem(loc.hospitals, 'Hospital') ? { icon: '🏥', ...nearestItem(loc.hospitals, 'Hospital') } : null,
      thresholds: 'Hospital ≤2km = 7pts · ≤4km = 4pts · ≤6km = 2pts; GP ≤800m = 5pts · ≤1.5km = 3pts; pharmacy ≤600m = 3pts',
      detail: [
        loc.hospitals.length ? `${loc.hospitals.length} hospital(s), nearest ${fmtDist(hD)} (${loc.hospitals[0]?.name || 'Hospital'})` : 'No hospital within 6 km',
        loc.doctors.length   ? `${loc.doctors.length} GP clinic(s), nearest ${loc.doctors[0]?.distLabel}` : 'No GPs within 2 km',
        loc.pharmacies.length ? `${loc.pharmacies.length} pharmacy(ies)` : 'No pharmacy within 1.5 km',
      ].filter(Boolean).join(' · '),
      items: [
        ...loc.hospitals.slice(0, 2).map(x =>  ({ icon: '🏥', label: x.name || 'Hospital',          dist: x.distLabel })),
        ...loc.doctors.slice(0, 4).map(x =>    ({ icon: '👨‍⚕️', label: x.name || 'GP Clinic',      dist: x.distLabel })),
        ...loc.pharmacies.slice(0, 3).map(x => ({ icon: '💊', label: x.name || 'Pharmacy',          dist: x.distLabel })),
        ...loc.libraries.slice(0, 1).map(x =>  ({ icon: '📚', label: x.name || 'Library',           dist: x.distLabel })),
        ...loc.community.slice(0, 1).map(x =>  ({ icon: '🏛️', label: x.name || 'Community Centre', dist: x.distLabel })),
      ],
    },
  };

  return { ...loc, score, label, breakdown };
};
