export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  assigneeId: string;
  dueDate: string;
  projectId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  owner: string;
  ownerId: string;
  progress: number;
  teamSize: number;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  department: string;
  avatar?: string;
}

export const mockUsers: UserData[] = [
  { id: '1', name: 'Admin User', email: 'admin@task.com', role: 'admin', department: 'Management' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@task.com', role: 'manager', department: 'Engineering' },
  { id: '3', name: 'Mike Chen', email: 'mike@task.com', role: 'manager', department: 'Design' },
  { id: '4', name: 'Emma Wilson', email: 'emma@task.com', role: 'member', department: 'Engineering' },
  { id: '5', name: 'James Brown', email: 'james@task.com', role: 'member', department: 'Engineering' },
  { id: '6', name: 'Lisa Anderson', email: 'lisa@task.com', role: 'member', department: 'Design' },
];

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Mobile App Redesign',
    description: 'Complete redesign of the mobile application',
    status: 'active',
    owner: 'Sarah Johnson',
    ownerId: '2',
    progress: 65,
    teamSize: 5
  },
  {
    id: '2',
    name: 'API Integration',
    description: 'Integrate third-party APIs',
    status: 'active',
    owner: 'Mike Chen',
    ownerId: '3',
    progress: 40,
    teamSize: 3
  },
  {
    id: '3',
    name: 'Dashboard Analytics',
    description: 'Build analytics dashboard',
    status: 'on-hold',
    owner: 'Sarah Johnson',
    ownerId: '2',
    progress: 20,
    teamSize: 4
  }
];

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Design new login screen',
    description: 'Create modern login interface with biometric support',
    status: 'in-progress',
    priority: 'high',
    assignee: 'Lisa Anderson',
    assigneeId: '6',
    dueDate: '2026-04-15',
    projectId: '1',
    createdAt: '2026-04-01'
  },
  {
    id: '2',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication system',
    status: 'review',
    priority: 'high',
    assignee: 'Emma Wilson',
    assigneeId: '4',
    dueDate: '2026-04-14',
    projectId: '1',
    createdAt: '2026-03-28'
  },
  {
    id: '3',
    title: 'Setup API endpoints',
    description: 'Create RESTful API endpoints for user management',
    status: 'completed',
    priority: 'medium',
    assignee: 'James Brown',
    assigneeId: '5',
    dueDate: '2026-04-10',
    projectId: '2',
    createdAt: '2026-03-25'
  },
  {
    id: '4',
    title: 'Database schema design',
    description: 'Design and implement database schema',
    status: 'todo',
    priority: 'high',
    assignee: 'Emma Wilson',
    assigneeId: '4',
    dueDate: '2026-04-18',
    projectId: '2',
    createdAt: '2026-04-05'
  },
  {
    id: '5',
    title: 'Write unit tests',
    description: 'Add comprehensive unit test coverage',
    status: 'todo',
    priority: 'medium',
    assignee: 'James Brown',
    assigneeId: '5',
    dueDate: '2026-04-20',
    projectId: '1',
    createdAt: '2026-04-08'
  },
  {
    id: '6',
    title: 'UI component library',
    description: 'Build reusable component library',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'Lisa Anderson',
    assigneeId: '6',
    dueDate: '2026-04-16',
    projectId: '1',
    createdAt: '2026-04-02'
  }
];
