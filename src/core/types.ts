// Shared types for the capacity planner core. See DATA_CONTRACT.md v2.1.
// Dates are ISO strings (YYYY-MM-DD). A Week is keyed by its Monday.

export type ISODate = string;
export type Week = ISODate;
export type ProjectType = 'signed' | 'pipeline' | 'internal';
export type Severity = 'error' | 'warning' | 'info';
export type AllocationSource = 'seed' | 'sprint' | 'manual';
export type PlanSource = AllocationSource | 'pipeline';

export interface DataIssue {
  severity: Severity;
  rule: string;
  file: string;
  row: number | string | null;
  text: string;
  fixIn: string | null;
}

export interface ManifestEntry {
  path: string;
  source: string; // HR | Jira | App
  kind: 'people' | 'absences' | 'worklogs' | 'sprint' | 'seed';
  exportedAt: string;
}

export interface HrPerson {
  email: string;
  name: string;
  title: string;
  weeklyHours: number;
  start: ISODate;
  end: ISODate | null;
  employmentType: string;
  row: number;
}

export interface Absence {
  email: string;
  type: string;
  start: ISODate;
  end: ISODate;
  row: number;
}

export interface RawWorklog {
  id: string;
  file: string;
  issueKey: string;
  projectKey: string;
  labels: string[];
  accountId: string;
  displayName: string;
  day: ISODate;
  hours: number;
}

export interface RawSprintIssue {
  key: string;
  projectKey: string;
  accountId: string | null;
  estimateSeconds: number | null;
}

export interface RawSprint {
  file: string;
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  issues: RawSprintIssue[];
}

export interface Settings {
  overloadPct: number;
  idlePct: number;
  availableMinHours: number;
  billableTargetPct: number;
  spareMinFte: number;
  today: ISODate;
}

export interface StackGroup {
  group: string;
  stacks: string[];
}

export interface DemandLine {
  stack: string;
  fte: number;
  fromWeek: Week | null; // null = project start
  toWeek: Week | null; // null = project end
  email: string | null; // null = unstaffed
}

export interface Project {
  projectId: string;
  name: string;
  client: string;
  type: ProjectType;
  origin: 'jira' | 'manual';
  startDate: ISODate;
  endDate: ISODate | null;
  durationWeeks: number | null;
  winChancePct: number | null;
  hourBudget: number | null;
  demand: DemandLine[];
}

export interface Allocation {
  email: string;
  projectId: string;
  hoursPerWeek: number;
  fromWeek: Week;
  toWeek: Week;
  source: AllocationSource;
}

export interface SeedPerson {
  email: string;
  stacks: string[];
  mainStack: string;
  costPerHour: number | null;
}

export interface Seed {
  savedAt: string;
  settings: Settings;
  stacks: StackGroup[];
  people: SeedPerson[];
  projects: Project[];
  allocations: Allocation[];
  jiraAccountMap: { accountId: string; email: string }[];
  jiraProjectMap: { jiraProjectKey: string; projectId: string }[];
}

/** Everything read from the files, before planning edits. */
export interface Dataset {
  manifest: ManifestEntry[];
  rows: Record<string, number>;
  issues: DataIssue[]; // issues found while parsing
  hrPeople: HrPerson[];
  absences: Absence[];
  worklogs: RawWorklog[];
  worklogFiles: { path: string; weekStart: Week; rows: number }[];
  sprint: RawSprint | null;
  seed: Seed;
}

export interface Person {
  email: string;
  name: string;
  title: string;
  weeklyHours: number;
  start: ISODate;
  end: ISODate | null;
  employmentType: string;
  stacks: string[];
  mainStack: string | null;
  costPerHour: number | null;
  absent: Set<ISODate>;
}

export interface Worklog {
  id: string;
  file: string;
  week: Week;
  day: ISODate;
  email: string | null; // null = unmapped person (F1)
  projectId: string | null; // null = unmapped key (F2)
  projectKey: string;
  hours: number;
  labels: string[];
}

export interface SprintPlan {
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  weeks: Week[];
  /** key `${email}|${projectId}` -> hours per sprint week */
  assigned: Map<string, number>;
  unassigned: { projectId: string; stack: string; hoursPerWeek: number; key: string }[];
}

export interface Scenario {
  projects: Record<string, { on: boolean; startShiftWeeks?: number }>;
  alignStarts?: boolean;
}

/** Dataset plus planning edits, with indexes. Immutable once built. */
export interface Model {
  dataset: Dataset;
  settings: Settings;
  stackGroups: StackGroup[];
  allStacks: string[];
  people: Person[];
  personByEmail: Map<string, Person>;
  projects: Project[];
  projectById: Map<string, Project>;
  allocations: Allocation[];
  allocByEmail: Map<string, Allocation[]>;
  worklogs: Worklog[];
  sprint: SprintPlan | null;
  accountMap: Map<string, string>;
  keyMap: Map<string, string>;
  issues: DataIssue[];
  unlabelledWorklogs: number;
}

export interface PlanRow {
  projectId: string;
  hours: number; // hours in this week, pro-rated
  ratePerWeek: number; // rate for a 5-day week
  source: PlanSource;
}
