import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Filter,
  FolderKanban,
  LayoutGrid,
  Plus,
  Search,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { createTask, deleteTask, getProjects, getTasks, getUsers, updateTask } from '../../lib/api';
import { buildProjects, toTask, toUser } from '../../lib/mappers';
import { Project, Task, User } from '../../lib/types';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

type Scope = 'week' | 'month' | 'project';
type TaskStatusFilter = 'all' | Task['status'];
type TaskPriorityFilter = 'all' | Task['priority'];

interface ProjectInsight {
  project: Project;
  tasks: Task[];
  completed: number;
  overdue: number;
  members: string[];
  deadlineText: string;
  deadlineTone: 'default' | 'warning' | 'danger';
}

interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  tone: 'success' | 'warning' | 'danger' | 'default';
  icon: typeof Activity;
}

interface TaskFormState {
  title: string;
  description: string;
  projectId: string;
  assignedToId: string;
  status: Task['status'];
  priority: Task['priority'];
  dueDate: string;
}

interface TaskActionFormState {
  title: string;
  description: string;
  projectId: string;
  assignedToId: string;
  status: Task['status'];
  priority: Task['priority'];
  dueDate: string;
}

interface TaskActionErrors {
  title?: string;
  description?: string;
  projectId?: string;
  assignedToId?: string;
  dueDate?: string;
  submit?: string;
}

type TaskDialogMode = 'view' | 'edit' | 'assign';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const FULL_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const CHART_CONFIG = {
  completed: { label: 'Completed', color: 'var(--chart-2)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-1)' },
  pending: { label: 'Pending', color: 'var(--chart-3)' },
};

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'NA';
const trendLabel = (current: number, previous: number) => previous === 0 ? (current === 0 ? '0%' : '+100%') : `${Math.round(((current - previous) / previous) * 100) >= 0 ? '+' : ''}${Math.round(((current - previous) / previous) * 100)}%`;
const taskStatusLabel = (status: Task['status']) => status.replace('-', ' ');
const taskStatusClass = (status: Task['status']) => status === 'completed' ? 'bg-accent text-accent-foreground border-transparent' : status === 'in-progress' ? 'bg-primary/10 text-primary border-transparent' : status === 'review' ? 'bg-amber-500/15 text-amber-700 border-transparent' : 'bg-muted text-muted-foreground border-transparent';
const priorityClass = (priority: Task['priority']) => priority === 'high' ? 'bg-destructive/15 text-destructive border-transparent' : priority === 'medium' ? 'bg-primary/10 text-primary border-transparent' : 'bg-muted text-muted-foreground border-transparent';
const isBetween = (date: Date | null, start: Date, end: Date) => Boolean(date && date.getTime() >= start.getTime() && date.getTime() < end.getTime());
const errorInputClass = 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30';
const normalInputClass = 'border-border';

