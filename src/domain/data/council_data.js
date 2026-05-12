/**
 * Council and LGA Database
 * Faithfully migrated from legacy monolith.
 */

export const COUNCIL_DB = {
  Yarra: { openSpace: 0.05 },
  Darebin: { openSpace: 0.05 },
  Moreland: { openSpace: 0.04 },
  Boroondara: { openSpace: 0.05 },
  Stonnington: { openSpace: 0.05 },
  Manningham: { openSpace: 0.05 },
  Monash: { openSpace: 0.05 },
  Whitehorse: { openSpace: 0.05 },
  "Port Phillip": { openSpace: 0.05 },
  Maribyrnong: { openSpace: 0.05 },
  Brimbank: { openSpace: 0.04 },
  "Hobsons Bay": { openSpace: 0.05 },
  Banyule: { openSpace: 0.05 },
  Bayside: { openSpace: 0.05 },
  Frankston: { openSpace: 0.04 },
  Casey: { openSpace: 0.05 },
  Wyndham: { openSpace: 0.05 },
  Hume: { openSpace: 0.05 },
};

export const LGA_OSC = {
  Boroondara: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value (Planning Scheme cl. 53.01)",
  },
  Manningham: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Whitehorse: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Darebin: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Moreland: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value (now Merri-bek)",
  },
  Yarra: { rate: 0.05, basis: "land value", note: "5% of site value" },
  "Port Phillip": {
    rate: 0.04,
    basis: "land value",
    note: "4%  lower rate reflects existing open space",
  },
  Stonnington: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Bayside: { rate: 0.05, basis: "land value", note: "5% of site value" },
  "Glen Eira": {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Kingston: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Monash: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Knox: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Maroondah: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Banyule: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Nillumbik: {
    rate: 0.02,
    basis: "land value",
    note: "2%  rural fringe, lower rate",
  },
  "Mornington Peninsula": {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
  Casey: {
    rate: 0.05,
    basis: "land value",
    note: "5%  growth corridor, actively applied",
  },
  Cardinia: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Wyndham: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Melton: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Hume: { rate: 0.05, basis: "land value", note: "5% of site value" },
  Whittlesea: {
    rate: 0.05,
    basis: "land value",
    note: "5% of site value",
  },
};

export const LGA_ALERTS = {
  Manningham: [
    {
      level: "warn",
      icon: "",
      reserve: 10000,
      msg: "Manningham: Extreme tree protection under SLO/VPO overlays. Expect $815K Arborist Report + potential tree bonds. Budget $10K contingency before ANY demolition permit.",
    },
    {
      level: "warn",
      icon: "",
      reserve: 0,
      msg: "Manningham: DDO8/10/11 may apply. Verify DDO schedule for your street  setback articulation and roof pitch requirements are strictly enforced.",
    },
  ],
  Boroondara: [
    {
      level: "danger",
      icon: "",
      reserve: 15000,
      msg: "Boroondara: 30%+ of stock covered by Heritage Overlay (Camberwell, Kew, Hawthorn). A pre-application Heritage Assessment ($515K) is mandatory before demolition  'No' decisions are common. Verify HO status before bidding.",
    },
  ],
  Stonnington: [
    {
      level: "danger",
      icon: "",
      reserve: 15000,
      msg: "Stonnington: Blanket Heritage Overlay in Prahran, South Yarra, Toorak. Pre-1960 dwellings face demolition refusal. Engage a heritage architect ($515K) before lodging any permit application.",
    },
  ],
  Monash: [
    {
      level: "warn",
      icon: "",
      reserve: 5000,
      msg: "Monash: NRZ Schedule 3 strictly limits to 2 dwellings with max 35% site coverage. Side-by-side townhouse layouts in isolated NRZ pockets routinely objected to by council and neighbours.",
    },
  ],
  Yarra: [
    {
      level: "warn",
      icon: "",
      reserve: 5000,
      msg: "Yarra: Neighbourhood Character Controls in Fitzroy, Richmond, Collingwood  design architect and character response required. Street-fronting basement garages strongly discouraged. Budget $3.5K for town planner.",
    },
  ],
  Nillumbik: [
    {
      level: "danger",
      icon: "",
      reserve: 20000,
      msg: "Nillumbik: High BAL (Bushfire Attack Level) risk across most of the shire. BALL assessment mandatory  FZ designation will prevent residential development. Add $1525K for fire-rated construction if BAL-29 or above.",
    },
  ],
  "Mornington Peninsula": [
    {
      level: "warn",
      icon: "",
      reserve: 8000,
      msg: "Mornington Peninsula: Coastal/Flood Overlay common near foreshore. Check BSSO (Bushfire) and EMO (Environmental) overlays. Septic and water authority approvals add 24 months.",
    },
  ],
  Wyndham: [
    {
      level: "warn",
      icon: "",
      reserve: 5000,
      msg: "Wyndham: Growth corridor  developer infrastructure levies (GAIC ~$131,000/ha) apply in PSP areas. Verify if site is within a PSP before modelling land value.",
    },
  ],
  Casey: [
    {
      level: "warn",
      icon: "",
       employee: 5000,
      msg: "Casey: Growth Area Infrastructure Contribution (GAIC) applies in PSP precincts. Add ~$131K/ha. Verify PSP status and developer contribution plan overlay.",
    },
  ],
  Melton: [
    {
      level: "warn",
      icon: "",
      reserve: 5000,
      msg: "Melton: Active PSP growth corridor  GAIC and Development Contribution Plans (DCPs) apply. Infrastructure timing varies by precinct  verify serviced land before proceeding.",
    },
  ],
};

export const COUNCIL_RULES = {
  Manningham: {
    globalPS: {
      landscaping: 5000,
      note: "Manningham's Significant Landscape Overlay (SLO) and tree protection policy require a Landscaping Plan for all multi-dwelling developments  $4,000$7,000",
    },
    zoneOverrides: {
      NRZ: {
        overlayHint:
          "DDO8 (Residential Framework) likely applies  check Manningham Planning Scheme cl. 43.02 for street setback and articulation requirements. NRZ setback from street typically 7.5m.",
      },
      GRZ: {
        overlayHint:
          "DDO10 or DDO11 may apply in parts of Manningham  verify subdivision setbacks. Neighbourhood character response required for balcony depth, materials, and roof pitch.",
      },
    },
  },
  Boroondara: {
    globalPS: {},
    zoneOverrides: {
      NRZ: {
        softPS: 4000,
        overlayHint:
          " Heritage Overlay covers 30%+ of Boroondara stock (Camberwell, Kew, Hawthorn). Inspect for contributory or significant heritage status before purchase  demolition may be refused.",
      },
      GRZ: {
        softPS: 2500,
        overlayHint:
          "Neighbourhood Character Overlay (NCO) common  design response report required ($2,500$5,000). Boroondara strongly enforces front setback, garden area, and garage set-back from dwelling.",
      },
    },
  },
  Whitehorse: {
    globalPS: {},
    zoneOverrides: {
      GRZ: {
        overlayHint:
          "Design & Development Overlay (DDO) applies in parts of Whitehorse  verify DDO schedule for your street. Box Hill DDO8 mandates different height and setback rules.",
      },
      RGZ: {
        overlayHint:
          "Box Hill Activity Centre  DDO8 or Structure Plan controls. Higher density likely supported but design quality and ground-floor activation are expected.",
      },
    },
  },
  Stonnington: {
    globalPS: {},
    zoneOverrides: {
      NRZ: {
        softPS: 5000,
        overlayHint:
          "Heritage Overlay blanket in Prahran, South Yarra, Toorak  heritage assessment mandatory ($5,000$15,000). Demolition of pre-1960 dwellings often refused. Engage heritage architect early.",
      },
      GRZ: {
        softPS: 2000,
        overlayHint:
          "Neighbourhood character in Chapel Hill & Malvern  design architect required. Stonnington enforces articulation and brick/weatherboard materials, and deep setbacks.",
      },
    },
  },
  Yarra: {
    globalPS: {},
    zoneOverrides: {
      GRZ: {
        softPS: 3500,
        overlayHint:
          "Yarra's Neighbourhood Character Controls (Fitzroy, Richmond, Collingwood)  design architect and character response required. Street-fronting basement garages strongly discouraged. Allow $3,500 for town planner.",
      },
      NRZ: {
        softPS: 3000,
        overlayHint:
          "Heritage Overlay extensive in inner-Yarra. NRZ limits density severely  pre-app meeting with council planner strongly recommended before purchase.",
      },
    },
  },
};
