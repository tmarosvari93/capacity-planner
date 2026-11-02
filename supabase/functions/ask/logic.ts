// Pure request building and response parsing for the `ask` edge function.
// No Deno or network code here, so Vitest can test it.
import { CANNOT_ANSWER_TOOL, FUNCTION_CATALOGUE } from './catalogue.ts';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const MAX_QUESTION = 500;

export function buildChooseRequest(question: string, context: unknown, model = DEFAULT_MODEL) {
  return {
    model,
    max_tokens: 600,
    system: [
      'You route questions about a software agency\'s capacity plan to exactly one calculation function.',
      'Answer every question by calling exactly one function. If no function fits the question or the data cannot answer it, call cannot_answer with a short reason.',
      'Never answer in text and never calculate anything yourself.',
      'Use the context to turn project names into projectIds, stacks into the stack list, and dates into Monday weeks.',
      '"In 4 weeks" means the week of 2026-11-30. "Next weeks" with no number means 2026-11-02 to 2026-11-30.',
      '"Last weeks", "recently" or "so far" about logged time means 2026-09-28 to 2026-10-26.',
      'If two or more pipeline projects "start at the same time", call scenarioImpact with them on and alignStarts true.',
      'Use cannot_answer for salaries, pay, performance, reasons for absence, health, or anything not in planning data.',
      `Context: ${JSON.stringify(context)}`,
    ].join('\n'),
    tools: [...FUNCTION_CATALOGUE, CANNOT_ANSWER_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: question.slice(0, MAX_QUESTION) }],
  };
}

export function parseChooseResponse(res: any): { function: string; args: Record<string, unknown> } | { outOfScope: true; reason: string } {
  // A text-only reply (no tool call) is treated as cannot_answer; its text is never shown.
  const block = (res?.content ?? []).find((b: any) => b?.type === 'tool_use');
  if (!block || block.name === CANNOT_ANSWER_TOOL.name) {
    return { outOfScope: true, reason: block?.input?.reason ?? 'No function chosen' };
  }
  return { function: block.name, args: block.input ?? {} };
}

export function buildConcludeRequest(question: string, payload: unknown, model = DEFAULT_MODEL) {
  return {
    model,
    max_tokens: 300,
    system: [
      'You write the conclusion for an answer in a capacity planning tool.',
      'Write 2 or 3 plain sentences in English that answer the question from the result.',
      'Use only numbers that appear in the payload. Do not calculate, add up, convert or estimate any number.',
      'Name people and projects as they appear. No advice, no greeting, no markdown.',
    ].join('\n'),
    messages: [{ role: 'user', content: `Question: ${question.slice(0, MAX_QUESTION)}\n\nPayload:\n${JSON.stringify(payload)}` }],
  };
}

export function parseConcludeResponse(res: any): { text: string } {
  const text = (res?.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join(' ').trim();
  return { text };
}
