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
}
