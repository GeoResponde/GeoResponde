import type { Observation, ObservationEdge } from '@georesponde/shared';
import { ResolutionStrategy } from './ResolutionStrategy.js';

/**
 * HeuristicMatchStrategy computes a probabilistic confidence score (0.0 to 1.0)
 * between pairs of person observations that lack an exact identity match.
 * 
 * It accumulates evidence from fuzzy name matching, contextual agreement 
 * (demographics, location), and weak identity evidence (masked cedulas).
 * It enforces hard vetoes for contradicting explicit identities and demographics.
 */
export class HeuristicMatchStrategy implements ResolutionStrategy {
  execute(observations: Observation[]): ObservationEdge[] {
    const edges: ObservationEdge[] = [];
    
    // Only compare 'person' entities
    const people = observations.filter(o => o.entityType === 'person');

    for (let i = 0; i < people.length; i++) {
      const a = people[i];
      for (let j = i + 1; j < people.length; j++) {
        const b = people[j];
        
        const result = this.evaluatePair(a, b);
        if (result.confidence >= 0.5) {
          edges.push({
            sourceId: a.id,
            targetId: b.id,
            confidence: result.confidence,
            reasons: result.reasons
          });
        }
      }
    }
    
    return edges;
  }

  private evaluatePair(a: Observation, b: Observation): { confidence: number, reasons: string[] } {
    const personA = a.normalizedFields.person;
    const personB = b.normalizedFields.person;
    if (!personA || !personB) return { confidence: 0, reasons: [] };

    const reasons: string[] = [];

    // VETO 1: Incompatible Demographics
    if (personA.gender && personB.gender && personA.gender !== 'unknown' && personB.gender !== 'unknown' && personA.gender !== personB.gender) {
      return { confidence: 0, reasons: ['Conflicting gender'] };
    }
    if (personA.age != null && personB.age != null && Math.abs(personA.age - personB.age) > 5) {
      return { confidence: 0, reasons: ['Conflicting age'] };
    }

    // VETO 2: Incompatible Identifiers
    const cedulaA = personA.cedula;
    const cedulaB = personB.cedula;
    
    let hasIdBoost = false;

    if (cedulaA && cedulaB) {
      const isMaskedA = /[*•]/.test(cedulaA);
      const isMaskedB = /[*•]/.test(cedulaB);
      
      if (!isMaskedA && !isMaskedB) {
        // Both fully visible. If they are different, veto. 
        if (cedulaA !== cedulaB) {
          return { confidence: 0, reasons: ['Conflicting explicit identifiers'] };
        }
      } else if (isMaskedA && !isMaskedB) {
        if (!this.matchesMasked(cedulaB, cedulaA)) return { confidence: 0, reasons: ['Incompatible masked identifier'] };
        hasIdBoost = true;
        reasons.push('Compatible masked identifier');
      } else if (!isMaskedA && isMaskedB) {
        if (!this.matchesMasked(cedulaA, cedulaB)) return { confidence: 0, reasons: ['Incompatible masked identifier'] };
        hasIdBoost = true;
        reasons.push('Compatible masked identifier');
      } else {
        // Both masked. Do they match what we can see?
        if (!this.matchesTwoMasked(cedulaA, cedulaB)) return { confidence: 0, reasons: ['Incompatible masked identifiers'] };
        hasIdBoost = true;
        reasons.push('Compatible masked identifiers');
      }
    }

    // BASE EVIDENCE: Name Similarity
    const nameA = personA.fullName || [personA.firstName, personA.lastName].filter(Boolean).join(' ');
    const nameB = personB.fullName || [personB.firstName, personB.lastName].filter(Boolean).join(' ');
    
    if (!nameA || !nameB) return { confidence: 0, reasons: [] };
    
    const nameSim = this.computeNameSimilarity(nameA, nameB);
    if (nameSim < 0.4) {
      return { confidence: 0, reasons: [] };
    }

    let confidence = 0;
    
    // Exact name match alone is capped at 0.8 (Requires context to cross 0.9 threshold)
    confidence += nameSim * 0.8;
    reasons.push(`Name similarity: ${(nameSim * 100).toFixed(0)}%`);

    // CONTEXTUAL BOOSTS
    if (personA.age != null && personB.age != null && Math.abs(personA.age - personB.age) <= 3) {
      confidence += 0.05;
      reasons.push('Compatible age');
    }
    if (personA.gender && personA.gender === personB.gender && personA.gender !== 'unknown') {
      confidence += 0.05;
      reasons.push('Matching gender');
    }

    // Location (Penalty or Boost, but not a hard veto)
    const locA = personA.lastSeenLocation || personA.hospital;
    const locB = personB.lastSeenLocation || personB.hospital;
    if (locA && locB) {
      const locSim = this.computeNameSimilarity(locA, locB);
      if (locSim > 0.5) {
        confidence += 0.1;
        reasons.push('Compatible location');
      } else if (locSim < 0.4) {
        confidence -= 0.1; // Penalty for diverging locations
        reasons.push('Differing locations');
      }
    }

    // WEAK IDENTITY EVIDENCE BOOST
    if (hasIdBoost) {
      confidence += 0.15;
    }

    // Cap at 0.95 maximum confidence
    confidence = Math.max(0.0, Math.min(0.95, confidence));
    
    return { confidence, reasons };
  }

  private matchesMasked(full: string, masked: string): boolean {
    const regexStr = masked.replace(/[*•]+/g, '\\d+');
    try {
      const regex = new RegExp(`^${regexStr}$`);
      return regex.test(full);
    } catch {
      return false;
    }
  }

  private matchesTwoMasked(maskedA: string, maskedB: string): boolean {
    // Basic approximation: If they are the same length, check visible chars.
    if (maskedA.length !== maskedB.length) return false;
    for (let i = 0; i < maskedA.length; i++) {
      const ca = maskedA[i];
      const cb = maskedB[i];
      if (ca !== '*' && ca !== '•' && cb !== '*' && cb !== '•') {
        if (ca !== cb) return false;
      }
    }
    return true;
  }

  private computeNameSimilarity(nameA: string, nameB: string): number {
    const tokensA = nameA.toLowerCase().trim().split(/[\s,.-]+/);
    const tokensB = nameB.toLowerCase().trim().split(/[\s,.-]+/);
    
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    
    let matchCount = 0;
    for (const tA of tokensA) {
      let bestSim = 0;
      for (const tB of tokensB) {
        const sim = this.stringSimilarity(tA, tB);
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim > 0.8) {
        matchCount += 1.0;
      } else if (bestSim > 0.6) {
        matchCount += bestSim; // Partial credit for weak matches
      }
    }

    // We divide by maxTokens to penalize missing words (like "Alvarez")
    const maxTokens = Math.max(tokensA.length, tokensB.length);
    return matchCount / maxTokens;
  }

  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    const dist = this.levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    return 1 - dist / maxLen;
  }

  private levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  }
}
