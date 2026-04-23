import { TaskDocument } from './types';

const formatValue = (value: string | Date | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function buildTaskDocument(task: TaskDocument): string {
  const lines: string[] = [];
  const pushLine = (label: string, rawValue: string | Date | null | undefined): void => {
    const value = formatValue(rawValue);
    if (value) {
      lines.push(`[${label}]: ${value}`);
    }
  };

  pushLine('Title', task.title);
  pushLine('Description', task.description);
  pushLine('Category', task.category);
  pushLine('Status', task.status);
  pushLine('Created', task.createdAt);

  if (task.assigneeName) {
    const roleSuffix = task.assigneeRole ? `${task.assigneeRole}` : 'unknown-role';
    const orgSuffix = task.orgName ? `, Org: ${task.orgName}` : '';
    lines.push(`[Assignee]: ${task.assigneeName} (${roleSuffix}${orgSuffix})`);
  }

  if (task.tags?.length) {
    lines.push(`[Tags]: ${task.tags.join(', ')}`);
  }

  if (task.activityLog?.length) {
    const orderedActivity = [...task.activityLog]
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .map((entry) => {
        const details = entry.details ? ` - ${entry.details}` : '';
        return `${entry.timestamp} ${entry.actorName}: ${entry.action}${details}`;
      });
    lines.push(`[Activity]: ${orderedActivity.join(' | ')}`);
  }

  return lines.join('\n');
}
