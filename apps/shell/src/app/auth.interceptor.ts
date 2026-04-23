import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const mockUser = localStorage.getItem('mockUser') ?? 'admin';
  const cloned = req.clone({
    setHeaders: {
      Authorization: 'Bearer dev-stub-token',
      'X-Mock-User': mockUser
    }
  });
  return next(cloned);
};
