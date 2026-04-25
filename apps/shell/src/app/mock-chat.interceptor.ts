import { HttpInterceptorFn } from '@angular/common/http';

export const mockChatInterceptor: HttpInterceptorFn = (req, next) => next(req);
