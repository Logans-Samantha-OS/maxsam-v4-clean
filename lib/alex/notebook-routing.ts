/**
 * ALEX Notebook Routing
 *
 * Maps Texas counties to their respective NotebookLM notebooks.
 * This allows ALEX to query the correct regional notebook based on county.
 *
 * As we expand to more counties, we'll create regional notebooks:
 * - TX_Dallas_County_Playbook (DFW Metro)
 * - TX_Houston_Metro (future)
 * - TX_Austin_SanAntonio (future)
 * - TX_Other_Counties (fallback)
 */

// County to Notebook mapping
// Currently all counties route to Dallas playbook until regional notebooks are created
export const COUNTY_TO_NOTEBOOK: Record<string, string> = {
  // ============================================
  // DFW METRO - Primary Focus
  // Uses: TX_Dallas_County_Playbook
  // ============================================
  'Dallas': 'TX_Dallas_County_Playbook',
  'Tarrant': 'TX_Dallas_County_Playbook',
  'Collin': 'TX_Dallas_County_Playbook',
  'Denton': 'TX_Dallas_County_Playbook',
  'Rockwall': 'TX_Dallas_County_Playbook',
  'Ellis': 'TX_Dallas_County_Playbook',
  'Johnson': 'TX_Dallas_County_Playbook',
  'Kaufman': 'TX_Dallas_County_Playbook',
  'Parker': 'TX_Dallas_County_Playbook',
  'Wise': 'TX_Dallas_County_Playbook',

  // ============================================
  // HOUSTON METRO
  // Future: TX_Houston_Metro
  // Currently defaults to Dallas playbook
  // ============================================
  'Harris': 'TX_Dallas_County_Playbook',
  'Fort Bend': 'TX_Dallas_County_Playbook',
  'Montgomery': 'TX_Dallas_County_Playbook',
  'Brazoria': 'TX_Dallas_County_Playbook',
  'Galveston': 'TX_Dallas_County_Playbook',

  // ============================================
  // AUSTIN / SAN ANTONIO
  // Future: TX_Austin_SanAntonio
  // Currently defaults to Dallas playbook
  // ============================================
  'Travis': 'TX_Dallas_County_Playbook',
  'Williamson': 'TX_Dallas_County_Playbook',
  'Hays': 'TX_Dallas_County_Playbook',
  'Bexar': 'TX_Dallas_County_Playbook',
  'Comal': 'TX_Dallas_County_Playbook',

  // ============================================
  // OTHER MAJOR TEXAS COUNTIES
  // ============================================
  'El Paso': 'TX_Dallas_County_Playbook',
  'Hidalgo': 'TX_Dallas_County_Playbook',
  'Cameron': 'TX_Dallas_County_Playbook',
  'Nueces': 'TX_Dallas_County_Playbook',
  'Lubbock': 'TX_Dallas_County_Playbook',
  'McLennan': 'TX_Dallas_County_Playbook',
  'Bell': 'TX_Dallas_County_Playbook',
};

// Default notebook for unknown counties
export const DEFAULT_NOTEBOOK = 'TX_Dallas_County_Playbook';

// Regional notebook definitions (for future use)
export const REGIONAL_NOTEBOOKS = {
  DFW_METRO: 'TX_Dallas_County_Playbook',
  HOUSTON_METRO: 'TX_Houston_Metro', // Future
  AUSTIN_SANANTONIO: 'TX_Austin_SanAntonio', // Future
  OTHER: 'TX_Other_Counties', // Future fallback
};

/**
 * Get the NotebookLM notebook name for a given county
 *
 * @param county - County name (e.g., "Dallas", "Tarrant", "Harris")
 * @returns The notebook name to query
 */
export function getNotebookForCounty(county: string): string {
  // Normalize county name: trim, title case
  const normalized = county.trim();

  // Try exact match first
  if (COUNTY_TO_NOTEBOOK[normalized]) {
    return COUNTY_TO_NOTEBOOK[normalized];
  }

  // Try case-insensitive match
  const lowerCounty = normalized.toLowerCase();
  for (const [key, value] of Object.entries(COUNTY_TO_NOTEBOOK)) {
    if (key.toLowerCase() === lowerCounty) {
      return value;
    }
  }

  // Return default notebook
  return DEFAULT_NOTEBOOK;
}

/**
 * Get all counties that route to a specific notebook
 *
 * @param notebook - Notebook name
 * @returns Array of county names
 */
export function getCountiesForNotebook(notebook: string): string[] {
  return Object.entries(COUNTY_TO_NOTEBOOK)
    .filter(([, value]) => value === notebook)
    .map(([key]) => key);
}

/**
 * Get routing info for a county
 *
 * @param county - County name
 * @returns Object with notebook and region info
 */
export function getCountyRoutingInfo(county: string): {
  county: string;
  notebook: string;
  region: string;
  isDefault: boolean;
} {
  const notebook = getNotebookForCounty(county);
  const isDefault = !COUNTY_TO_NOTEBOOK[county];

  // Determine region based on notebook
  let region = 'Unknown';
  if (notebook === REGIONAL_NOTEBOOKS.DFW_METRO) {
    region = 'DFW Metro';
  } else if (notebook === REGIONAL_NOTEBOOKS.HOUSTON_METRO) {
    region = 'Houston Metro';
  } else if (notebook === REGIONAL_NOTEBOOKS.AUSTIN_SANANTONIO) {
    region = 'Austin / San Antonio';
  }

  return {
    county,
    notebook,
    region,
    isDefault,
  };
}

/**
 * Format a question with county context
 *
 * @param county - County name
 * @param question - Original question
 * @returns Formatted question with county context
 */
export function formatCountyQuestion(county: string, question: string): string {
  // Check if question already mentions the county
  const lowerQuestion = question.toLowerCase();
  const lowerCounty = county.toLowerCase();

  if (lowerQuestion.includes(lowerCounty)) {
    return question;
  }

  // Prepend county context
  return `For ${county} County Texas, ${question}`;
}

/**
 * List all supported counties
 */
export function listSupportedCounties(): string[] {
  return Object.keys(COUNTY_TO_NOTEBOOK).sort();
}

/**
 * Check if a county is explicitly supported
 */
export function isCountySupported(county: string): boolean {
  const normalized = county.trim().toLowerCase();
  return Object.keys(COUNTY_TO_NOTEBOOK).some(
    (key) => key.toLowerCase() === normalized
  );
}
