export function importanceCoverage(
  terms: Set<string>,
  query: Set<string>,
  labels: Record<string, string>,
  idf: Record<string, number>,
  referenceCount: number,
  budget: number,
  weights: { core: number; auxiliary: number; neutral: number }
): {
  contributions: Record<string, number>;
  details: {
    groups: Record<
      string,
      {
        technologies: string[];
        matched_technologies: string[];
        coverage: number;
        evidence_adjusted_coverage: number;
        effective_weight: number;
      }
    >;
    evidence_sufficiency: number;
    reference_technology_count: number;
    neutral_policy: string;
  };
} {
  const groups: Record<'core' | 'auxiliary' | 'neutral', Set<string>> = {
    core: new Set(),
    auxiliary: new Set(),
    neutral: new Set(),
  };
  for (const token of terms) {
    const raw = labels[token];
    const kind = raw === '핵심' ? 'core' : raw === '보조' ? 'auxiliary' : 'neutral';
    groups[kind].add(token);
  }
  const present: Record<string, number> = {};
  for (const [k, tokens] of Object.entries(groups)) {
    if (tokens.size > 0) {
      present[k] = weights[k as keyof typeof weights];
    }
  }
  const total = Object.values(present).reduce((a, b) => a + b, 0);
  const effective: Record<string, number> = {};
  for (const k of Object.keys(groups)) {
    effective[k] = total ? (budget * (present[k] || 0)) / total : 0.0;
  }

  let matchedCount = 0;
  for (const t of terms) {
    if (query.has(t)) matchedCount++;
  }
  const sufficiency = referenceCount ? Math.min(1.0, matchedCount / referenceCount) : 0.0;

  const scores: Record<string, number> = {};
  const details: Record<
    string,
    {
      technologies: string[];
      matched_technologies: string[];
      coverage: number;
      evidence_adjusted_coverage: number;
      effective_weight: number;
    }
  > = {};
  const contributions: Record<string, number> = {};

  for (const [kind, tokens] of Object.entries(groups)) {
    let mass = 0;
    let matchedMass = 0;
    const matchedTokens: string[] = [];
    for (const t of tokens) {
      const w = idf[t] || 0;
      mass += w;
      if (query.has(t)) {
        matchedTokens.push(t);
        matchedMass += w;
      }
    }
    const ratio = mass ? matchedMass / mass : 0.0;
    scores[kind] = ratio * sufficiency;
    details[kind] = {
      technologies: Array.from(tokens).sort(),
      matched_technologies: matchedTokens.sort(),
      coverage: ratio,
      evidence_adjusted_coverage: scores[kind],
      effective_weight: effective[kind],
    };
    contributions[kind] = 100 * effective[kind] * scores[kind];
  }

  return {
    contributions,
    details: {
      groups: details,
      evidence_sufficiency: sufficiency,
      reference_technology_count: referenceCount,
      neutral_policy: 'unreviewed_or_undetermined_not_auxiliary',
    },
  };
}