export function ManagerDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [scope, setScope] = useState<Scope>('week');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskDialogMode, setTaskDialogMode] = useState<TaskDialogMode>('view');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [taskActionForm, setTaskActionForm] = useState<TaskActionFormState>({
    title: '',
    description: '',
    projectId: '',
    assignedToId: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
  });
  const [taskActionSaving, setTaskActionSaving] = useState(false);
  const [taskActionErrors, setTaskActionErrors] = useState<TaskActionErrors>({});
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [form, setForm] = useState<TaskFormState>({
    title: '',
    description: '',
    projectId: '',
    assignedToId: '',
    status: 'todo',
    priority: 'medium',
    dueDate: toInputDate(addDays(new Date(), 7)),
  });

  const loadDashboard = useCallback(async () => {
    const [taskData, projectData, userData] = await Promise.all([
      getTasks({ size: 300 }).catch(() => []),
      getProjects().catch(() => []),
      getUsers().catch(() => []),
    ]);
    const mappedTasks = taskData.map(toTask);
    setTasks(mappedTasks);
    setProjects(buildProjects(projectData, mappedTasks));
    setUsers(userData.map(toUser));
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard().catch(() => {
      if (!active) return;
      setTasks([]);
      setProjects([]);
      setUsers([]);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (scope !== 'project' || projects.length === 0) return;
    setSelectedProjectId(prev => (prev !== 'all' && projects.some(project => String(project.id) === prev) ? prev : String(projects[0].id)));
  }, [projects, scope]);

  const projectInsights = useMemo<ProjectInsight[]>(() => projects.map(project => {
    const projectTasks = tasks.filter(task => task.projectName === project.name);
    const completed = projectTasks.filter(task => task.status === 'completed').length;
    const overdue = projectTasks.filter(task => {
      const due = parseDate(task.dueDate);
      return task.status !== 'completed' && due ? due.getTime() < Date.now() : false;
    }).length;
    const dates = projectTasks.map(task => parseDate(task.dueDate)).filter((d): d is Date => Boolean(d));
    const deadline = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    const members = Array.from(new Set(projectTasks.map(task => task.assignee).filter(name => name && name !== 'Unassigned')));
    return {
      project,
      tasks: projectTasks,
      completed,
      overdue,
      members,
      deadlineText: deadline ? FULL_DATE.format(deadline) : 'No deadline',
      deadlineTone: !deadline ? 'default' : deadline.getTime() < Date.now() && project.status !== 'completed' ? 'danger' : deadline.getTime() - Date.now() <= 3 * 86400000 && project.status !== 'completed' ? 'warning' : 'default',
    };
  }), [projects, tasks]);

  const scoped = useMemo(() => {
    const today = todayStart();
    const end = addDays(today, scope === 'month' ? 30 : 7);
    const prevStart = addDays(today, scope === 'month' ? -30 : -7);
    const selectedProject = projects.find(project => String(project.id) === selectedProjectId);
    const projectName = scope === 'project' ? selectedProject?.name : null;
    const current = tasks.filter(task => {
      if (projectName && task.projectName !== projectName) return false;
      if (scope === 'project') return true;
      const due = parseDate(task.dueDate);
      return due ? (due >= today && due < end) || (task.status !== 'completed' && due.getTime() < today.getTime()) : false;
    });
    const previous = tasks.filter(task => {
      if (projectName && task.projectName !== projectName) return false;
      if (scope === 'project') return false;
      const due = parseDate(task.dueDate);
      return due ? due >= prevStart && due < today : false;
    });
    return { current, previous, selectedProject };
  }, [projects, scope, selectedProjectId, tasks]);

  const visibleProjects = useMemo(() => projectInsights.filter(project => scope === 'project' ? String(project.project.id) === selectedProjectId : project.tasks.length > 0 || project.project.status === 'completed'), [projectInsights, scope, selectedProjectId]);

  const filteredTasks = useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    return scoped.current
      .filter(task => statusFilter === 'all' || task.status === statusFilter)
      .filter(task => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter(task => !query || [task.title, task.description, task.assignee, task.projectName ?? ''].join(' ').toLowerCase().includes(query))
      .sort((a, b) => (parseDate(a.dueDate)?.getTime() ?? 0) - (parseDate(b.dueDate)?.getTime() ?? 0));
  }, [priorityFilter, scoped.current, statusFilter, taskSearch]);

  const completed = scoped.current.filter(task => task.status === 'completed').length;
  const overdue = scoped.current.filter(task => {
    const due = parseDate(task.dueDate);
    return task.status !== 'completed' && due ? due.getTime() < Date.now() : false;
  }).length;
  const activeProjects = visibleProjects.filter(project => project.project.status === 'active').length;
  const productivity = scoped.current.length ? Math.round((completed / scoped.current.length) * 100) : 0;
  const prevCompleted = scoped.previous.filter(task => task.status === 'completed').length;
  const prevOverdue = scoped.previous.filter(task => {
    const due = parseDate(task.dueDate);
    return task.status !== 'completed' && due ? due.getTime() < Date.now() : false;
  }).length;
  const prevActiveProjects = projectInsights.filter(project => scoped.previous.some(task => task.projectName === project.project.name) && project.project.status === 'active').length;
  const prevProductivity = scoped.previous.length ? Math.round((prevCompleted / scoped.previous.length) * 100) : 0;

  const statusData = [
    { name: 'Completed', value: scoped.current.filter(task => task.status === 'completed').length, fill: 'var(--chart-2)' },
    { name: 'In Progress', value: scoped.current.filter(task => task.status === 'in-progress').length, fill: 'var(--chart-1)' },
    { name: 'Pending', value: scoped.current.filter(task => task.status === 'todo' || task.status === 'review').length, fill: 'var(--chart-3)' },
  ];

  const weeklyData = useMemo(() => {
    const start = todayStart();
    return Array.from({ length: 7 }).map((_, index) => {
      const day = addDays(start, index - 6);
      const next = addDays(day, 1);
      return { day: SHORT_DATE.format(day), completed: scoped.current.filter(task => task.status === 'completed' && isBetween(parseDate(task.dueDate), day, next)).length };
    });
  }, [scoped.current]);

  const memberData = useMemo(() => {
    const counts = new Map<string, number>();
    scoped.current.filter(task => task.status === 'completed').forEach(task => {
      if (task.assignee === 'Unassigned') return;
      counts.set(task.assignee, (counts.get(task.assignee) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, completed]) => ({ name, completed })).sort((a, b) => b.completed - a.completed).slice(0, 5);
  }, [scoped.current]);

  const performers = memberData.map(member => ({ ...member, avatar: initials(member.name), rate: Math.min(100, member.completed * 20) }));

  const timeline = useMemo<TimelineItem[]>(() => {
    const items = scoped.current
      .slice()
      .sort((a, b) => (parseDate(b.dueDate)?.getTime() ?? 0) - (parseDate(a.dueDate)?.getTime() ?? 0))
      .slice(0, 6)
      .map(task => {
        const due = parseDate(task.dueDate);
        const overdueTask = task.status !== 'completed' && due ? due.getTime() < Date.now() : false;
        if (task.status === 'completed') return { id: task.id, title: `Completed ${task.title}`, detail: task.statusUpdateNote || `Finished by ${task.assignee}`, timeLabel: due ? SHORT_DATE.format(due) : 'Today', tone: 'success', icon: CheckCircle2 };
        if (overdueTask) return { id: task.id, title: `Overdue ${task.title}`, detail: `${task.assignee} needs a follow-up`, timeLabel: due ? SHORT_DATE.format(due) : 'Due now', tone: 'danger', icon: AlertTriangle };
        if (task.status === 'in-progress') return { id: task.id, title: `In progress ${task.title}`, detail: `Assigned to ${task.assignee}`, timeLabel: due ? SHORT_DATE.format(due) : 'Soon', tone: 'warning', icon: Clock3 };
        return { id: task.id, title: `New assignment ${task.title}`, detail: task.assignee === 'Unassigned' ? 'Waiting for assignee' : `Assigned to ${task.assignee}`, timeLabel: due ? SHORT_DATE.format(due) : 'Soon', tone: 'default', icon: UserPlus };
      });

    return items.slice(0, 8);
  }, [scoped.current]);

  const openCreateTask = () => {
    const defaultProject = scope === 'project' ? scoped.selectedProject : projects[0];
    setForm({
      title: '',
      description: '',
      projectId: defaultProject ? String(defaultProject.id) : '',
      assignedToId: '',
      status: 'todo',
      priority: 'medium',
      dueDate: toInputDate(addDays(new Date(), 7)),
    });
    setError('');
    setIsCreateOpen(true);
  };

  const openTaskDialog = (task: Task, mode: 'view' | 'edit' | 'assign') => {
    setSelectedTask(task);
    setTaskDialogMode(mode);
    setAssigneeQuery('');
    setTaskActionForm({
      title: task.title,
      description: task.description,
      projectId: projects.find(project => project.name === task.projectName)?.id ?? '',
      assignedToId: users.find(user => user.name === task.assignee)?.id ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate && parseDate(task.dueDate) ? toInputDate(parseDate(task.dueDate) as Date) : '',
    });
    setTaskActionErrors({});
    setIsTaskDialogOpen(true);
  };

  const closeTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setSelectedTask(null);
    setAssigneeQuery('');
    setTaskActionErrors({});
    setTaskActionSaving(false);
  };

  const openDeleteConfirmation = () => {
    setIsDeleteConfirmOpen(true);
  };

  const closeDeleteConfirmation = () => {
    setIsDeleteConfirmOpen(false);
    setIsDeletingTask(false);
  };

  const validateTaskActionForm = () => {
    const errors: TaskActionErrors = {};

    if (taskDialogMode !== 'assign' && !taskActionForm.title.trim()) {
      errors.title = 'Task name is required';
    }

    if (taskDialogMode !== 'assign' && !taskActionForm.description.trim()) {
      errors.description = 'Add a short description';
    }

    if (taskDialogMode === 'edit' && !taskActionForm.projectId) {
      errors.projectId = 'Project is required';
    }

    if ((taskDialogMode === 'edit' || taskDialogMode === 'assign') && !taskActionForm.assignedToId) {
      errors.assignedToId = 'Choose a teammate to assign this task';
    }

    if (taskDialogMode === 'edit' && taskActionForm.dueDate) {
      const today = toInputDate(new Date());
      if (taskActionForm.dueDate < today) {
        errors.dueDate = 'Deadline cannot be in the past';
      }
    }

    setTaskActionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const filteredAssignableUsers = useMemo(() => {
    const query = assigneeQuery.trim().toLowerCase();
    return users.filter(user => user.role === 'member' && (!query || [user.name, user.email].join(' ').toLowerCase().includes(query)));
  }, [assigneeQuery, users]);

  const saveTaskAction = async () => {
    if (!selectedTask) return;
    if (taskDialogMode !== 'view' && !validateTaskActionForm()) return;

    setTaskActionSaving(true);
    setTaskActionErrors({});

    try {
      const payload =
        taskDialogMode === 'assign'
          ? {
              assignedToId: taskActionForm.assignedToId ? Number(taskActionForm.assignedToId) : undefined,
            }
          : {
              title: taskActionForm.title.trim(),
              description: taskActionForm.description.trim(),
              status: taskActionForm.status.toUpperCase() as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED',
              priority: taskActionForm.priority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
              dueDate: taskActionForm.dueDate || undefined,
              assignedToId: taskActionForm.assignedToId ? Number(taskActionForm.assignedToId) : undefined,
              projectId: taskActionForm.projectId ? Number(taskActionForm.projectId) : undefined,
            };

      await updateTask(selectedTask.id, payload);
      await loadDashboard();
      closeTaskDialog();
      toast.success(
        taskDialogMode === 'assign'
          ? 'Task reassigned successfully'
          : taskDialogMode === 'edit'
            ? 'Task updated successfully'
            : 'Task refreshed',
      );
    } catch (err) {
      setTaskActionErrors({ submit: err instanceof Error ? err.message : 'Failed to update task' });
    } finally {
      setTaskActionSaving(false);
    }
  };

  const confirmDeleteTask = async () => {
    if (!selectedTask) return;

    setIsDeletingTask(true);
    try {
      await deleteTask(selectedTask.id);
      await loadDashboard();
      closeDeleteConfirmation();
      closeTaskDialog();
      toast.success('Task deleted successfully');
    } catch (err) {
      setTaskActionErrors({ submit: err instanceof Error ? err.message : 'Failed to delete task' });
      setIsDeletingTask(false);
    }
  };

  const createTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) return setError('Task name is required');
    if (!form.projectId) return setError('Project is required');

    setSaving(true);
    setError('');
    try {
      await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status.toUpperCase() as 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED',
        priority: form.priority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH',
        dueDate: form.dueDate || undefined,
        assignedToId: form.assignedToId ? Number(form.assignedToId) : undefined,
        projectId: Number(form.projectId),
      });
      await loadDashboard();
      setIsCreateOpen(false);
      toast.success('Task created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {DATE_FORMATTER.format(new Date())}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Manager Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">A clean overview of team progress, urgent work, project health, and recent activity.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={scope} onValueChange={value => setScope(value as Scope)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>

            {scope === 'project' && (
              <Select value={selectedProjectId} onValueChange={value => setSelectedProjectId(value)}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(project => <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Button onClick={openCreateTask} className="shadow-md"><Plus />Create Task</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Completed Tasks" value={completed} trend={trendLabel(completed, prevCompleted)} trendUp={completed >= prevCompleted} icon={CheckCircle2} color="accent" />
        <MetricCard title="Overdue Tasks" value={overdue} trend={trendLabel(overdue, prevOverdue)} trendUp={overdue <= prevOverdue} icon={AlertTriangle} color="destructive" />
        <MetricCard title="Active Projects" value={activeProjects} trend={trendLabel(activeProjects, prevActiveProjects)} trendUp={activeProjects >= prevActiveProjects} icon={FolderKanban} color="primary" />
        <MetricCard title="Team Productivity %" value={`${productivity}%`} trend={trendLabel(productivity, prevProductivity)} trendUp={productivity >= prevProductivity} icon={TrendingUp} color="primary" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Tasks by Status" subtitle="Completed, in progress, and pending" icon={BarChart3}>
          <ChartContainer config={CHART_CONFIG} className="h-[280px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={104} paddingAngle={3}>
                {statusData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
        </SectionCard>

        <SectionCard title="Weekly Task Completion" subtitle="Completed tasks by day" icon={Activity}>
          <ChartContainer config={{ completed: { label: 'Completed', color: 'var(--chart-2)' } }} className="h-[280px] w-full">
            <BarChart data={weeklyData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completed" radius={[8, 8, 0, 0]} fill="var(--chart-2)" />
            </BarChart>
          </ChartContainer>
        </SectionCard>

        <SectionCard title="Team Performance" subtitle="Top performers by completed tasks" icon={Users}>
          <ChartContainer config={{ completed: { label: 'Completed', color: 'var(--chart-1)' } }} className="h-[280px] w-full">
            <BarChart data={memberData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="completed" radius={[0, 10, 10, 0]} fill="var(--chart-1)" barSize={18} />
            </BarChart>
          </ChartContainer>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Team Tasks</h2>
              <p className="text-sm text-muted-foreground">Search, filter, and monitor work in progress</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks, projects, assignees" className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={value => setStatusFilter(value as TaskStatusFilter)}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={value => setPriorityFilter(value as TaskPriorityFilter)}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.slice(0, 8).map(task => (
                  <TableRow key={task.id}>
                    <TableCell><div><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{task.projectName}</p></div></TableCell>
                    <TableCell>{task.assignee}</TableCell>
                    <TableCell><Badge className={priorityClass(task.priority)}>{task.priority}</Badge></TableCell>
                    <TableCell><span className={task.status !== 'completed' && parseDate(task.dueDate)?.getTime() < Date.now() ? 'font-medium text-destructive' : ''}>{task.dueDate ? FULL_DATE.format(new Date(task.dueDate)) : 'No deadline'}</span></TableCell>
                    <TableCell><Badge className={taskStatusClass(task.status)}>{taskStatusLabel(task.status)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openTaskDialog(task, 'view')}><ClipboardList />View</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openTaskDialog(task, 'edit')}><LayoutGrid />Edit</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openTaskDialog(task, 'assign')}><UserPlus />Assign</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredTasks.length === 0 && <div className="py-10 text-center text-muted-foreground">No tasks match your current filters.</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Projects</h2>
              <p className="text-sm text-muted-foreground">Team size, deadlines, and delivery health</p>
            </div>
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleProjects.slice(0, 4).map(project => (
              <div key={project.project.id} className="rounded-2xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{project.project.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.project.description}</p>
                  </div>
                  <Badge className={project.overdue > 0 ? 'bg-destructive/15 text-destructive' : project.project.status === 'completed' ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}>
                    {project.project.status === 'completed' ? 'Completed' : project.overdue > 0 ? 'At Risk' : project.project.status === 'on-hold' ? 'On Hold' : 'Active'}
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progress</span><span className="font-medium">{project.project.progress}%</span></div>
                  <Progress value={project.project.progress} className="h-2.5" />
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Deadline</span><span className={project.deadlineTone === 'danger' ? 'font-medium text-destructive' : project.deadlineTone === 'warning' ? 'font-medium text-primary' : 'font-medium'}>{project.deadlineText}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Team Members</span><span className="font-medium">{project.members.length}</span></div>
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 3).map(member => <Avatar key={`${project.project.id}-${member}`} className="h-8 w-8 border-2 border-background"><AvatarFallback className="text-[11px] font-semibold">{initials(member)}</AvatarFallback></Avatar>)}
                      {project.members.length > 3 && <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">+{project.members.length - 3}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground">{project.completed}/{project.tasks.length} tasks done</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Top Performing Team Members</h2>
              <p className="text-sm text-muted-foreground">Highest completed task counts</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {performers.length > 0 ? performers.map(member => (
              <div key={member.name} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11"><AvatarFallback className="font-semibold">{member.avatar}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">Completed {member.completed} tasks</p></div>
                      <Badge className="bg-accent/20 text-accent-foreground">{member.completed}</Badge>
                    </div>
                    <Progress value={member.rate} className="mt-3 h-2" />
                  </div>
                </div>
              </div>
            )) : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No completed task data is available yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Activity Timeline</h2>
              <p className="text-sm text-muted-foreground">Most recent work updates</p>
            </div>
            <Clock3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-4">
            {timeline.length > 0 ? timeline.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex gap-4 rounded-2xl border border-border bg-background p-4">
                  <div className={`rounded-full p-2 ${item.tone === 'success' ? 'bg-accent/20 text-accent-foreground' : item.tone === 'warning' ? 'bg-amber-500/15 text-amber-700' : item.tone === 'danger' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.detail}</p></div><span className="shrink-0 text-xs text-muted-foreground">{item.timeLabel}</span></div>
                  </div>
                </div>
              );
            }) : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No recent activity yet.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Focus Summary</h2>
              <p className="text-sm text-muted-foreground">Scope, visible workload, and productivity</p>
            </div>
            <Filter className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Scope</p><p className="mt-1 font-semibold">{scope === 'week' ? 'This Week' : scope === 'month' ? 'Month' : 'Project'}</p></div>
            <div className="rounded-2xl bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Visible Tasks</p><p className="mt-1 font-semibold">{scoped.current.length}</p></div>
            <div className="rounded-2xl bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Visible Projects</p><p className="mt-1 font-semibold">{visibleProjects.length}</p></div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">Productivity</p><p className="text-sm font-semibold">{productivity}%</p></div>
            <Progress value={productivity} className="mt-3 h-2.5" />
            <p className="mt-3 text-sm text-muted-foreground">A higher percentage means a larger share of the visible workload is already completed.</p>
          </div>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={open => setIsCreateOpen(open)}>
        <DialogContent className="sm:max-w-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a task, assign it to a project, and keep the team moving.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTaskSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Task Name</label><Input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Enter task title" /></div>
              <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Description</label><Textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Add a short task summary" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Project</label><select value={form.projectId} onChange={e => setForm(prev => ({ ...prev, projectId: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"><option value="" disabled>Select project</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Assignee</label><select value={form.assignedToId} onChange={e => setForm(prev => ({ ...prev, assignedToId: e.target.value }))} className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"><option value="">Unassigned</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Status</label><select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as Task['status'] }))} className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"><option value="todo">Pending</option><option value="in-progress">In Progress</option><option value="review">Review</option><option value="completed">Completed</option></select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Priority</label><select value={form.priority} onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))} className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Deadline</label><Input type="date" value={form.dueDate} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="h-9 rounded-md border border-border bg-background px-4 transition-colors hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving || projects.length === 0} className="h-9 rounded-md bg-primary px-4 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">{saving ? 'Creating...' : 'Create Task'}</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTaskDialogOpen} onOpenChange={open => setIsTaskDialogOpen(open)}>
        <DialogContent className="sm:max-w-3xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4">
          <DialogHeader>
            <DialogTitle>
              {taskDialogMode === 'view' ? 'Task Details' : taskDialogMode === 'edit' ? 'Edit Task' : 'Assign Task'}
            </DialogTitle>
            <DialogDescription>
              {taskDialogMode === 'view'
                ? 'Review task details, status, and assignment.'
                : taskDialogMode === 'edit'
                  ? 'Update the task information and progress.'
                  : 'Assign the task to a teammate.'}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/20">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={taskStatusClass(selectedTask.status)}>{taskStatusLabel(selectedTask.status)}</Badge>
                      <Badge className={priorityClass(selectedTask.priority)}>{selectedTask.priority}</Badge>
                      <Badge variant="outline">{selectedTask.projectName || 'General'}</Badge>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedTask.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {taskDialogMode === 'view'
                          ? 'Review the task details and use the actions below to make changes.'
                          : taskDialogMode === 'edit'
                            ? 'Update the task title, details, and ownership.'
                            : 'Choose a teammate and hand the task off.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-background/80 p-3 text-sm sm:min-w-72">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned To</p>
                      <p className="mt-1 font-medium">{selectedTask.assignee}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Deadline</p>
                      <p className={`mt-1 font-medium ${selectedTask.dueDate && parseDate(selectedTask.dueDate)?.getTime() < Date.now() && selectedTask.status !== 'completed' ? 'text-destructive' : ''}`}>
                        {selectedTask.dueDate ? FULL_DATE.format(new Date(selectedTask.dueDate)) : 'No deadline'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress Note</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedTask.statusUpdateNote || 'No update note yet.'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-1 font-medium">{taskStatusLabel(selectedTask.status)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {taskDialogMode === 'view' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoTile label="Assigned To" value={selectedTask.assignee} />
                  <InfoTile label="Priority" value={selectedTask.priority} pill={true} pillClassName={priorityClass(selectedTask.priority)} />
                  <InfoTile label="Deadline" value={selectedTask.dueDate ? FULL_DATE.format(new Date(selectedTask.dueDate)) : 'No deadline'} />
                  <InfoTile label="Project" value={selectedTask.projectName || 'General'} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_0.9fr]">
                  <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Task Name</label>
                      <Input
                        value={taskActionForm.title}
                        onChange={event => {
                          const value = event.target.value;
                          setTaskActionForm(prev => ({ ...prev, title: value }));
                          if (taskActionErrors.title && value.trim()) {
                            setTaskActionErrors(prev => ({ ...prev, title: undefined }));
                          }
                        }}
                        disabled={taskDialogMode === 'assign'}
                        aria-invalid={Boolean(taskActionErrors.title)}
                        className={taskActionErrors.title ? errorInputClass : normalInputClass}
                      />
                      {taskActionErrors.title && <p className="text-xs text-destructive">{taskActionErrors.title}</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={taskActionForm.description}
                        onChange={event => {
                          const value = event.target.value;
                          setTaskActionForm(prev => ({ ...prev, description: value }));
                          if (taskActionErrors.description && value.trim()) {
                            setTaskActionErrors(prev => ({ ...prev, description: undefined }));
                          }
                        }}
                        disabled={taskDialogMode === 'assign'}
                        aria-invalid={Boolean(taskActionErrors.description)}
                        className={taskActionErrors.description ? errorInputClass : normalInputClass}
                      />
                      {taskActionErrors.description && <p className="text-xs text-destructive">{taskActionErrors.description}</p>}
                    </div>

                    {taskDialogMode === 'edit' && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Project</label>
                          <select
                            value={taskActionForm.projectId}
                            onChange={event => {
                              const value = event.target.value;
                              setTaskActionForm(prev => ({ ...prev, projectId: value }));
                              if (taskActionErrors.projectId && value) {
                                setTaskActionErrors(prev => ({ ...prev, projectId: undefined }));
                              }
                            }}
                            className={`h-9 w-full rounded-md border bg-input-background px-3 text-sm ${taskActionErrors.projectId ? errorInputClass : 'border-input'}`}
                          >
                            <option value="">Select project</option>
                            {projects.map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                          {taskActionErrors.projectId && <p className="text-xs text-destructive">{taskActionErrors.projectId}</p>}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Assignee</label>
                          <select
                            value={taskActionForm.assignedToId}
                            onChange={event => {
                              const value = event.target.value;
                              setTaskActionForm(prev => ({ ...prev, assignedToId: value }));
                              if (taskActionErrors.assignedToId && value) {
                                setTaskActionErrors(prev => ({ ...prev, assignedToId: undefined }));
                              }
                            }}
                            className={`h-9 w-full rounded-md border bg-input-background px-3 text-sm ${taskActionErrors.assignedToId ? errorInputClass : 'border-input'}`}
                          >
                            <option value="">Unassigned</option>
                            {users.filter(user => user.role === 'member').map(user => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          {taskActionErrors.assignedToId && <p className="text-xs text-destructive">{taskActionErrors.assignedToId}</p>}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Status</label>
                          <select
                            value={taskActionForm.status}
                            onChange={event => setTaskActionForm(prev => ({ ...prev, status: event.target.value as Task['status'] }))}
                            className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                          >
                            <option value="todo">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Priority</label>
                          <select
                            value={taskActionForm.priority}
                            onChange={event => setTaskActionForm(prev => ({ ...prev, priority: event.target.value as Task['priority'] }))}
                            className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Deadline</label>
                          <Input
                            type="date"
                            value={taskActionForm.dueDate}
                            onChange={event => {
                              const value = event.target.value;
                              setTaskActionForm(prev => ({ ...prev, dueDate: value }));
                              if (taskActionErrors.dueDate && (!value || value >= toInputDate(new Date()))) {
                                setTaskActionErrors(prev => ({ ...prev, dueDate: undefined }));
                              }
                            }}
                            aria-invalid={Boolean(taskActionErrors.dueDate)}
                            className={taskActionErrors.dueDate ? errorInputClass : normalInputClass}
                          />
                          {taskActionErrors.dueDate && <p className="text-xs text-destructive">{taskActionErrors.dueDate}</p>}
                        </div>
                      </div>
                    )}

                    {taskDialogMode === 'assign' && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Search teammates</label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={assigneeQuery}
                              onChange={event => setAssigneeQuery(event.target.value)}
                              placeholder="Search by name or email"
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-background">
                          <div className="max-h-64 overflow-y-auto p-2">
                            {filteredAssignableUsers.length > 0 ? (
                              filteredAssignableUsers.map(user => {
                                const isSelected = taskActionForm.assignedToId === user.id;
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setTaskActionForm(prev => ({ ...prev, assignedToId: user.id }));
                                      if (taskActionErrors.assignedToId) {
                                        setTaskActionErrors(prev => ({ ...prev, assignedToId: undefined }));
                                      }
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                                      isSelected ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/60'
                                    }`}
                                  >
                                    <Avatar className="h-9 w-9">
                                      <AvatarFallback className="text-xs font-semibold">{initials(user.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">{user.name}</p>
                                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                No teammates match your search.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                          {taskActionForm.assignedToId ? (
                            <span>
                              Assigned to{' '}
                              <span className="font-medium">
                                {users.find(user => user.id === taskActionForm.assignedToId)?.name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Choose a teammate to assign this task.</span>
                          )}
                        </div>

                        {taskActionErrors.assignedToId && <p className="text-xs text-destructive">{taskActionErrors.assignedToId}</p>}
                      </div>
                    )}

                    {taskActionErrors.submit && <p className="text-sm text-destructive">{taskActionErrors.submit}</p>}
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="rounded-2xl bg-background p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick Status</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className={taskStatusClass(taskActionForm.status)}>{taskStatusLabel(taskActionForm.status)}</Badge>
                        <Badge className={priorityClass(taskActionForm.priority)}>{taskActionForm.priority}</Badge>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-background p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                      <div className="mt-3 space-y-2">
                        <p className="font-medium">{taskActionForm.title || 'Task title preview'}</p>
                        <p className="line-clamp-4 text-muted-foreground">{taskActionForm.description || 'Task description preview'}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-background p-4 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignment</p>
                      <p className="mt-2 font-medium">
                        {users.find(user => user.id === taskActionForm.assignedToId)?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <button
                  type="button"
                  onClick={closeTaskDialog}
                  className="h-9 rounded-md border border-border bg-background px-4 transition-colors hover:bg-muted"
                >
                  Close
                </button>
                {taskDialogMode === 'view' ? (
                  <>
                    <Button type="button" onClick={() => selectedTask && openTaskDialog(selectedTask, 'edit')}>
                      <LayoutGrid />
                      Edit
                    </Button>
                    <Button type="button" onClick={() => selectedTask && openTaskDialog(selectedTask, 'assign')}>
                      <UserPlus />
                      Assign
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    {taskDialogMode === 'edit' && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={openDeleteConfirmation}
                        disabled={taskActionSaving}
                      >
                        Delete
                      </Button>
                    )}
                    <Button type="button" disabled={taskActionSaving} onClick={saveTaskAction}>
                      {taskActionSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={open => setIsDeleteConfirmOpen(open)}>
        <DialogContent className="sm:max-w-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              This will permanently remove the task and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">
              {selectedTask?.title || 'Selected task'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Are you sure you want to delete this task?
            </p>
          </div>

          {taskActionErrors.submit && <p className="text-sm text-destructive">{taskActionErrors.submit}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={closeDeleteConfirmation}
              className="h-9 rounded-md border border-border bg-background px-4 transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteTask}
              disabled={isDeletingTask}
              className="h-9 rounded-md bg-destructive px-4 text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isDeletingTask ? 'Deleting...' : 'Delete Task'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, trend, trendUp, icon: Icon, color }: { title: string; value: string | number; trend: string; trendUp: boolean; icon: typeof Activity; color: 'accent' | 'primary' | 'destructive'; }) {
  const colorClasses = color === 'accent' ? 'bg-accent/20 text-accent-foreground' : color === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary';
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-3 ${colorClasses}`}><Icon className="h-5 w-5" /></div>
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-accent' : 'text-destructive'}`}>{trendUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{trend}</span>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="text-3xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Activity; children: ReactNode; }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

function InfoTile({
  label,
  value,
  pill = false,
  pillClassName = '',
}: {
  label: string;
  value: string;
  pill?: boolean;
  pillClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {pill ? (
        <Badge className={`mt-2 ${pillClassName}`}>{value}</Badge>
      ) : (
        <p className="mt-1 font-medium">{value}</p>
      )}
    </div>
  );
}
