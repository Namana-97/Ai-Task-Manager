const promptList = document.getElementById('prompt-list');
const messagesEl = document.getElementById('messages');
const panel = document.getElementById('panel');
const fab = document.getElementById('fab');
const heroPrimary = document.querySelector('.primary-button');
const closeButton = document.getElementById('close');
const clearButton = document.getElementById('clear');
const composer = document.getElementById('composer');
const messageInput = document.getElementById('message');

const prompts = [
  'What is blocked right now?',
  'Which Platform tasks are still in progress?',
  'Summarize last week throughput',
  'Show overdue tasks'
];

const mockPayload = {
  answer:
    'You finished 4 tasks last week, with the strongest throughput in UX and Platform work. The most visible completions were [task-0005], [task-0009], [task-0011], and [task-0014].',
  sources: [
    { taskId: 'task-0005', title: 'Ship keyboard navigation for task drawer', similarity: 0.93 },
    { taskId: 'task-0011', title: 'Tune notification digest batching job', similarity: 0.88 }
  ]
};

renderPrompts();

fab.addEventListener('click', togglePanel);
heroPrimary.addEventListener('click', openPanel);
closeButton.addEventListener('click', togglePanel);
clearButton.addEventListener('click', clearConversation);
composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) {
    return;
  }

  messageInput.value = '';
  await sendMessage(message);
});

async function sendMessage(message) {
  openPanel();
  appendMessage({ role: 'user', content: message });
  const assistant = appendMessage({ role: 'assistant', content: '', streaming: true });

  for (const word of mockPayload.answer.split(' ')) {
    assistant.content.textContent += `${word} `;
    await delay(45);
  }

  assistant.cursor.remove();
  renderSources(assistant.container, mockPayload.sources);
}

function appendMessage(message) {
  const group = document.createElement('div');
  group.className = 'message-group';

  const bubble = document.createElement('article');
  bubble.className = `bubble ${message.role}`;

  const content = document.createElement('div');
  content.textContent = message.content;
  bubble.appendChild(content);

  let cursor = document.createElement('span');
  cursor.className = 'cursor';
  cursor.textContent = '▊';
  if (message.streaming) {
    bubble.appendChild(cursor);
  } else {
    cursor = null;
  }

  group.appendChild(bubble);
  messagesEl.appendChild(group);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return { container: group, content, cursor };
}

function renderSources(container, sources) {
  const sourceList = document.createElement('div');
  sourceList.className = 'sources';

  for (const source of sources) {
    const card = document.createElement('div');
    card.className = 'source';
    card.innerHTML = `
      <div class="id">${source.taskId}</div>
      <div class="source-title">${source.title}</div>
      <div class="source-score">${Math.round(source.similarity * 100)}% match</div>
    `;
    sourceList.appendChild(card);
  }

  container.appendChild(sourceList);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderPrompts() {
  promptList.replaceChildren();
  for (const prompt of prompts) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt';
    button.textContent = prompt;
    button.addEventListener('click', () => {
      messageInput.value = prompt;
      sendMessage(prompt);
    });
    promptList.appendChild(button);
  }
}

function clearConversation() {
  const groups = [...messagesEl.querySelectorAll('.message-group')];
  for (const group of groups) {
    group.remove();
  }
  renderPrompts();
}

function togglePanel() {
  panel.classList.toggle('open');
}

function openPanel() {
  panel.classList.add('open');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
