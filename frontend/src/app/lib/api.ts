import { ApiAuthResponse, ApiDashboard, ApiNotification, ApiPage, ApiProject, ApiTask, ApiUser } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const TOKEN_KEY = 'taskmanager_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null as T;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export async function login(email: string, password: string) {
  return request<ApiAuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(name: string, email: string, password: string, role = 'member') {
  return request<ApiAuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, roles: [role.toUpperCase()] }),
  });
}

export async function getMe() {
  return request<ApiUser>('/api/users/me');
}

export async function updateMe(payload: Partial<ApiUser>) {
  return request<ApiUser>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function uploadMyAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<ApiUser>('/api/users/me/avatar', {
    method: 'POST',
    body: formData,
  });
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  return request<null>('/api/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getUsers() {
  return request<ApiUser[]>('/api/users');
}

export async function getProjects() {
  return request<ApiProject[]>('/api/projects');
}

export interface ProjectPayload {
  name: string;
  description: string;
}

export async function createProject(payload: ProjectPayload) {
  return request<ApiProject>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProject(projectId: string | number, payload: ProjectPayload) {
  return request<ApiProject>(`/api/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId: string | number) {
  return request<null>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function getTasks(params: Record<string, string | number | undefined> = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  const data = await request<ApiPage<ApiTask> | ApiTask[]>(`/api/tasks${query ? `?${query}` : ''}`);
  if (Array.isArray(data)) return data;
  return data.content ?? [];
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  statusUpdateNote?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  assignedToId?: number;
  projectId: number;
}

export async function createTask(payload: CreateTaskPayload) {
  return request<ApiTask>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  statusUpdateNote?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  assignedToId?: number;
  projectId?: number;
}

export async function updateTask(taskId: string | number, payload: UpdateTaskPayload) {
  return request<ApiTask>(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(taskId: string | number) {
  return request<null>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function getDashboard() {
  return request<ApiDashboard>('/api/dashboard');
}

export async function getNotifications() {
  return request<ApiNotification[]>('/api/notifications');
}
