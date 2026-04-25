import { CreateTaskParams, Task } from '../common/contracts';
import { Permission, ROLE_PERMISSIONS, RoleName } from '../auth/access-control';

export interface SeedOrganization {
  id: string;
  name: string;
  parentId: string | null;
}

export interface SeedUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  organizationId: string;
  roleName: RoleName;
  jobTitle: string;
}

export interface SeedRole {
  name: RoleName;
  permissions: Permission[];
}

export const seedOrganizations: SeedOrganization[] = [
  { id: 'org-root', name: 'Acme Product', parentId: null },
  { id: 'org-design', name: 'Acme Design', parentId: 'org-root' }
];

export const seedRoles: SeedRole[] = [
  { name: 'owner', permissions: ROLE_PERMISSIONS.owner },
  { name: 'admin', permissions: ROLE_PERMISSIONS.admin },
  { name: 'viewer', permissions: ROLE_PERMISSIONS.viewer }
];

export const seedUsers: SeedUser[] = [
  {
    id: 'user-001',
    username: 'alex',
    password: 'alex123',
    displayName: 'Alex Rivera',
    organizationId: 'org-root',
    roleName: 'viewer',
    jobTitle: 'Frontend Lead'
  },
  {
    id: 'user-002',
    username: 'jordan',
    password: 'jordan123',
    displayName: 'Jordan Lee',
    organizationId: 'org-root',
    roleName: 'admin',
    jobTitle: 'Backend Engineer'
  },
  {
    id: 'user-003',
    username: 'taylor',
    password: 'taylor123',
    displayName: 'Taylor Kim',
    organizationId: 'org-root',
    roleName: 'owner',
    jobTitle: 'Product Manager'
  },
  {
    id: 'user-004',
    username: 'morgan',
    password: 'morgan123',
    displayName: 'Morgan Patel',
    organizationId: 'org-root',
    roleName: 'viewer',
    jobTitle: 'QA Engineer'
  }
];

export function buildSeedTasks(): Task[] {
  const now = new Date('2026-04-22T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const users = [
    { id: 'user-001', name: 'Alex Rivera', role: 'Frontend Lead' },
    { id: 'user-002', name: 'Jordan Lee', role: 'Backend Engineer' },
    { id: 'user-003', name: 'Taylor Kim', role: 'Product Manager' },
    { id: 'user-004', name: 'Morgan Patel', role: 'QA Engineer' }
  ];
  const orgs = [
    { id: 'org-root', name: 'Acme Product' },
    { id: 'org-design', name: 'Acme Design' }
  ];

  const specs = [
    ['task-0001', 'Fix sprint burndown chart timezone drift', 'Analytics', 'In Progress', users[1], orgs[0], 3],
    ['task-0002', 'Prepare Q2 roadmap review deck', 'Planning', 'Done', users[2], orgs[0], 1],
    ['task-0003', 'Investigate flaky websocket reconnect test', 'Platform', 'Blocked', users[3], orgs[0], 6],
    ['task-0004', 'Refine onboarding checklist for enterprise trial', 'Operations', 'Open', users[2], orgs[0], 4],
    ['task-0005', 'Ship keyboard navigation for task drawer', 'UX', 'Done', users[0], orgs[0], 2],
    ['task-0006', 'Reduce API p95 latency for /tasks/search', 'Platform', 'In Progress', users[1], orgs[0], 16],
    ['task-0007', 'Backfill audit logs for overdue task escalations', 'Compliance', 'Open', users[1], orgs[0], 7],
    ['task-0008', 'Design blocked-state empty view', 'Design', 'In Progress', users[0], orgs[1], 8],
    ['task-0009', 'Create regression suite for recurring tasks', 'QA', 'Done', users[3], orgs[0], 2],
    ['task-0010', 'Resolve SSO callback mismatch for sandbox orgs', 'Security', 'Blocked', users[1], orgs[0], 10],
    ['task-0011', 'Tune notification digest batching job', 'Platform', 'Done', users[1], orgs[0], 5],
    ['task-0012', 'Document RBAC edge cases for support', 'Support', 'Open', users[2], orgs[0], 9],
    ['task-0013', 'Patch stale Prisma migration in demo seed path', 'Infrastructure', 'In Progress', users[1], orgs[0], 15],
    ['task-0014', 'Polish mobile task details drawer spacing', 'UX', 'Done', users[0], orgs[0], 1],
    ['task-0015', 'Audit third-party webhook retries', 'Security', 'In Progress', users[3], orgs[0], 12],
    ['task-0016', 'Write release notes for April sprint closeout', 'Planning', 'Open', users[2], orgs[0], 0],
    ['task-0017', 'Investigate overdue cluster in customer migration tasks', 'Operations', 'Blocked', users[2], orgs[0], 17],
    ['task-0018', 'Improve semantic search relevance sampling', 'AI', 'In Progress', users[1], orgs[0], 4],
    ['task-0019', 'Sync design tokens with shell preview app', 'Design', 'Done', users[0], orgs[1], 3],
    ['task-0020', 'Add post-release anomaly dashboard drilldowns', 'Analytics', 'Open', users[2], orgs[0], 14]
  ] as const;

  return specs.map(([id, title, category, status, assignee, org, ageDays], index) => ({
    id,
    title,
    description: `${title} with production-grade follow-through for the secure task management challenge.`,
    category,
    status,
    priority: ['Critical', 'High', 'Medium', 'Low'][index % 4] as Task['priority'],
    createdAt: daysAgo(ageDays + 2),
    updatedAt: daysAgo(Math.max(ageDays - 1, 0)),
    dueDate: daysAgo(ageDays - 3),
    assignee,
    org,
    tags: [category.toLowerCase(), status.toLowerCase().replace(/\s+/g, '-')],
    role: org.id === 'org-root' ? 'admin' : 'owner',
    activityLog: [
      {
        timestamp: daysAgo(ageDays + 1).toISOString(),
        actorName: assignee.name,
        action: 'created task'
      }
    ]
  }));
}

export function buildSeedTaskInput(): CreateTaskParams[] {
  return buildSeedTasks().map((task) => ({
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    assignee: task.assignee.name,
    status: task.status,
    dueDate: task.dueDate?.toISOString(),
    tags: task.tags
  }));
}
