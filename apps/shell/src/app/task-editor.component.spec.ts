import { TestBed } from '@angular/core/testing';
import { TaskEditorComponent } from './task-editor.component';

describe('TaskEditorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskEditorComponent]
    }).compileComponents();
  });

  it('emits a normalized payload on submit', () => {
    const fixture = TestBed.createComponent(TaskEditorComponent);
    const component = fixture.componentInstance;
    const emitted: unknown[] = [];
    component.submitted.subscribe((value) => emitted.push(value));

    component.title = 'Review security checklist';
    component.category = 'Security';
    component.status = 'Open';
    component.priority = 'High';
    component.assignee = 'Jordan';
    component.tags = 'security, rbac, ';

    component.submit();

    expect(emitted[0]).toEqual(
      expect.objectContaining({
        title: 'Review security checklist',
        category: 'Security',
        status: 'Open',
        priority: 'High',
        assignee: 'Jordan',
        tags: ['security', 'rbac']
      })
    );
  });
});
