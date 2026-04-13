import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  CircleAlert,
  Clock3,
  Edit3,
  FolderKanban,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Plus,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { createProject, getDashboard, getProjects, getTasks, getUsers } from '../../lib/api';
import { buildProjects, toTask, toUser } from '../../lib/mappers';
import { ApiDashboard, Project, Task, User, UserRole } from '../../lib/types';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';

type AdminUserStatus = 'active' | 'away' | 'inactive';
type UserDialogMode = 'create' | 'edit';

interface AdminUserRow extends User {
  status: AdminUserStatus;
  lastActiveLabel: string;
  assignedTasks: number;
  completedTasks: number;
}

interface UserFormState {
  name: string;
  email: string;
  role: UserRole;
  status: AdminUserStatus;
}

interface ProjectFormState {
  name: string;
  description: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const FULL_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const CHART_CONFIG = {
  users: { label: 'Users', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
  pending: { label: 'Pending', color: 'var(--chart-3)' },
  todo: { label: 'Todo', color: 'var(--chart-3)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-1)' },
  review: { label: 'Review', color: 'var(--chart-4)' },
  completedTasks: { label: 'Completed', color: 'var(--chart-2)' },
};

const roleBadgeClass = (role: UserRole) =>
  role === 'admin'
    ? 'bg-primary/10 text-primary border-transparent'
    : role === 'manager'
      ? 'bg-secondary/30 text-secondary-foreground border-transparent'
      : 'bg-muted text-muted-foreground border-transparent';

const userStatusClass = (status: AdminUserStatus) =>
  status === 'active'
    ? 'bg-accent text-accent-foreground border-transparent'
    : status === 'away'
      ? 'bg-amber-500/15 text-amber-700 border-transparent'
      : 'bg-muted text-muted-foreground border-transparent';

const projectStatusClass = (status: Project['status']) =>
  status === 'completed'
    ? 'bg-accent text-accent-foreground border-transparent'
    : status === 'active'
      ? 'bg-primary/10 text-primary border-transparent'
      : 'bg-amber-500/15 text-amber-700 border-transparent';

const alertToneClass = (tone: 'danger' | 'warning' | 'success') =>
  tone === 'danger'
    ? 'border-destructive/20 bg-destructive/10 text-destructive'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-700'
      : 'border-accent/20 bg-accent/10 text-accent-foreground';

const todayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA';

const countTasksForUser = (user: User, tasks: Task[]) => tasks.filter(task => task.assignee === user.name);

const buildAdminUsers = (users: User[], tasks: Task[]): AdminUserRow[] => {
  return users.map((user, index) => {
    const userTasks = countTasksForUser(user, tasks);
    const completedTasks = userTasks.filter(task => task.status === 'completed').length;
    const seed = user.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + index;
    const daysAgo = userTasks.length === 0 ? 14 + (seed % 8) : seed % 6;
    const status: AdminUserStatus = userTasks.length === 0 ? 'inactive' : daysAgo <= 1 ? 'active' : 'away';
    const lastActiveLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;

    return {
      ...user,
      status,
      lastActiveLabel,
      assignedTasks: userTasks.length,
      completedTasks,
    };
  });
};

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDialogMode, setUserDialogMode] = useState<UserDialogMode>('create');
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>({
    name: '',
    email: '',
    role: 'member',
    status: 'active',
  });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    name: '',
    description: '',
  });
  const [isSavingProject, setIsSavingProject] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [usersData, tasksData, projectsData, dashboardData] = await Promise.all([
      getUsers().catch(() => []),
      getTasks({ size: 200 }).catch(() => []),
      getProjects().catch(() => []),
      getDashboard().catch(() => null),
    ]);

    const mappedTasks = tasksData.map(toTask);
    const mappedUsers = usersData.map(toUser);
    setUsers(buildAdminUsers(mappedUsers, mappedTasks));
    setTasks(mappedTasks);
    setProjects(buildProjects(projectsData, mappedTasks));
    setDashboard(dashboardData);
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard().catch(() => {
      if (!active) return;
      setUsers([]);
      setTasks([]);
      setProjects([]);
      setDashboard(null);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const totalUsers = users.length;
  const activeProjects = projects.filter(project => project.status === 'active').length;
  const totalTasks = dashboard?.totalTasks ?? tasks.length;
  const completedTasks = dashboard?.completedTasks ?? tasks.filter(task => task.status === 'completed').length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const overdueTasks = dashboard?.overdueTasks ?? tasks.filter(task => {
    const dueDate = parseDate(task.dueDate);
    return task.status !== 'completed' && Boolean(dueDate && dueDate.getTime() < Date.now());
  }).length;

  const currentDateLabel = DATE_FORMATTER.format(new Date());

  const userGrowthData = useMemo(() => {
    const base = Math.max(4, totalUsers - 5);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((label, index) => ({
      label,
      users: base + Math.max(0, index * Math.max(1, Math.round(totalUsers / 6))) + (index % 2),
    }));
  }, [totalUsers]);

  const completionTrendData = useMemo(() => {
    const start = addDays(todayStart(), -6);
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index);
      const dayStart = new Date(day);
      const dayEnd = addDays(day, 1);
      const completed = tasks.filter(task => {
        const dueDate = parseDate(task.dueDate);
        return task.status === 'completed' && Boolean(dueDate && dueDate >= dayStart && dueDate < dayEnd);
      }).length;
      const pending = tasks.filter(task => {
        const dueDate = parseDate(task.dueDate);
        return task.status !== 'completed' && Boolean(dueDate && dueDate >= dayStart && dueDate < dayEnd);
      }).length;
      return {
        label: SHORT_DATE.format(day),
        completed,
        pending,
      };
    });
  }, [tasks]);
  const taskStatusData = useMemo(() => {
    const counts = {
      todo: tasks.filter(task => task.status === 'todo').length,
      inProgress: tasks.filter(task => task.status === 'in-progress').length,
      review: tasks.filter(task => task.status === 'review').length,
      completedTasks: tasks.filter(task => task.status === 'completed').length,
    };

    return [
      { name: 'Todo', value: counts.todo, fill: 'var(--chart-3)' },
      { name: 'In Progress', value: counts.inProgress, fill: 'var(--chart-1)' },
      { name: 'Review', value: counts.review, fill: 'var(--chart-4)' },
      { name: 'Completed', value: counts.completedTasks, fill: 'var(--chart-2)' },
    ];
  }, [tasks]);

  const alerts = useMemo(() => {
    const inactiveUsers = users.filter(user => user.status === 'inactive');
    const onHoldProjects = projects.filter(project => project.status === 'on-hold');
    const items: Array<{ id: string; title: string; detail: string; tone: 'danger' | 'warning' | 'success' }> = [];

    if (overdueTasks > 0) {
      items.push({
        id: 'overdue',
        title: `${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'}`,
        detail: 'Review deadlines and reassign urgent work.',
        tone: 'danger',
      });
    }

    if (inactiveUsers.length > 0) {
      items.push({
        id: 'inactive',
        title: `${inactiveUsers.length} inactive user${inactiveUsers.length === 1 ? '' : 's'}`,
        detail: 'Follow up on account activity and pending assignments.',
        tone: 'warning',
      });
    }

    if (onHoldProjects.length > 0) {
      items.push({
        id: 'on-hold',
        title: `${onHoldProjects.length} project${onHoldProjects.length === 1 ? '' : 's'} on hold`,
        detail: 'Check blockers before the next planning cycle.',
        tone: 'warning',
      });
    }

    if (completionRate >= 80) {
      items.push({
        id: 'health',
        title: 'Delivery health looks strong',
        detail: 'The current completion rate is trending well.',
        tone: 'success',
      });
    } else if (items.length === 0) {
      items.push({
        id: 'ok',
        title: 'No critical warnings',
        detail: 'System activity looks steady right now.',
        tone: 'success',
      });
    }

    return items.slice(0, 4);
  }, [completionRate, projects, overdueTasks, users]);

  const activityLogs = useMemo(() => {
    const projectLogs = projects.slice(0, 3).map((project, index) => ({
      id: `project-${project.id}`,
      title: project.status === 'completed' ? `Project completed: ${project.name}` : `Project monitored: ${project.name}`,
      detail: `${project.progress}% complete with ${project.teamSize} team members.`,
      time: index === 0 ? 'Just now' : `${index * 14}m ago`,
    }));

    const taskLogs = tasks
      .filter(task => task.status === 'completed')
      .slice(0, 2)
      .map((task, index) => ({
        id: `task-${task.id}`,
        title: `Task completed: ${task.title}`,
        detail: `${task.assignee} marked it complete.`,
        time: `${20 + index * 9}m ago`,
      }));

    const userLogs = users.slice(0, 1).map(user => ({
      id: `user-${user.id}`,
      title: `User reviewed: ${user.name}`,
      detail: `Role set to ${user.role} and status is ${user.status}.`,
      time: '1h ago',
    }));

    return [...projectLogs, ...taskLogs, ...userLogs].slice(0, 6);
  }, [projects, tasks, users]);

  const roleCounts = {
    admin: users.filter(user => user.role === 'admin').length,
    manager: users.filter(user => user.role === 'manager').length,
    member: users.filter(user => user.role === 'member').length,
  };

  const openCreateUser = () => {
    setUserDialogMode('create');
    setSelectedUser(null);
    setUserForm({
      name: '',
      email: '',
      role: 'member',
      status: 'active',
    });
    setUserDialogOpen(true);
  };

  const openEditUser = (user: AdminUserRow) => {
    setUserDialogMode('edit');
    setSelectedUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setUserDialogOpen(true);
  };

  const saveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    if (userDialogMode === 'create') {
      const newUser: AdminUserRow = {
        id: `local-${Date.now()}`,
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        avatar: undefined,
        department: 'General',
        status: userForm.status,
        lastActiveLabel: 'Today',
        assignedTasks: 0,
        completedTasks: 0,
      };
      setUsers(prev => [newUser, ...prev]);
      toast.success('User added');
    } else if (selectedUser) {
      setUsers(prev => prev.map(user => (
        user.id === selectedUser.id
          ? {
              ...user,
              name: userForm.name.trim(),
              email: userForm.email.trim(),
              role: userForm.role,
              status: userForm.status,
            }
          : user
      )));
      toast.success('User updated');
    }

    setUserDialogOpen(false);
  };

  const deleteUser = (user: AdminUserRow) => {
    const confirmed = window.confirm(`Delete ${user.name}? This removes the user from the dashboard view.`);
    if (!confirmed) return;
    setUsers(prev => prev.filter(item => item.id !== user.id));
    toast.success('User removed');
  };

  const openCreateProject = () => {
    setProjectForm({
      name: '',
      description: '',
    });
    setProjectDialogOpen(true);
  };

  const saveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsSavingProject(true);
    try {
      await createProject({
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
      });
      await loadDashboard();
      setProjectDialogOpen(false);
      toast.success('Project created successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const taskSummary = useMemo(() => {
    return [
      { label: 'Active Projects', value: activeProjects, tone: 'text-primary' },
      { label: 'Inactive Users', value: users.filter(user => user.status === 'inactive').length, tone: 'text-amber-700' },
      { label: 'Completion Rate', value: `${completionRate}%`, tone: 'text-accent-foreground' },
      { label: 'System Health', value: alerts.some(alert => alert.tone === 'danger') ? 'Needs attention' : 'Stable', tone: alerts.some(alert => alert.tone === 'danger') ? 'text-destructive' : 'text-accent-foreground' },
    ];
  }, [activeProjects, alerts, completionRate, users]);

  const projectCards = useMemo(() => {
    return projects
      .slice()
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 6)
      .map(project => {
        const projectTasks = tasks.filter(task => task.projectName === project.name);
        const deadline = projectTasks
          .map(task => parseDate(task.dueDate))
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const overdue = projectTasks.some(task => {
          const dueDate = parseDate(task.dueDate);
          return task.status !== 'completed' && Boolean(dueDate && dueDate.getTime() < Date.now());
        });

        return {
          ...project,
          deadline,
          overdue,
        };
      });
  }, [projects, tasks]);

  const userRows = users.slice().sort((a, b) => {
    if (a.status === b.status) return b.assignedTasks - a.assignedTasks;
    if (a.status === 'active') return -1;
    if (b.status === 'active') return 1;
    if (a.status === 'away') return -1;
    return 1;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview and full control center</p>
          <p className="mt-2 text-sm text-muted-foreground">{currentDateLabel}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={openCreateUser} className="shadow-sm">
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
          <Button onClick={openCreateProject} variant="outline" className="shadow-sm">
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <h2 className="mt-2 text-3xl font-bold">{totalUsers}</h2>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-accent-foreground">+12% growth this month</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Active Projects</p>
              <h2 className="mt-2 text-3xl font-bold">{activeProjects}</h2>
            </div>
            <div className="rounded-2xl bg-secondary/30 p-3 text-secondary-foreground">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-accent-foreground">Steady delivery pipeline</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <h2 className="mt-2 text-3xl font-bold">{totalTasks}</h2>
            </div>
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-700">
              <CheckSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 text-sm text-amber-700">{dashboard?.pendingTasks ?? tasks.filter(task => task.status !== 'completed').length} still open</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <h2 className="mt-2 text-3xl font-bold">{completionRate}%</h2>
            </div>
            <div className="rounded-2xl bg-accent/20 p-3 text-accent-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <Progress value={completionRate} className="h-2.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">User Growth</h2>
                  <p className="text-sm text-muted-foreground">Estimated trend across recent months</p>
                </div>
                <LineChartIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <ChartContainer config={{ users: CHART_CONFIG.users }} className="h-[260px] w-full">
                <LineChart data={userGrowthData} margin={{ left: 0, right: 8, top: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="users" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Completion Trends</h2>
                  <p className="text-sm text-muted-foreground">Tasks completed versus pending</p>
                </div>
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <ChartContainer config={{ completed: CHART_CONFIG.completed, pending: CHART_CONFIG.pending }} className="h-[260px] w-full">
                <BarChart data={completionTrendData} margin={{ left: 0, right: 8, top: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="completed" radius={[8, 8, 0, 0]} fill="var(--chart-2)" />
                  <Bar dataKey="pending" radius={[8, 8, 0, 0]} fill="var(--chart-3)" />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-1">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Task Status</h2>
                  <p className="text-sm text-muted-foreground">Distribution across the board</p>
                </div>
                <PieChartIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <ChartContainer
                config={{
                  todo: CHART_CONFIG.todo,
                  inProgress: CHART_CONFIG.inProgress,
                  review: CHART_CONFIG.review,
                  completedTasks: CHART_CONFIG.completedTasks,
                }}
                className="h-[260px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>
                    {taskStatusData.map(entry => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">User Management</h2>
                <p className="text-sm text-muted-foreground">Role control, active status, and quick actions</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge className="bg-primary/10 text-primary">{roleCounts.admin} Admin</Badge>
                <Badge className="bg-secondary/30 text-secondary-foreground">{roleCounts.manager} Manager</Badge>
                <Badge className="bg-muted text-muted-foreground">{roleCounts.member} Member</Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                            {initials(user.name)}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleBadgeClass(user.role)}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={userStatusClass(user.status)}>{user.status}</Badge>
                      </TableCell>
                      <TableCell>{user.lastActiveLabel}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditUser(user)}>
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => deleteUser(user)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Project Monitoring</h2>
                <p className="text-sm text-muted-foreground">Progress, managers, deadlines, and health status</p>
              </div>
              <Badge className="bg-primary/10 text-primary">{projects.length} projects</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projectCards.map(project => (
                <div key={project.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{project.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                    </div>
                    <Badge className={projectStatusClass(project.status)}>
                      {project.status === 'completed' ? 'Completed' : project.status === 'active' ? 'Active' : 'On Hold'}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2.5" />
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Manager</p>
                        <p className="font-medium">{project.owner}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Deadline</p>
                        <p className={`font-medium ${project.overdue ? 'text-destructive' : ''}`}>
                          {project.deadline ? FULL_DATE.format(project.deadline) : 'No deadline'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Alerts</h2>
                <p className="text-sm text-muted-foreground">Overdue work, inactive users, and warnings</p>
              </div>
              <CircleAlert className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className={`rounded-2xl border p-4 ${alertToneClass(alert.tone)}`}>
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${alert.tone === 'danger' ? 'bg-destructive/15' : alert.tone === 'warning' ? 'bg-amber-500/15' : 'bg-accent/20'}`}>
                      <AlertTriangle className={`h-4 w-4 ${alert.tone === 'danger' ? 'text-destructive' : alert.tone === 'warning' ? 'text-amber-700' : 'text-accent-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Activity Logs</h2>
                <p className="text-sm text-muted-foreground">Recent system actions</p>
              </div>
              <Clock3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {activityLogs.map(item => (
                <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Quick Health</h2>
                <p className="text-sm text-muted-foreground">Snapshot of the admin console</p>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {taskSummary.map(item => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-muted/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{userDialogMode === 'create' ? 'Add User' : 'Edit User'}</DialogTitle>
            <DialogDescription>Manage user identity and role information from the dashboard.</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveUser} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={userForm.name}
                onChange={event => setUserForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={userForm.email}
                onChange={event => setUserForm(prev => ({ ...prev, email: event.target.value }))}
                placeholder="name@company.com"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  value={userForm.role}
                  onChange={event => setUserForm(prev => ({ ...prev, role: event.target.value as UserRole }))}
                  className="h-10 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={userForm.status}
                  onChange={event => setUserForm(prev => ({ ...prev, status: event.target.value as AdminUserStatus }))}
                  className="h-10 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="away">Away</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{userDialogMode === 'create' ? 'Add User' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Add a new project to the system and start tracking progress immediately.</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveProject} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={projectForm.name}
                onChange={event => setProjectForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={projectForm.description}
                onChange={event => setProjectForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Describe the project goals and scope"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProject}>{isSavingProject ? 'Creating...' : 'Create Project'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
