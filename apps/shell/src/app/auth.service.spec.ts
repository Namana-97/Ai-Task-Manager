import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores JWT session after login', () => {
    service.login('jordan', 'jordan123').subscribe();

    const request = httpMock.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush({
      token: 'jwt-token',
      user: {
        id: 'user-002',
        username: 'jordan',
        name: 'Jordan Lee',
        role: 'admin',
        orgId: 'org-root',
        orgName: 'Acme Product'
      }
    });

    expect(localStorage.getItem('authToken')).toBe('jwt-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.username).toBe('jordan');
  });
});
