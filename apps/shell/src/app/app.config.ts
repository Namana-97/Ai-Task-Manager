import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { CHAT_API_BASE_URL } from '@task-ai/ui-chat';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    {
      provide: CHAT_API_BASE_URL,
      useValue: ''
    }
  ]
};
