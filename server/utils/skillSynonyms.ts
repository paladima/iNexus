/**
 * Skill Synonym Engine (#8 v12)
 * Static dictionary of role/skill synonyms for query expansion.
 * Used by discovery pipeline to generate more diverse search queries.
 */

/** Role synonym groups — each group contains interchangeable terms */
const ROLE_SYNONYM_GROUPS: string[][] = [
  // Teaching / Training
  ["instructor", "trainer", "teacher", "educator", "tutor", "coach", "facilitator"],
  // Consulting / Advisory
  ["consultant", "advisor", "specialist", "expert", "strategist", "counselor"],
  // Management / Leadership
  ["manager", "director", "head", "lead", "supervisor", "coordinator", "chief"],
  // Engineering / Development
  ["engineer", "developer", "programmer", "architect", "builder"],
  // Design
  ["designer", "creative", "artist", "illustrator", "visual designer"],
  // Analysis / Research
  ["analyst", "researcher", "investigator", "data scientist", "statistician"],
  // Sales / Business Development
  ["sales representative", "account executive", "business developer", "sales manager", "account manager"],
  // Medical
  ["doctor", "physician", "practitioner", "clinician", "specialist", "surgeon"],
  ["nurse", "registered nurse", "nurse practitioner", "clinical nurse"],
  ["dentist", "dental surgeon", "orthodontist", "dental practitioner"],
  // Legal
  ["attorney", "lawyer", "counsel", "solicitor", "legal advisor", "barrister"],
  // Trades
  ["technician", "mechanic", "repairman", "service technician", "maintenance specialist"],
  ["contractor", "builder", "construction worker", "tradesman"],
  ["electrician", "electrical contractor", "electrical technician"],
  ["plumber", "plumbing contractor", "plumbing technician"],
  // Finance
  ["accountant", "bookkeeper", "CPA", "financial controller", "auditor"],
  ["financial advisor", "financial planner", "wealth manager", "investment advisor"],
  // Marketing
  ["marketer", "marketing specialist", "marketing manager", "growth marketer", "digital marketer"],
  // HR
  ["recruiter", "talent acquisition", "HR specialist", "headhunter", "staffing specialist"],
  // Real Estate
  ["realtor", "real estate agent", "property agent", "broker", "real estate broker"],
];

/** Skill synonym groups — interchangeable technical skills */
const SKILL_SYNONYM_GROUPS: string[][] = [
  ["welding", "metal fabrication", "arc welding", "MIG welding", "TIG welding"],
  ["carpentry", "woodworking", "cabinet making", "joinery"],
  ["roofing", "roof repair", "roof installation", "roofing contractor"],
  ["HVAC", "heating and cooling", "air conditioning", "climate control"],
  ["plumbing", "pipe fitting", "water systems"],
  ["electrical", "wiring", "electrical installation", "power systems"],
  ["painting", "house painting", "commercial painting", "decorating"],
  ["landscaping", "lawn care", "garden design", "grounds maintenance"],
  ["auto repair", "automotive", "car mechanic", "vehicle maintenance"],
  ["cooking", "culinary", "food preparation", "chef skills"],
  ["massage", "massage therapy", "bodywork", "therapeutic massage"],
  ["yoga", "yoga instruction", "yoga teaching", "mindfulness"],
  ["fitness", "personal training", "exercise", "physical training", "gym training"],
  ["photography", "photo editing", "videography", "visual media"],
  ["web development", "web design", "frontend", "backend", "full stack"],
  ["data analysis", "data science", "analytics", "business intelligence"],
  ["machine learning", "AI", "artificial intelligence", "deep learning"],
  ["project management", "program management", "agile", "scrum"],
  ["copywriting", "content writing", "technical writing", "blogging"],
  ["SEO", "search engine optimization", "digital marketing", "SEM"],
  ["tax preparation", "tax consulting", "tax planning", "tax advisory"],
  ["immigration", "immigration law", "visa consulting", "immigration advisory"],
  ["pediatrics", "child healthcare", "pediatric medicine", "children's health"],
];

/** Build a lookup map from any term to its synonym group */
function buildSynonymMap(groups: string[][]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const group of groups) {
    for (const term of group) {
      map.set(term.toLowerCase(), group.filter((t) => t.toLowerCase() !== term.toLowerCase()));
    }
  }
  return map;
}

const roleSynonymMap = buildSynonymMap(ROLE_SYNONYM_GROUPS);
const skillSynonymMap = buildSynonymMap(SKILL_SYNONYM_GROUPS);

/**
 * Get synonyms for a role term.
 * Returns up to `limit` synonyms, or empty array if no match found.
 */
export function getRoleSynonyms(role: string, limit = 4): string[] {
  const synonyms = roleSynonymMap.get(role.toLowerCase());
  if (!synonyms) return [];
  return synonyms.slice(0, limit);
}

/**
 * Get synonyms for a skill term.
 * Returns up to `limit` synonyms, or empty array if no match found.
 */
export function getSkillSynonyms(skill: string, limit = 4): string[] {
  const synonyms = skillSynonymMap.get(skill.toLowerCase());
  if (!synonyms) return [];
  return synonyms.slice(0, limit);
}

/**
 * Expand a query by replacing known roles/skills with their synonyms.
 * Returns the original query plus variants with substituted terms.
 */
export function expandQueryWithSynonyms(query: string, maxVariants = 5): string[] {
  const queryLower = query.toLowerCase();
  const variants: string[] = [];

  // Try role synonyms
  for (const [term, synonyms] of Array.from(roleSynonymMap.entries())) {
    if (queryLower.includes(term)) {
      for (const syn of synonyms.slice(0, maxVariants)) {
        const variant = query.replace(new RegExp(term, "gi"), syn);
        if (!variants.includes(variant)) {
          variants.push(variant);
        }
      }
    }
  }

  // Try skill synonyms
  for (const [term, synonyms] of Array.from(skillSynonymMap.entries())) {
    if (queryLower.includes(term)) {
      for (const syn of synonyms.slice(0, maxVariants)) {
        const variant = query.replace(new RegExp(escapeRegex(term), "gi"), syn);
        if (!variants.includes(variant)) {
          variants.push(variant);
        }
      }
    }
  }

  return variants.slice(0, maxVariants);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a term has known synonyms (either role or skill).
 */
export function hasSynonyms(term: string): boolean {
  const lower = term.toLowerCase();
  return roleSynonymMap.has(lower) || skillSynonymMap.has(lower);
}
