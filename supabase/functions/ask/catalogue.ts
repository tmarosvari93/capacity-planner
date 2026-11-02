// The function catalogue Claude chooses from on the Ask page. Plain data, no imports:
// supabase/functions/ask/catalogue.ts is a copy, and a test checks the two are identical.

const WEEK = { type: 'string', description: 'Monday of an ISO week, YYYY-MM-DD. Past weeks: 2026-09-28 to 2026-10-26. Future weeks: 2026-11-02 to 2027-01-18.' };
const STACK = {
  type: 'string',
  enum: ['Java', '.NET', 'Node.js', 'React', 'Angular', 'Flutter', 'Native', 'QA', 'DevOps', 'UX/UI', 'Delivery'],
  description: 'A technology stack. Omit for all stacks.',
};
const SCENARIO = {
  type: 'object',
  description: 'Which pipeline projects are switched on. Omit to use the scenario currently open in the app.',
  properties: {
    projects: {
      type: 'object',
      description: 'Keyed by pipeline projectId, e.g. {"P-1": {"on": true, "startShiftWeeks": 0}}',
      additionalProperties: {
        type: 'object',
        properties: { on: { type: 'boolean' }, startShiftWeeks: { type: 'integer' } },
        required: ['on'],
      },
    },
    alignStarts: { type: 'boolean', description: 'true = every switched-on project starts on the earliest start among them' },
  },
  required: ['projects'],
};

export const FUNCTION_CATALOGUE = [
  {
    name: 'freeCapacity',
    description: 'Who has free hours (at least one day) in one future week, optionally for one stack. Answers "who will be available in 4 weeks?" (4 weeks = week of 2026-11-30).',
    input_schema: { type: 'object', properties: { week: WEEK, stack: STACK, scenario: SCENARIO }, required: ['week'] },
  },
  {
    name: 'scenarioImpact',
    description: 'What changes against the baseline if pipeline projects are switched on: people newly over 100% and stacks with a new or larger shortage. Use alignStarts: true when the question says the projects start at the same time.',
    input_schema: { type: 'object', properties: { scenario: SCENARIO }, required: ['scenario'] },
  },
  {
    name: 'skillGap',
    description: 'Which stacks run short (unstaffed demand larger than free main-stack supply) per future week, first week and peak FTE; spare capacity too.',
    input_schema: { type: 'object', properties: { fromWeek: WEEK, toWeek: WEEK, stack: STACK, scenario: SCENARIO }, required: ['fromWeek', 'toWeek'] },
  },
  {
    name: 'loadByPerson',
    description: 'Planned load % per person and future week: who is over 100%, who is idle (50% or less), who is planned while away.',
    input_schema: { type: 'object', properties: { fromWeek: WEEK, toWeek: WEEK, scenario: SCENARIO }, required: ['fromWeek', 'toWeek'] },
  },
  {
    name: 'billableSplit',
    description: 'From logged time (past weeks only): share of logged hours on signed client projects, and utilisation (billable ÷ available hours), for the company, by person or by project.',
    input_schema: {
      type: 'object',
      properties: { fromWeek: WEEK, toWeek: WEEK, groupBy: { type: 'string', enum: ['company', 'person', 'project'] } },
      required: ['fromWeek', 'toWeek', 'groupBy'],
    },
  },
  {
    name: 'planVsActual',
    description: 'Past weeks only: planned vs logged hours and the drift, by person or by project.',
    input_schema: {
      type: 'object',
      properties: { fromWeek: WEEK, toWeek: WEEK, groupBy: { type: 'string', enum: ['person', 'project'] } },
      required: ['fromWeek', 'toWeek', 'groupBy'],
    },
  },
  {
    name: 'projectBurn',
    description: 'One signed or internal project: hours and cost logged to date, % of hour budget if set, remaining planned and unstaffed hours, forecast.',
    input_schema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] },
  },
] as const;

export const CANNOT_ANSWER_TOOL = {
  name: 'cannot_answer',
  description: 'Use when the question cannot be answered from planning data: salaries, pay, performance, reasons for absence or health, anything about individuals beyond hours and stacks, or anything outside the data window.',
  input_schema: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
} as const;
