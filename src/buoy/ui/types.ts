import type {ScorecardHealth} from '../scorecard-health';
export interface Billing {
  observedAt: string; reference: string; currency: string; totalMinor: number;
  creditsMinor: number; allocatedMinor: number; dueDate: string;
}
export interface Support { observedAt: string; reference: string; openTickets: number; urgentTickets: number }
export interface Account {
  stripeBilling?:import('../billing-evidence').StripeEvidence|null;
  id: string; name: string; renewalDate: string; noticeDays: number; renewalEvidence: string;
  billing: Billing | null; support: Support | null; revision: string; noticeDate: string; ownerId: string | null;
  tier:string|null;stage:string|null;segments:{id:string;name:string;enteredAt:string}[];
  handovers?: {fromId:string|null;toId:string;note:string;actorId:string;recordedAt:string}[];
  health: { score?:number|null;recalculatedAt?:string;scorecard?:ScorecardHealth; interpretation: string; evaluatedOn: string; status: 'at-risk' | 'healthy' | 'unknown' | 'watch'; reasons: string[]; sentiment: Sentiment | null; evidence: Evidence[] };
  /** Today's band, then each later day before renewal on which today's evidence projects a new band. */
  outlook: { from: string; status: 'at-risk' | 'healthy' | 'unknown' | 'watch' }[];
}
export interface Evidence { kind: 'billing' | 'support'; sourceSystem: 'manual' | 'stripe-test' | null; staleAfterDays: number; missing: boolean; stale: boolean }
export interface Sentiment { rating: 'red' | 'amber' | 'green'; reason: string; by: string; recordedAt: string; expiresOn: string; expired: boolean }
export interface Proposal {
  id: string; accountId: string; kind: 'playbook' | 'renewal';
  payload: { title?: string; dueDate?: string; priority?: string; type?: string; ownerId?: string; outcome?: string; reason?: string; evidence?: string };
  accountRevision: string; status: 'prepared' | 'approved'; preparedBy: string; preparedAt: string; approvedBy: string | null; approvedAt: string | null;
}
export interface Task {
  id: string; accountId: string; proposalId: string; title: string; dueDate: string; completedAt: string | null; evidence: string | null;
  /** PLAY-002: the owner, and who handles it today (the cover while the owner is away). */
  ownerId: string | null; handlerId: string | null; priority: string; type: string; outcome: string | null;
}
export interface Person { id: string; displayName: string; role: string; managerId: string | null; away: { coverId: string; startsOn: string; endsOn: string }[] }
export interface Reminder { id: string; kind: 'due-soon' | 'due-today' | 'escalated'; onDate: string; email: string; emailLabel: string; taskId: string; title: string; dueDate: string; accountId: string; accountName: string }
export interface Decision { id: string; accountId: string; proposalId: string; outcome: string; reason: string; evidence: string; renewalDate: string; recordedBy: string; recordedAt: string }
export interface State {
  operator: { id: string; displayName: string; role: string }; settings: { staleness: { billingDays: number; supportDays: number }; tasks: { remindDaysBefore: number; escalateAfterDays: number; timeZone: string | null } };
  accounts: Account[]; proposals: Proposal[]; tasks: Task[]; decisions: Decision[]; people: Person[]; notifications: Reminder[];
}
export type Api = (request: Request) => Promise<Response>;
export type Fields = Record<string, string>;
export interface Job { id: string; state: string; operationKey?: string; checkpoint?: number; total?: number; error?: string | null; [key: string]: unknown }
export const canManage = (state: State) => ['owner', 'admin'].includes(state.operator.role);
export const personName = (state: State, id: string | null) => state.people.find(person => person.id === id)?.displayName ?? (id ? 'A former team member' : 'No one');
