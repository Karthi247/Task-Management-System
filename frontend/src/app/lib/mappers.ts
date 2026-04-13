import { ApiProject, ApiTask, ApiUser, Project, Task, User, UserRole } from './types';

const rolePriority: UserRole[] = ['admin', 'manager', 'member'];

export function mapRole(roles: string[] | undefined): UserRole {
  const normalized = (roles || []).map(role => role.replace('ROLE_', '').toLowerCase());
  const found = rolePriority.find(role => normalized.includes(role));
  return found ?? 'member';
}

export function toUser(apiUser: ApiUser): User {
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.name,
    avatar: apiUser.avatarUrl ?? undefined,
    role: mapRole(apiUser.roles),
    department: 'General',
  };
}

export function toTask(apiTask: ApiTask): Task {
  const statusMap: Record<string, Task['status']> = {
    TODO: 'todo',
    IN_PROGRESS: 'in-progress',
    REVIEW: 'review',
    COMPLETED: 'completed',
  };

  const priorityMap: Record<string, Task['priority']> = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  };

  const status = statusMap[apiTask.status] ?? 'todo';
  const priority = priorityMap[apiTask.priority] ?? 'medium';
  const dueDate = apiTask.dueDate ?? new Date().toISOString();

  return {
    id: String(apiTask.id),
    title: apiTask.title,
    description: apiTask.description,
    statusUpdateNote: apiTask.statusUpdateNote ?? '',
    status,
    priority,
    assignee: apiTask.assignedTo ?? 'Unassigned',
    dueDate,
    projectName: apiTask.projectName,
  };
}

export function buildProjects(apiProjects: ApiProject[], tasks: Task[]): Project[] {
  return apiProjects.map(project => {
    const projectTasks = tasks.filter(task => task.projectName === project.name);
    const completedCount = projectTasks.filter(task => task.status === 'completed').length;
    const totalCount = projectTasks.length;
    const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const status = totalCount === 0 ? 'on-hold' : (completedCount === totalCount ? 'completed' : 'active');
    const teamSize = new Set(projectTasks.map(task => task.assignee).filter(Boolean)).size;
    const owner = projectTasks.find(task => task.assignee)?.assignee ?? 'Unassigned';

    return {
      id: String(project.id),
      name: project.name,
      description: project.description,
      status,
      owner,
      progress,
      teamSize,
    };
  });
}
