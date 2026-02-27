export interface LLMCurationInput {
  quoteId: string;
  text: string;
  author: string;
  themes: string[];
}

export interface LLMCurationAdvisory {
  themes?: string[];
  tone?: string;
  notes?: string;
}

export interface LLMCuratorAgent {
  advise(input: LLMCurationInput): Promise<LLMCurationAdvisory>;
}

export class NoopLLMCuratorAgent implements LLMCuratorAgent {
  async advise(_input: LLMCurationInput): Promise<LLMCurationAdvisory> {
    return {};
  }
}

const keywordThemes: Array<{ re: RegExp; theme: string }> = [
  { re: /\bdiscipline|consistent|consistency|habit\b/i, theme: 'discipline' },
  { re: /\bcraft|build|ship|work\b/i, theme: 'craft' },
  { re: /\bstoic|stoicism|virtue|character\b/i, theme: 'stoicism' },
  { re: /\bfocus|attention|priority\b/i, theme: 'focus' }
];

export class HeuristicLLMCuratorAgent implements LLMCuratorAgent {
  async advise(input: LLMCurationInput): Promise<LLMCurationAdvisory> {
    const themes = new Set(input.themes);
    for (const rule of keywordThemes) {
      if (rule.re.test(input.text)) {
        themes.add(rule.theme);
      }
    }

    const tone = /\bnever|must|always\b/i.test(input.text) ? 'directive' : 'neutral';

    return {
      themes: [...themes].slice(0, 8),
      tone,
      notes: 'offline_heuristic_advisory'
    };
  }
}
