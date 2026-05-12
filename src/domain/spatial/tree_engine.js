/**
 * Tree Protection Zone (TPZ) Engine
 * Standard: AS 4970-2009
 * @version 1.1.0 - Added getNatureStripTrees, classifyTree
 */

export function calcTPZFromDBH(dbhMm) {
  return Math.max(0, ((parseInt(dbhMm) || 0) / 1000) * 12);
}

export function calculateTPZEncroachment(osmTrees, hasVPO) {
  if (!osmTrees || osmTrees.length === 0) return 0;
  const sigCount = hasVPO ? Math.max(1, Math.floor(osmTrees.length * 0.5)) : 0;
  const stdCount = Math.max(0, osmTrees.length - sigCount);
  const sigArea  = sigCount * Math.round(Math.PI * 7.2 * 7.2 * 0.45);
  const stdArea  = stdCount * Math.round(Math.PI * 3.6 * 3.6 * 0.45);
  return Math.round(sigArea + stdArea);
}

/**
 * Classify a single tree's significance under Victorian council rules.
 * @param {Object}  tree       - { dbhMm, type }
 * @param {boolean} hasVPO
 * @returns {Object} { significant, riskBand, tpzRadius, action, dbh }
 */
export function classifyTree(tree, hasVPO = false) {
  const dbh       = parseInt(tree && tree.dbhMm) || 0;
  const tpzRadius = calcTPZFromDBH(dbh);
  const isStreet  = (tree && tree.type) === 'street' || (tree && tree.type) === 'nature_strip';
  const significant = dbh >= 300 || isStreet || hasVPO;

  let riskBand = 'low';
  let action   = 'Monitor';

  if (significant && dbh >= 600) {
    riskBand = 'critical';
    action   = 'Arborist report + Council permit required. May be immovable.';
  } else if (significant && dbh >= 300) {
    riskBand = 'high';
    action   = 'Arborist report required. TPZ exclusion zone enforced.';
  } else if (dbh >= 150) {
    riskBand = 'medium';
    action   = 'Notify council. Low-impact works may proceed with conditions.';
  }

  return { significant, riskBand, tpzRadius, action, dbh };
}

/**
 * Detect nature-strip (council verge) trees within the site frontage zone.
 * Nature-strip trees require council permit for removal, and root zones
 * may encroach into the site affecting footings and services.
 *
 * @param {Array}   osmTrees      - Raw OSM tree objects
 * @param {number}  frontageMetre - Site frontage width (metres)
 * @param {boolean} hasVPO
 * @returns {Object} { trees, encroachmentM2, estimatedCost, permitRequired, alerts }
 */
export function getNatureStripTrees(osmTrees, frontageMetre, hasVPO) {
  if (osmTrees === undefined) osmTrees = [];
  if (frontageMetre === undefined) frontageMetre = 0;
  if (hasVPO === undefined) hasVPO = false;

  var result = {
    trees:          [],
    encroachmentM2: 0,
    estimatedCost:  0,
    permitRequired: false,
    alerts:         []
  };

  if (!osmTrees || osmTrees.length === 0) return result;

  var candidates = osmTrees.filter(function(t) {
    return t.type === 'nature_strip' || t.type === 'street' ||
           (t.tags && t.tags.natural === 'tree');
  });

  if (candidates.length === 0) return result;

  candidates.forEach(function(tree) {
    var classified = classifyTree(tree, hasVPO);
    result.trees.push(Object.assign({}, tree, classified));
    var encroachArea = Math.round(Math.PI * classified.tpzRadius * classified.tpzRadius * 0.30);
    result.encroachmentM2 += encroachArea;
    if (classified.significant) {
      result.permitRequired = true;
      result.estimatedCost += classified.riskBand === 'critical' ? 8500 : 3500;
      result.alerts.push('Nature-strip tree (DBH ~' + classified.dbh + 'mm): ' + classified.action);
    }
  });

  if (result.trees.length > 1 && frontageMetre > 0) {
    var rootBarrierCost = Math.round(frontageMetre * 180);
    result.estimatedCost += rootBarrierCost;
    result.alerts.push('Root barrier recommended along ' + frontageMetre + 'm frontage: ~$' + rootBarrierCost.toLocaleString());
  }

  return result;
}
