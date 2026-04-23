import { InjectionToken } from '@angular/core';

export const CHAT_API_BASE_URL = new InjectionToken<string>('CHAT_API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3333'
});
