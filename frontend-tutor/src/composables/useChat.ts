import { computed, ref, watch } from 'vue';
import { streamAsk } from '../lib/api';
import { loadList, save } from '../lib/storage';
import type { Conversation, Message, StepId, TutorEvent } from '../lib/types';
import { useSettings } from './useSettings';

const KEY = 'devops-mentor:conversations';
const MAX_CONVERSATIONS = 50;

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const conversations = ref<Conversation[]>(loadList<Conversation>(KEY));
const currentId = ref<string | null>(null);
const busy = ref(false);
let controller: AbortController | null = null;

// Un onglet fermé en pleine génération : on ne laisse pas de message « en cours ».
for (const conversation of conversations.value) {
  for (const message of conversation.messages) {
    if (message.status === 'streaming') message.status = 'aborted';
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  conversations,
  (value) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(KEY, value.slice(0, MAX_CONVERSATIONS)), 400);
  },
  { deep: true },
);

const current = computed(() => conversations.value.find((c) => c.id === currentId.value) ?? null);

const sorted = computed(() => [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt));

function newConversation() {
  stop();
  currentId.value = null;
}

function select(id: string) {
  if (busy.value) stop();
  currentId.value = id;
}

function remove(id: string) {
  if (currentId.value === id) newConversation();
  conversations.value = conversations.value.filter((c) => c.id !== id);
}

function stop() {
  controller?.abort();
  controller = null;
}

const emptySteps = (): Record<StepId, { status: 'pending' }> => ({
  plan: { status: 'pending' },
  search: { status: 'pending' },
  read: { status: 'pending' },
  answer: { status: 'pending' },
});

function apply(message: Message, event: TutorEvent) {
  switch (event.type) {
    case 'meta':
      message.meta = { providerLabel: event.providerLabel, model: event.model, depth: event.depth };
      break;
    case 'step':
      message.steps![event.id] = { status: event.status, detail: event.detail, ms: event.ms };
      break;
    case 'plan':
      message.plan = { topic: event.topic, level: event.level, queries: event.queries };
      break;
    case 'sources':
      message.sources = event.sources;
      break;
    case 'token':
      message.content += event.text;
      break;
    case 'done':
      message.status = 'done';
      message.ms = event.ms;
      break;
    case 'error':
      message.status = 'error';
      message.error = { code: event.code, message: event.message };
      break;
  }
}

async function ask(text: string) {
  const question = text.trim();
  if (!question || busy.value) return;
  const { settings, llmOverride } = useSettings();

  let conversation = current.value;
  if (!conversation) {
    conversation = {
      id: uid(),
      title: question.length > 60 ? `${question.slice(0, 57)}…` : question,
      messages: [],
      updatedAt: Date.now(),
    };
    conversations.value.unshift(conversation);
    currentId.value = conversation.id;
    conversation = conversations.value[0];
  }

  const history = conversation.messages
    .filter((m) => m.content && (m.role === 'user' || m.status === 'done'))
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  conversation.messages.push({ id: uid(), role: 'user', content: question, createdAt: Date.now() });
  conversation.messages.push({
    id: uid(),
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
    steps: emptySteps(),
    sources: [],
  });
  // Toujours passer par le proxy réactif pour que l'interface se mette à jour.
  const message = conversation.messages[conversation.messages.length - 1];
  conversation.updatedAt = Date.now();

  busy.value = true;
  controller = new AbortController();
  try {
    await streamAsk(
      { message: question, history, depth: settings.depth, llm: llmOverride() },
      (event) => apply(message, event),
      controller.signal,
    );
    if (message.status === 'streaming') {
      message.status = message.content ? 'done' : 'error';
      if (!message.content) message.error = { code: 'empty', message: 'La connexion a été interrompue avant la réponse.' };
    }
  } catch (error) {
    if (controller?.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      message.status = 'aborted';
    } else {
      message.status = 'error';
      message.error = {
        code: 'network',
        message:
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'Impossible de joindre le backend. Vérifie que le service API est démarré.',
      };
    }
  } finally {
    for (const step of Object.values(message.steps ?? {})) {
      if (step.status === 'running') step.status = message.status === 'aborted' ? 'skipped' : 'error';
    }
    busy.value = false;
    controller = null;
    conversation.updatedAt = Date.now();
  }
}

/** Relance la dernière question de la conversation. */
async function retry() {
  const conversation = current.value;
  if (!conversation || busy.value) return;
  const lastUser = [...conversation.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  const index = conversation.messages.lastIndexOf(lastUser);
  conversation.messages.splice(index);
  await ask(lastUser.content);
}

export function useChat() {
  return {
    conversations: sorted,
    current,
    currentId,
    busy,
    ask,
    retry,
    stop,
    select,
    remove,
    newConversation,
  };
}
