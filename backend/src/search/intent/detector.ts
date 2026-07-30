import { loadIntentConfig } from './keywords.js';

export function detectIntents(query: string): Set<string> {
  const intents = new Set<string>();
  if (!query || query.trim() === '') {
    return intents;
  }

  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = normalizedQuery.split(/\s+/);
  const config = loadIntentConfig();

  // Hardcoded heuristic for purely numeric queries (often cédulas / IDs)
  if (/^\d+$/.test(query.trim())) {
    intents.add('person');
  }

  for (const [intentName, intentData] of Object.entries(config.intents || {})) {
    for (const keyword of intentData.keywords) {
      // Check if keyword is found as a substring or exact match in the tokens
      if (normalizedQuery.includes(keyword.toLowerCase())) {
        intents.add(intentName);
        break;
      }
    }
  }

  return intents;
}
