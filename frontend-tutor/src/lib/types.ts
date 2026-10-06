export type StepId = 'plan' | 'search' | 'read' | 'answer';
export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';
export type Depth = 'standard' | 'deep';
export type TrustLevel = 'official' | 'reputable' | null;

export interface Step {
  status: StepStatus;
  detail?: string;
  ms?: number;
}

export interface Source {
  id: number;
  title: string;
  url: string;
  domain: string;
  provider: string;
  trust: TrustLevel;
  snippet: string;
  chars: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  status?: 'streaming' | 'done' | 'error' | 'aborted';
  steps?: Record<StepId, Step>;
  plan?: { topic: string; level: string; queries: string[] };
  sources?: Source[];
  meta?: { providerLabel: string; model: string; depth: Depth };
  error?: { code: string; message: string };
  ms?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export type TutorEvent =
  | { type: 'meta'; provider: string; providerLabel: string; model: string; depth: Depth }
  | { type: 'step'; id: StepId; status: StepStatus; detail?: string; ms?: number }
  | { type: 'plan'; topic: string; level: string; queries: string[] }
  | { type: 'sources'; sources: Source[] }
  | { type: 'token'; text: string }
  | { type: 'done'; ms: number }
  | { type: 'error'; code: string; message: string };

export interface ProviderInfo {
  id: string;
  label: string;
  defaultModel: string;
  requiresKey: boolean;
  keyHint: string;
  keyUrl: string | null;
  needsBaseUrl: boolean;
}

export interface ServerConfig {
  server: { provider: string; providerLabel: string; model: string } | null;
  providers: ProviderInfo[];
  search: { id: string; label: string; kind: 'web' | 'knowledge' }[];
  allowCustomBaseUrl: boolean;
}

export interface LlmOverride {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
