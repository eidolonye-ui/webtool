/**
 * @file domain/spatial/siteInsightMapper.js
 * @description Logic for translating raw site data into role-specific insights.
 * Implementation of the "One Source of Truth, Multiple Interpretations" philosophy.
 * @version 1.1.0 - PERSONA INFILTRATION UPGRADE
 */

export const PERSONA_CONFIG = {
  developer: {
    color: '#0f4c75',
    label: 'Developer',
    focus: 'ROI & Risk',
    accent: '#e1f5fe',
    ambientGlow: 'rgba(15, 76, 117, 0.2)',
    density: 'high'
  },
  architect: {
    color: '#00b894',
    label: 'Architect',
    focus: 'Design & Constraints',
    accent: '#e8f5e9',
    ambientGlow: 'rgba(0, 184, 148, 0.2)',
    density: 'medium'
  },
  builder: {
    color: '#e17055',
    label: 'Builder',
    focus: 'Execution & Cost',
    accent: '#fff3e0',
    ambientGlow: 'rgba(225, 112, 85, 0.2)',
    density: 'low'
  },
  decision_maker: {
    color: '#6c5ce7',
    label: 'Decision Maker',
    focus: 'Strategic Alignment',
    accent: '#efedff',
    ambientGlow: 'rgba(108, 92, 231, 0.2)',
    density: 'summary'
  }
};

/**
 * Maps raw site data to role-specific insights.
 * @param {Object} data - The raw site data (slope, aspect, zoning, etc.)
 * @param {string} persona - The active persona (developer | architect | builder | decision_maker)
 * @returns {Object} - Role-specific insights
 */
export const getSiteInsights = (data, persona) => {
  const { maxSlope, aspect, zoning, heightLimit, risks } = data;
  
  const insights = {
    developer: {
      primaryMetric: {
        label: 'Investment Grade',
        value: calculateInvestmentGrade(data),
        icon: '💎'
      },
      metrics: [
        { 
          label: 'Density Potential', 
          value: data.maxSlope < 5 ? 'High (3-5 units)' : 'Medium (2-3 units)', 
          desc: 'Slope affects the total buildable area.',
          impact: 'Critical'
        },
        { 
          label: 'Strategic Risk', 
          value: risks.length > 0 ? 'Elevated' : 'Low', 
          desc: risks.length > 0 ? `Detected: ${risks.join(', ')}` : 'No major overlays found.',
          impact: 'High'
        }
      ],
      strategicAdvice: `This site is a ${calculateInvestmentGrade(data)} investment. The ${aspect} aspect is a major selling point, but the ${maxSlope}% slope will require a careful budget for earthworks.`
    },
    architect: {
      primaryMetric: {
        label: 'Design Complexity',
        value: maxSlope > 7 ? 'High' : 'Low',
        icon: '📐'
      },
      metrics: [
        { 
          label: 'Building Envelope', 
          value: `Limit ${heightLimit}m`, 
          desc: `Zoning ${zoning} allows for maximum ${heightLimit}m height.`,
          impact: 'High'
        },
        { 
          label: 'Environmental Asset', 
          value: `${aspect} Aspect`, 
          desc: 'Ideal for placing living areas to maximize natural light.',
          impact: 'Positive'
        },
        { 
          label: 'Slope Gradient', 
          value: `${maxSlope}%`, 
          desc: 'Requires stepped floor levels or significant cut/fill.',
          impact: 'Medium'
        }
      ],
      strategicAdvice: `Focus on a split-level design to embrace the ${maxSlope}% slope. Prioritize the ${aspect} facade to maximize the value of the orientation.`
    },
    builder: {
      primaryMetric: {
        label: 'Execution Risk',
        value: maxSlope > 7 ? 'High' : 'Low',
        icon: '🏗️'
      },
      metrics: [
        { 
          label: 'Foundation Type', 
          value: maxSlope > 5 ? 'Piles / Stepped Slab' : 'Standard Raft Slab', 
          desc: 'Based on the ${maxSlope}% gradient.',
          impact: 'High'
        },
        { 
          label: 'Material Spec', 
          value: risks.includes('Bushfire') ? 'BAL-29 or higher' : 'Standard', 
          desc: 'Required based on site risk overlays.',
          impact: 'Medium'
        },
        { 
          label: 'Earthworks Vol.', 
          value: maxSlope > 5 ? 'Significant' : 'Minimal', 
          desc: 'Estimated based on slope and frontage.',
          impact: 'Critical'
        }
      ],
      strategicAdvice: `Prepare for significant earthworks. The ${maxSlope}% slope means we need specialized shoring and potential retaining walls on the south boundary.`
    },
    decision_maker: {
      primaryMetric: {
        label: 'Opportunity Score',
        value: `${calculateOpportunityScore(data)}%`,
        icon: '🎯'
      },
      metrics: [
        { 
          label: 'Strategic Fit', 
          value: calculateInvestmentGrade(data), 
          desc: 'Alignment with target portfolio benchmarks.',
          impact: 'High'
        },
        { 
          label: 'Risk Profile', 
          value: risks.length > 0 ? 'High' : 'Low', 
          desc: 'Based on identified site constraints.',
          impact: 'Medium'
        }
      ],
      strategicAdvice: `The site demonstrates a ${calculateOpportunityScore(data)}% strategic alignment. The ${aspect} aspect is a key value driver, while the ${maxSlope}% slope represents the primary cost variable.`
    }
  };

  return insights[persona] || insights.developer;
};

// Internal helper functions for scoring
function calculateOpportunityScore(data) {
  let score = 70; // Base score
  if (data.aspect === 'North') score += 15;
  if (data.maxSlope < 3) score += 10;
  if (data.maxSlope > 10) score -= 20;
  if (data.risks.length > 0) score -= 10 * data.risks.length;
  return Math.min(Math.max(score, 0), 100);
}

function calculateInvestmentGrade(data) {
  const score = calculateOpportunityScore(data);
  if (score > 85) return 'Premium';
  if (score > 70) return 'Strong';
  if (score > 50) return 'Average';
  return 'Speculative';
}
