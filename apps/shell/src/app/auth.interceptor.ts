import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authToken = localStorage.getItem('authToken')?.trim();
  const useLegacyAuth = localStorage.getItem('USE_LEGACY_AUTH') === 'true';
  const cloned = req.clone({
    setHeaders: authToken && authToken !== 'dev-stub-token'
      ? {
          Authorization: `Bearer ${authToken}`
        }
      : useLegacyAuth
        ? {
            Authorization: 'Bearer dev-stub-token',
            'X-Mock-User': localStorage.getItem('mockUser') ?? 'admin'
          }
        : {}
  });
  return next(cloned);
};
