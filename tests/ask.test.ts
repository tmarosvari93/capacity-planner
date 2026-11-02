import { describe, expect, it } from 'vitest';
import * as core from '../src/core/askCatalogue';
import {
  FUNCTION_NAMES, OUT_OF_SCOPE, checkNumbers, concludePayload, dataRead, runAsk, runFunction, templateConclusion, toTable,
  validateArgs, type FunctionName,
} from '../src/core/ask';
import * as edge from '../supabase/functions/ask/catalogue';
import {
  buildChooseRequest, buildConcludeRequest, parseChooseResponse, parseConcludeResponse,
} from '../supabase/functions/ask/logic';
import { KEY, expectMatches, model } from './helpers';

const inScope = KEY.askTests.filter((t: any) => t.function);

describe('catalogue', () => {
  it('the edge function copy equals the core catalogue', () => {
    expect(edge.FUNCTION_CATALOGUE).toEqual(core.FUNCTION_CATALOGUE);
    expect(edge.CANNOT_ANSWER_TOOL).toEqual(core.CANNOT_ANSWER_TOOL);
  });
  it('covers every function the answer key expects', () => {
    for (const t of inScope) expect(FUNCTION_NAMES).toContain(t.function);
  });
});

describe('the 13 in-scope Ask tests: expected arguments validate and run', () => {
  for (const t of inScope) {
    it(t.q, async () => {
      const m = await model();
      const v = validateArgs(m, t.function, t.args);
      expect(v, JSON.stringify(v)).toMatchObject({ ok: true });
      if (!v.ok) return;
      const r = runFunction(m, t.function, v.args);
      expect(r).toBeTruthy();
      const table = toTable(m, t.function, r);
      table.rows.forEach((row) => expect(row).toHaveLength(table.columns.length));
      expect(dataRead(m, t.function, v.args).files.length).toBeGreaterThan(0);
    });
  }
  it('runFunction gives the answer key result for the five brief questions', async () => {
    const m = await model();
    expectMatches(runFunction(m, 'freeCapacity', { week: '2026-11-30' }), KEY.questions.q1_whoIsAvailableIn4Weeks.baseline.result);
    expectMatches(runFunction(m, 'scenarioImpact', { scenario: KEY.meta.scenarios.pairAligned }),
      KEY.questions.q2_twoPipelineProjectsAtOnce.pairAligned.result);
    expectMatches(runFunction(m, 'skillGap', { fromWeek: '2026-11-02', toWeek: '2027-01-18' }), KEY.questions.q3_skillShortage.baseline.result);
    expectMatches(runFunction(m, 'loadByPerson', { fromWeek: '2026-11-02', toWeek: '2026-11-30' }), KEY.questions.q4_overAndIdle.baseline.result);
    expectMatches(runFunction(m, 'billableSplit', { fromWeek: '2026-09-28', toWeek: '2026-10-26', groupBy: 'company' }),
      KEY.questions.q5_billableShare.company.result);
  });
  it('uses the open scenario when the question gives none', async () => {
    const m = await model();
    const sc = KEY.meta.scenarios.pairAligned;
    expectMatches(runFunction(m, 'freeCapacity', { week: '2026-11-30' }, sc), KEY.questions.q1_whoIsAvailableIn4Weeks.pairAligned.result);
  });
});

describe('validateArgs rejects bad arguments instead of guessing', () => {
  it.each([
    ['freeCapacity', { week: '2026-10-05' }, 'outside the data'],
    ['skillGap', { fromWeek: '2026-12-28', toWeek: '2026-11-02' }, 'after'],
    ['skillGap', { fromWeek: '2026-11-02', toWeek: '2026-11-30', stack: 'Rust' }, 'Unknown stack'],
    ['projectBurn', { projectId: 'PRJ-XYZ' }, 'Unknown project'],
    ['scenarioImpact', { scenario: { projects: { 'PRJ-NOVA': { on: true } } } }, 'not a pipeline'],
    ['billableSplit', { fromWeek: '2026-09-28', toWeek: '2026-10-26' }, 'Missing groupBy'],
    ['salaryReport', {}, 'Unknown function'],
    ['loadByPerson', { fromWeek: '2026-11-02', toWeek: '2026-11-30', foo: 1 }, 'Unexpected'],
  ])('%s %j', async (name, args, msg) => {
    const v = validateArgs(await model(), name, args);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join(' ')).toContain(msg);
  });
  it('a mid-week date is moved to its Monday', async () => {
    const v = validateArgs(await model(), 'freeCapacity', { week: '2026-12-03' });
    expect(v.ok && v.args.week).toBe('2026-11-30');
  });
});

describe('numbers guard', () => {
  it('accepts numbers from the result, rounded, and dates', async () => {
    const m = await model();
    const r = runFunction(m, 'billableSplit', { fromWeek: '2026-09-28', toWeek: '2026-10-26', groupBy: 'company' });
    const p = concludePayload(m, 'billableSplit', {}, r);
    expect(checkNumbers('Billable work was 68.8% of 1,717.5 logged hours, against the 80% target, between 28 Sep and 26 Oct.', p).ok).toBe(true);
    expect(checkNumbers('About 1718 hours were logged.', p).ok).toBe(true);
  });
  it('rejects an invented or computed number', async () => {
    const m = await model();
    const r = runFunction(m, 'billableSplit', { fromWeek: '2026-09-28', toWeek: '2026-10-26', groupBy: 'company' });
    const p = concludePayload(m, 'billableSplit', {}, r);
    const c = checkNumbers('We are 11.2 points below target.', p); // 80 − 68.8: a calculation, not in the result
    expect(c.ok).toBe(false);
    expect(c.unknown).toEqual([11.2]);
  });
  it('every template sentence passes the guard', async () => {
    const m = await model();
    for (const t of inScope) {
      const v = validateArgs(m, t.function, t.args);
      if (!v.ok) throw new Error('invalid');
      const r = runFunction(m, t.function, v.args);
      const text = templateConclusion(m, t.function as FunctionName, r);
      expect(checkNumbers(text, concludePayload(m, t.function, v.args, r), t.q), text).toMatchObject({ ok: true });
    }
  });
});

