import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Task } from '../common/contracts';

@Injectable()
export class TaskPersistenceService {
  private readonly filePath =
    process.env.NODE_ENV === 'test'
      ? join(tmpdir(), `ai-task-manager-tasks-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
      : process.env.TASK_STORE_PATH ?? join(process.cwd(), 'apps/api-ai/data/tasks.runtime.json');

  async load(seedTasks: Task[]): Promise<Task[]> {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedTask[];
      return parsed.map(deserializeTask);
    } catch {
      await this.save(seedTasks);
      return seedTasks.map(cloneTask);
    }
  }

  async save(tasks: Task[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(tasks.map(serializeTask), null, 2);
    await writeFile(this.filePath, payload, 'utf8');
  }
}

interface PersistedTask {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: Task['priority'];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  assignee: Task['assignee'];
  org: Task['org'];
  tags: string[];
  activityLog: Task['activityLog'];
  role: Task['role'];
}

function serializeTask(task: Task): PersistedTask {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dueDate: task.dueDate?.toISOString()
  };
}

function deserializeTask(task: PersistedTask): Task {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined
  };
}

function cloneTask(task: Task): Task {
  return deserializeTask(serializeTask(task));
}
