import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const mockUser = localStorage.getItem('mockUser') ?? 'admin';
  const authToken = localStorage.getItem('authToken')?.trim() || 'dev-stub-token';
  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${authToken}`,
      'X-Mock-User': mockUser
    }
  });
  return next(cloned);
};
