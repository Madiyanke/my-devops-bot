<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { marked } from 'marked'; // Pour transformer le texte de l'IA en HTML

// Types pour TypeScript
interface Message {
  id: number;
  role: 'user' | 'ai';
  content: string;
}

// État réactif
const userInput = ref('');
const isLoading = ref(false);
const messages = ref<Message[]>([
  {
    id: 0,
    role: 'ai',
    content: "👋 Bonjour ! Je suis ton Mentor DevOps. Une question sur Docker, K8s ou la CI/CD ? Je suis là pour t'expliquer et te donner des ressources."
  }
]);
const chatContainer = ref<HTMLElement | null>(null);

// Fonction pour scroller automatiquement vers le bas
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// Envoi du message au backend NestJS
const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return;

  // 1. Ajouter le message de l'utilisateur
  const userMsg = userInput.value;
  messages.value.push({ id: Date.now(), role: 'user', content: userMsg });
  userInput.value = '';
  isLoading.value = true;
  await scrollToBottom();

  try {
    // 2. Appel à l'API via le reverse proxy nginx (/api -> http://api:3000)
    // En production, nginx redirige /api vers le conteneur backend
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${apiUrl}/tutor/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg }),
    });

    const data = await response.json();

    // 3. Ajouter la réponse de l'IA
    messages.value.push({
      id: Date.now() + 1,
      role: 'ai',
      content: data.tutor_response // Le backend renvoie du Markdown
    });

    // eslint-disable-next-line no-unused-vars
  } catch (_error) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'ai',
      content: "⚠️ Oups, je n'arrive pas à joindre le cerveau central (Backend inaccessible)."
    });
  } finally {
    isLoading.value = false;
    await scrollToBottom();
  }
};

// Fonction utilitaire pour rendre le Markdown (liens, gras, listes)
const renderMarkdown = (text: string) => {
  return marked.parse(text);
};
</script>

<template>
  <div class="chat-window">
    <header class="header">
      <h1>🤖 DevOps Tutor AI</h1>
    </header>

    <div class="messages-area" ref="chatContainer">
      <div 
        v-for="msg in messages" 
        :key="msg.id" 
        class="message-wrapper"
        :class="{ 'my-message': msg.role === 'user', 'ai-message': msg.role === 'ai' }"
      >
        <div class="bubble">
          <div v-if="msg.role === 'ai'" v-html="renderMarkdown(msg.content)" class="markdown-body"></div>
          <div v-else>{{ msg.content }}</div>
        </div>
      </div>

      <div v-if="isLoading" class="message-wrapper ai-message">
        <div class="bubble loading">
          <span>.</span><span>.</span><span>.</span>
        </div>
      </div>
    </div>

    <div class="input-area">
      <input 
        v-model="userInput" 
        @keyup.enter="sendMessage"
        placeholder="Pose ta question DevOps ici..." 
        type="text" 
        :disabled="isLoading"
      />
      <button @click="sendMessage" :disabled="isLoading || !userInput">Envoyer</button>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* Global Styles with Modern Typography */
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
  overflow: hidden;
}

/* Animated background effect */
.chat-window::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(138, 43, 226, 0.3), transparent 50%);
  animation: gradientShift 15s ease infinite;
  pointer-events: none;
}

@keyframes gradientShift {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
}

/* Modern Header with Gradient */
.header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.18);
  color: white;
  padding: 1.5rem 2rem;
  text-align: center;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 2;
}

.header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  background: linear-gradient(to right, #fff, #f0f0f0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Messages Area with Custom Scrollbar */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  margin: 1rem;
  border-radius: 20px;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.1);
}

/* Custom Scrollbar */
.messages-area::-webkit-scrollbar {
  width: 8px;
}

.messages-area::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.messages-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  transition: background 0.3s ease;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* Message Wrapper with Animation */
.message-wrapper {
  display: flex;
  max-width: 75%;
  animation: messageSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* User Message - Vibrant Gradient */
.my-message {
  align-self: flex-end;
  justify-content: flex-end;
}

.my-message .bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px 20px 5px 20px;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
}

.my-message .bubble::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
  pointer-events: none;
}

/* AI Message - Glassmorphism */
.ai-message {
  align-self: flex-start;
}

.ai-message .bubble {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #1a202c;
  border-radius: 20px 20px 20px 5px;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
}

.ai-message .bubble::before {
  content: '🤖';
  position: absolute;
  top: -8px;
  left: -8px;
  font-size: 1.2rem;
  animation: robotFloat 3s ease-in-out infinite;
}

@keyframes robotFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

/* Bubble Styling */
.bubble {
  padding: 14px 20px;
  line-height: 1.6;
  font-size: 0.95rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}

.bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

/* Markdown Body Styling */
.markdown-body :deep(a) { 
  color: #667eea; 
  text-decoration: none;
  border-bottom: 1px solid #667eea;
  transition: border-color 0.2s ease;
}

.markdown-body :deep(a:hover) {
  border-bottom-width: 2px;
}

.markdown-body :deep(ul) { 
  padding-left: 20px; 
  margin: 8px 0; 
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(p) { 
  margin: 8px 0; 
}

.markdown-body :deep(code) { 
  background: linear-gradient(135deg, #f1f3f5 0%, #e9ecef 100%);
  padding: 3px 8px; 
  border-radius: 6px; 
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Input Area - Modern Glassmorphism */
.input-area {
  padding: 1.5rem 2rem 2rem;
  display: flex;
  gap: 12px;
  position: relative;
  z-index: 2;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.18);
}

/* Modern Input Field */
input {
  flex: 1;
  padding: 14px 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  outline: none;
  font-size: 0.95rem;
  font-family: 'Inter', sans-serif;
  background: rgba(255, 255, 255, 0.9);
  color: #1a202c;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

input::placeholder {
  color: #94a3b8;
}

input:focus { 
  border-color: rgba(255, 255, 255, 0.8);
  background: white;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* Premium Button with Gradient */
button {
  padding: 14px 32px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  font-family: 'Inter', sans-serif;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
  position: relative;
  overflow: hidden;
}

button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(245, 87, 108, 0.5);
}

button:hover:not(:disabled)::before {
  left: 100%;
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled { 
  background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
  cursor: not-allowed;
  box-shadow: none;
}

/* Loading Animation - More Elegant */
.loading {
  display: flex;
  align-items: center;
  gap: 4px;
}

.loading span {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  animation: loadingPulse 1.4s ease-in-out infinite both;
}

.loading span:nth-child(1) { animation-delay: 0s; }
.loading span:nth-child(2) { animation-delay: 0.2s; }
.loading span:nth-child(3) { animation-delay: 0.4s; }

@keyframes loadingPulse { 
  0%, 80%, 100% { 
    transform: scale(0.8);
    opacity: 0.5;
  } 
  40% { 
    transform: scale(1.2);
    opacity: 1;
  } 
}

/* Responsive Design */
@media (max-width: 768px) {
  .messages-area {
    padding: 1rem;
    margin: 0.5rem;
  }
  
  .message-wrapper {
    max-width: 85%;
  }
  
  .header h1 {
    font-size: 1.5rem;
  }
  
  .input-area {
    padding: 1rem;
  }
  
  button {
    padding: 12px 24px;
  }
}
</style>
