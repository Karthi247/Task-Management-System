export type UserRole = 'admin' | 'manager' | 'member';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  department?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  statusUpdateNote?: string;
  status: 'todo' | 'in-progress' | 'review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  dueDate: string;
  projectName?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  owner: string;
  progress: number;
  teamSize: number;
}

export interface ApiAuthResponse {
  token: string;
  email: string;
  roles: string[];
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roles: string[];
}

export interface ApiProject {
  id: number;
  name: string;
  description: string;
  createdDate: string;
}

export interface ApiTask {
  id: number;
  title: string;
  description: string;
  statusUpdateNote?: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdBy: string;
  assignedTo: string | null;
  projectName: string;
}

export interface ApiDashboard {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  tasksPerUser: Record<string, number>;
  tasksPerProject: Record<string, number>;
}

export interface ApiPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'DUE_SOON' | 'OVERDUE';
}

export interface ApiNotification {
  id: number;
  title: string;
  message: string;
  type: string;
}
