import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface IntentConfig {
  intents: Record<string, { keywords: string[] }>;
}

let cachedConfig: IntentConfig | null = null;

export function loadIntentConfig(): IntentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  
  try {
    const configPath = path.resolve(__dirname, '../config/search-intents.yaml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      cachedConfig = yaml.load(content) as IntentConfig;
      return cachedConfig;
    }
  } catch (error) {
    console.error('[Intent Config] Failed to load search-intents.yaml', error);
  }
  
  // Fallback if config is missing
  return { intents: {} };
}
