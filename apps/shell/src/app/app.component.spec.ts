import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { CHAT_API_BASE_URL } from '@task-ai/ui-chat';

describe('AppComponent', () => {
  beforeEach(async () => {
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
    spyOn(fixture.componentInstance, 'ngOnInit').and.stub();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Dashboard');
    expect(element.textContent).toContain('TaskAI');
  });
});
