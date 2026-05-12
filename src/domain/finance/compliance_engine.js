/**
 * @file domain/finance/compliance_engine.js
 * @description Professional compliance auditor for Planning and Zoning.
 * Validates site data against zoning rules to provide real-time feedback.
 * @version 3.0.0
 */

export const validateCompliance = (siteData, zoningRules) => {
  const results = [];
  
  if (!siteData || !zoningRules) return results;

  // 1. Site Coverage Check
  if (siteData.siteCoverage !== undefined && zoningRules.maxSiteCoverage) {
    const isCompliant = siteData.siteCoverage <= zoningRules.maxSiteCoverage;
    results.push({
      metric: 'Site Coverage',
      value: `${siteData.siteCoverage}%`,
      limit: `${zoningRules.maxSiteCoverage}%`,
      status: isCompliant ? 'ok' : 'danger',
      message: isCompliant 
        ? 'Within allowable limit' 
        : `Exceeds limit by ${ (siteData.siteCoverage - zoningRules.maxSiteCoverage).toFixed(1) }%`
    });
  }

  // 2. Max Height Check
  if (siteData.maxHeight !== undefined && zoningRules.maxHeight) {
    const isCompliant = siteData.maxHeight <= zoningRules.maxHeight;
    results.push({
      metric: 'Max Height',
      value: `${siteData.maxHeight}m`,
      limit: `${zoningRules.maxHeight}m`,
      status: isCompliant ? 'ok' : 'danger',
      message: isCompliant 
        ? 'Complies with height limit' 
        : `Exceeds limit by ${ (siteData.maxHeight - zoningRules.maxHeight).toFixed(1) }m`
    });
  }

  // 3. Min Lot Size Check
  if (siteData.area !== undefined && zoningRules.minLotSize) {
    const isCompliant = siteData.area >= zoningRules.minLotSize;
    results.push({
      metric: 'Minimum Lot Size',
      value: `${siteData.area}sqm`,
      limit: `${zoningRules.minLotSize}sqm`,
      status: isCompliant ? 'ok' : 'danger',
      message: isCompliant 
        ? 'Sufficient land area' 
        : `Short by ${ (zoningRules.minLotSize - siteData.area).toFixed(0) }sqm`
    });
  }

  return results;
};