describe('runAsk with a fake edge function', () => {
  const fake = (choose: any, conclude: any) => async (body: any) => (body.mode === 'choose' ? choose : conclude);
  it('answer: function, table, data read, scenario, Claude\'s text kept when its numbers check out', async () => {
    const m = await model();
    const a = await runAsk(m, 'Which skill will we run short of?', undefined,
      fake({ function: 'skillGap', args: { fromWeek: '2026-11-02', toWeek: '2027-01-18' } },
        { text: 'Java runs short first, from 30 Nov, up to 0.3 FTE. QA is also short in the week of 28 Dec.' }), () => 'T');
    expect(a).toMatchObject({ status: 'answer', function: 'skillGap', usedTemplate: false, scenario: 'Baseline', askedAt: 'T' });
    expect(a.table!.rows.map((r) => r[0])).toEqual(['Backend · Java', 'QA']);
    expect(a.dataRead!.summary).toContain('Jira sprint SPR-31, 34 issues');
  });
  it('a conclusion with an invented number is replaced by the template', async () => {
    const m = await model();
    const a = await runAsk(m, 'Which skill will we run short of?', undefined,
      // Known limit: a small whole number that happens to appear elsewhere in the result (e.g. "3") would pass.
      fake({ function: 'skillGap', args: { fromWeek: '2026-11-02', toWeek: '2027-01-18' } }, { text: 'We need 1.6 FTE more Java.' }));
    expect(a.usedTemplate).toBe(true);
    expect(a.conclusion).toContain('Backend · Java is the first to run short');
  });
  it('out of scope', async () => {
    const a = await runAsk(await model(), 'What are our developers\' salaries?', undefined, fake({ outOfScope: true, reason: 'pay' }, {}));
    expect(a).toMatchObject({ status: 'cannot', conclusion: OUT_OF_SCOPE });
  });
  it('invalid arguments from Claude become "cannot answer", not a wrong answer', async () => {
    const a = await runAsk(await model(), 'Who is free in March?', undefined, fake({ function: 'freeCapacity', args: { week: '2027-03-01' } }, {}));
    expect(a.status).toBe('cannot');
    expect(a.conclusion).toContain(OUT_OF_SCOPE);
  });
  it('edge errors show Try again; a failed conclude falls back to the template', async () => {
    const m = await model();
    const down = await runAsk(m, 'Who is idle?', undefined, async () => { throw new Error('network'); });
    expect(down.status).toBe('error');
    const half = await runAsk(m, 'Who is idle?', undefined, async (b: any) => {
      if (b.mode === 'choose') return { function: 'loadByPerson', args: { fromWeek: '2026-11-02', toWeek: '2026-11-30' } };
      throw new Error('timeout');
    });
    expect(half).toMatchObject({ status: 'answer', usedTemplate: true });
  });
  it('the answer is frozen: it records the scenario it was asked under', async () => {
    const m = await model();
    const a = await runAsk(m, 'Who will be available in 4 weeks?', KEY.meta.scenarios.pairAligned,
      fake({ function: 'freeCapacity', args: { week: '2026-11-30' } }, { text: '' }));
    expect(a.scenario).toBe('P-1, P-2 on, starts aligned (30 Nov)');
    expect((a.result as any).people.map((p: any) => p.name)).not.toContain('Kiss Márton');
  });
});

describe('edge function request and response handling', () => {
  it('choose request offers every function plus cannot_answer and forces a tool call', () => {
    const r = buildChooseRequest('Who is idle?', { x: 1 });
    expect(r.tools.map((t) => t.name)).toEqual([...FUNCTION_NAMES, 'cannot_answer']);
    expect(r.tool_choice).toEqual({ type: 'auto' });
    expect(r.system).toContain('"x":1');
  });
  it('parses a tool call, cannot_answer and no tool call', () => {
    expect(parseChooseResponse({ content: [{ type: 'tool_use', name: 'skillGap', input: { fromWeek: 'a' } }] }))
      .toEqual({ function: 'skillGap', args: { fromWeek: 'a' } });
    expect(parseChooseResponse({ content: [{ type: 'tool_use', name: 'cannot_answer', input: { reason: 'pay' } }] }))
      .toEqual({ outOfScope: true, reason: 'pay' });
    expect(parseChooseResponse({ content: [{ type: 'text', text: 'hi' }] })).toMatchObject({ outOfScope: true });
  });
  it('conclude request carries the payload; response text joined', () => {
    expect(JSON.stringify(buildConcludeRequest('q', { a: 68.8 }))).toContain('68.8');
    expect(parseConcludeResponse({ content: [{ type: 'text', text: 'One.' }, { type: 'text', text: 'Two.' }] })).toEqual({ text: 'One. Two.' });
  });
});
