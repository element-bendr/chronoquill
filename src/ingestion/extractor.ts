import type { QuoteCandidate } from '../types/domain';

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const splitLines = (text: string): string[] =>
  text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => normalize(line))
    .filter(Boolean);

const splitSentences = (text: string): string[] =>
  normalize(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const noisePattern =
  /(home|weblog|quotes of the day|motivational|author index|subject index|random quotes|word of the day|book reviews|your page|contribute quotes|about this site|faq|contact us|quotations by author|showing quotations|more quotations on|return to author list|browse our complete list|all rights reserved|search for .*amazon|read the works of .* literature page|quotation search by keyword|previous author:|next author:|\(c\)\s*\d{4}|\[more author details\])/i;

const looksLikeNoise = (line: string): boolean => {
  if (line.length < 20) {
    return true;
  }
  if (noisePattern.test(line)) {
    return true;
  }
  if (/^[A-Z](\s+[A-Z]){3,}$/.test(line)) {
    return true;
  }
  if (/^\w+\s+\w+\s+\(\d{4}\s*-\s*\d{4}\)/.test(line)) {
    return true;
  }
  if (/^edgar allan poe\b/i.test(line) && line.length < 55) {
    return true;
  }
  if (/^edgar allan poe,/.test(line.toLowerCase())) {
    return true;
  }
  if (/^-/.test(line)) {
    return true;
  }

  return false;
};

export class QuoteExtractor {
  extract(raw: string, author: string, themes: string[]): QuoteCandidate[] {
    const lines = splitLines(raw)
      .filter((line) => line.length >= 30 && line.length <= 320)
      .filter((line) => !looksLikeNoise(line));

    const candidates = (lines.length > 0 ? lines : splitSentences(raw)).filter(
      (s) => s.length >= 30 && s.length <= 320 && !looksLikeNoise(s)
    );

    return candidates
      .map((s) => ({
        text: s,
        author,
        themes
      }));
  }
}
