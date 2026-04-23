const { performance } = require('node:perf_hooks');

async function main() {
  const documents = Array.from({ length: 120 }, (_, index) =>
    buildTaskDocument({
      title: `Benchmark embedding task ${index + 1}`,
      description: `Synthetic task payload ${index + 1} for deterministic embedding throughput checks`,
      category: ['Analytics', 'Platform', 'AI'][index % 3],
      status: ['Open', 'In Progress', 'Blocked'][index % 3],
      createdAt: '2026-04-22T00:00:00.000Z',
      assigneeName: 'Benchmark User',
      assigneeRole: 'Engineer',
      orgName: 'Benchmark Org',
      tags: ['benchmark', `bucket-${index % 6}`]
    })
  );

  const start = performance.now();
  const vectors = documents.map((document) => embedLocally(document, 128));
  const durationMs = performance.now() - start;

  console.log(`Documents embedded: ${documents.length}`);
  console.log(`Embedding duration: ${durationMs.toFixed(2)}ms`);
  console.log(`Throughput: ${(documents.length / (durationMs / 1000)).toFixed(2)} docs/sec`);
  console.log(`Vector dimensions: ${vectors[0] ? vectors[0].length : 0}`);
}

function buildTaskDocument(task) {
  const lines = [];
  pushLine(lines, 'Title', task.title);
  pushLine(lines, 'Description', task.description);
  pushLine(lines, 'Category', task.category);
  pushLine(lines, 'Status', task.status);
  pushLine(lines, 'Created', task.createdAt);
  lines.push(`[Assignee]: ${task.assigneeName} (${task.assigneeRole}, Org: ${task.orgName})`);
  lines.push(`[Tags]: ${task.tags.join(', ')}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
