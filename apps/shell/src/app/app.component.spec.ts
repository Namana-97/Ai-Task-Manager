import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { CHAT_API_BASE_URL } from '@task-ai/ui-chat';

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem(
      'authUser',
      JSON.stringify({
        id: 'user-002',
        username: 'jordan',
        name: 'Jordan Lee',
        role: 'admin',
        orgId: 'org-root',
        orgName: 'Acme Product'
      })
    );
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        {
          provide: CHAT_API_BASE_URL,
          useValue: ''
        }
      ]
    }).compileComponents();
  });

  it('renders the dashboard shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    jest.spyOn(fixture.componentInstance, 'ngOnInit').mockImplementation(() => undefined);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('DASHBOARD');
    expect(element.textContent).toContain('TASKAI');
  });

  afterEach(() => {
    localStorage.clear();
  });
});
