const { performance } = require('node:perf_hooks');

async function main() {
  const tasks = createTasks(200);
  const documents = tasks.map((task) => buildTaskDocument(task));
  const vectors = documents.map((document) => embedLocally(document, 128));
  const query = 'Which analytics tasks are blocked?';
  const queryVector = embedLocally(query, 128);

  const runs = 25;
  const durations = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    const topResults = vectors
      .map((vector, taskIndex) => ({
        id: tasks[taskIndex].id,
        score: cosineSimilarity(queryVector, vector),
        title: tasks[taskIndex].title
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    durations.push(performance.now() - start);

    if (index === runs - 1) {
      console.log('Top hits:');
      for (const result of topResults) {
        console.log(`- ${result.id} | ${result.score.toFixed(4)} | ${result.title}`);
      }
    }
  }

  console.log(`Dataset size: ${tasks.length} tasks`);
  console.log(`Runs: ${runs}`);
  console.log(`Average retrieval latency: ${average(durations).toFixed(2)}ms`);
  console.log(`P95 retrieval latency: ${percentile(durations, 95).toFixed(2)}ms`);
}

function createTasks(count) {
  return Array.from({ length: count }, (_, index) => {
    const category = ['Analytics', 'Platform', 'Security', 'Operations'][index % 4];
    const status = ['Open', 'In Progress', 'Blocked', 'Done'][index % 4];
    return {
      id: `bench-task-${String(index + 1).padStart(4, '0')}`,
      title: `${category} task ${index + 1}`,
      description: `Investigate ${status.toLowerCase()} workflow path ${index + 1}`,
      category,
      status,
      createdAt: '2026-04-22T00:00:00.000Z',
      assigneeName: 'Benchmark User',
      assigneeRole: 'Engineer',
      orgName: 'Benchmark Org',
      tags: [category.toLowerCase(), status.toLowerCase().replace(/\s+/g, '-')],
      activityLog: [
        {
          timestamp: '2026-04-22T00:00:00.000Z',
          actorName: 'Benchmark User',
          action: 'created task'
        }
      ]
    };
  });
}

function buildTaskDocument(task) {
  const lines = [];
  pushLine(lines, 'Title', task.title);
  pushLine(lines, 'Description', task.description);
  pushLine(lines, 'Category', task.category);
  pushLine(lines, 'Status', task.status);
  pushLine(lines, 'Created', task.createdAt);
  if (task.assigneeName) {
    lines.push(`[Assignee]: ${task.assigneeName} (${task.assigneeRole}, Org: ${task.orgName})`);
  }
  if (task.tags && task.tags.length) {
    lines.push(`[Tags]: ${task.tags.join(', ')}`);
  }
  if (task.activityLog && task.activityLog.length) {
    lines.push(`[Activity] ${task.activityLog[0].timestamp} | ${task.activityLog[0].actorName} | ${task.activityLog[0].action}`);
  }
  return lines.join('\n');
}

function pushLine(lines, label, value) {
  if (value) {
    lines.push(`[${label}]: ${value}`);
  }
}

function embedLocally(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const slot = index % dimensions;
    vector[slot] += text.charCodeAt(index) / 255;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function cosineSimilarity(left, right) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  return dot / ((Math.sqrt(leftMagnitude) || 1) * (Math.sqrt(rightMagnitude) || 1));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, target) {
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.min(sorted.length - 1, Math.ceil((target / 100) * sorted.length) - 1);
  return sorted[position];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
