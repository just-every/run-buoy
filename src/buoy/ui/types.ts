export interface Billing {
  observedAt: string; reference: string; currency: string; totalMinor: number;
  creditsMinor: number; allocatedMinor: number; dueDate: string;
}
export interface Support { observedAt: string; reference: string; openTickets: number; urgentTickets: number }
export interface Account {
  id: string; name: string; renewalDate: string; noticeDays: number; renewalEvidence: string;
  billing: Billing | null; support: Support | null; revision: string; noticeDate: string;
  health: { status: 'at-risk' | 'healthy' | 'unknown'; reasons: string[] };
}
export interface Proposal {
  id: string; accountId: string; kind: 'playbook' | 'renewal';
  payload: { title?: string; dueDate?: string; outcome?: string; reason?: string; evidence?: string };
  accountRevision: string; status: 'prepared' | 'approved'; preparedBy: string; approvedBy: string | null; approvedAt: string | null;
}
export interface Task { id: string; accountId: string; proposalId: string; title: string; dueDate: string; completedAt: string | null; evidence: string | null }
export interface Decision { id: string; accountId: string; proposalId: string; outcome: string; reason: string; evidence: string; renewalDate: string; recordedBy: string; recordedAt: string }
export interface State {
  operator: { displayName: string; role: string }; accounts: Account[]; proposals: Proposal[]; tasks: Task[]; decisions: Decision[];
}
export type Api = (request: Request) => Promise<Response>;
export type Fields = Record<string, string>;
export interface Job { id: string; state: string; operationKey?: string; checkpoint?: number; total?: number; error?: string | null; [key: string]: unknown }
export interface Preview { fingerprint: string; counts: unknown; diagnostics: unknown }
export const canManage = (state: State) => ['owner', 'admin'].includes(state.operator.role);
