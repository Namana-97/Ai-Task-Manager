import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  category: string;
  priority?: string;
  assignee?: { id: string; name: string; role: string };
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface TaskMutationInput {
  title: string;
  description?: string;
  status?: string;
  category?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  tags?: string[];
}

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/tasks';

  listTasks(): Observable<ApiTask[]> {
    return this.http.get<ApiTask[]>(this.baseUrl);
  }

  getTask(taskId: string): Observable<ApiTask> {
    return this.http.get<ApiTask>(`${this.baseUrl}/${taskId}`);
  }

  createTask(task: TaskMutationInput): Observable<ApiTask> {
    return this.http.post<ApiTask>(this.baseUrl, task);
  }

  updateTask(taskId: string, task: Partial<TaskMutationInput>): Observable<ApiTask> {
    return this.http.put<ApiTask>(`${this.baseUrl}/${taskId}`, task);
  }

  deleteTask(taskId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${taskId}`);
  }
}
