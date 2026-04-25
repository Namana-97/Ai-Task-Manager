import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authToken = localStorage.getItem('authToken')?.trim();
  const cloned = req.clone({
    setHeaders: authToken
      ? {
          Authorization: `Bearer ${authToken}`
        }
      : {}
  });
  return next(cloned);
};
