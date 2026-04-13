import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  FolderKanban,
  Grid2X2,
  LayoutGrid,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Plus,
  Search,
  Table2,
  Trash2,
  Users,
} from 'lucide-react';
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
import { createProject, deleteProject, getProjects, getTasks, updateProject } from '../../lib/api';
import { buildProjects, toTask } from '../../lib/mappers';
import { Project, Task } from '../../lib/types';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

type ViewMode = 'card' | 'table';
type ProjectStatusFilter = 'all' | 'active' | 'completed' | 'delayed';
type SortMode = 'updated-desc' | 'progress-desc' | 'progress-asc' | 'deadline-asc' | 'name-asc';
type ProjectDialogMode = 'create' | 'edit' | 'view';

type ProjectFormState = {
  name: string;
  description: string;
};

type ProjectTone = 'green' | 'yellow' | 'red';

interface ProjectInsight {
  project: Project;
  tasks: Task[];
  completedTasks: number;
  totalTasks: number;
  deadline: Date | null;
  deadlineText: string;
  members: string[];
  manager: string;
  derivedStatus: 'on-track' | 'at-risk' | 'delayed' | 'completed';
  tone: ProjectTone;
  lowProgress: boolean;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const TODAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const CHART_CONFIG = {
  completed: { label: 'Completed', color: 'var(--chart-2)' },
  active: { label: 'Active', color: 'var(--chart-1)' },
  delayed: { label: 'Delayed', color: 'var(--chart-5)' },
  atRisk: { label: 'At Risk', color: 'var(--chart-4)' },
};

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

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'NA';

const projectBadgeClass = (status: ProjectInsight['derivedStatus']) => {
  if (status === 'completed') return 'bg-accent text-accent-foreground border-transparent';
  if (status === 'delayed') return 'bg-destructive/15 text-destructive border-transparent';
  if (status === 'at-risk') return 'bg-amber-500/15 text-amber-700 border-transparent';
  return 'bg-accent/20 text-accent-foreground border-transparent';
};

const toneClass = (tone: ProjectTone) => {
  if (tone === 'red') return 'border-destructive/20 bg-destructive/10';
  if (tone === 'yellow') return 'border-amber-500/20 bg-amber-500/10';
  return 'border-accent/20 bg-accent/10';
};

const progressToneClass = (tone: ProjectTone) => {
  if (tone === 'red') return 'bg-destructive';
  if (tone === 'yellow') return 'bg-amber-500';
  return 'bg-accent';
};

const sortDate = (a: Date | null, b: Date | null) => (a?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b?.getTime() ?? Number.MAX_SAFE_INTEGER);

const getDeadlineText = (date: Date | null) => date ? DATE_FORMATTER.format(date) : 'No deadline';

const getProgressTone = (project: ProjectInsight): ProjectTone => {
  if (project.derivedStatus === 'delayed') return 'red';
  if (project.derivedStatus === 'at-risk') return 'yellow';
  return 'green';
};

export function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ProjectDialogMode>('create');
  const [selectedProject, setSelectedProject] = useState<ProjectInsight | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    name: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    const [projectData, taskData] = await Promise.all([
      getProjects().catch(() => []),
      getTasks({ size: 200 }).catch(() => []),
    ]);
    const mappedTasks = taskData.map(toTask);
    setTasks(mappedTasks);
    setProjects(buildProjects(projectData, mappedTasks));
  }, []);

  useEffect(() => {
    let active = true;
    loadData().catch(() => {
      if (!active) return;
      setProjects([]);
      setTasks([]);
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const projectInsights = useMemo<ProjectInsight[]>(() => {
    const now = Date.now();
    return projects.map(project => {
      const projectTasks = tasks.filter(task => task.projectName === project.name);
      const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
      const totalTasks = projectTasks.length;
      const taskDates = projectTasks.map(task => parseDate(task.dueDate)).filter((date): date is Date => Boolean(date));
      const deadline = taskDates.length ? new Date(Math.max(...taskDates.map(date => date.getTime()))) : null;
      const members = Array.from(new Set(projectTasks.map(task => task.assignee).filter(name => name && name !== 'Unassigned')));
      const manager = project.owner || members[0] || 'Unassigned';
      const overdueTasks = projectTasks.filter(task => {
        const dueDate = parseDate(task.dueDate);
        return task.status !== 'completed' && Boolean(dueDate && dueDate.getTime() < now);
      }).length;
      const progress = project.progress;
      const delayed = project.status !== 'completed' && (overdueTasks > 0 || (deadline ? deadline.getTime() < now : false));
      const lowProgress = project.status !== 'completed' && progress < 45;
      const derivedStatus: ProjectInsight['derivedStatus'] = project.status === 'completed'
        ? 'completed'
        : delayed
          ? 'delayed'
          : lowProgress
            ? 'at-risk'
            : 'on-track';
      const tone = getProgressTone({
        project,
        tasks: projectTasks,
        completedTasks,
        totalTasks,
        deadline,
        deadlineText: '',
        members,
        manager,
        derivedStatus,
        tone: 'green',
        lowProgress,
      });

      return {
        project,
        tasks: projectTasks,
        completedTasks,
        totalTasks,
        deadline,
        deadlineText: getDeadlineText(deadline),
        members,
        manager,
        derivedStatus,
        tone,
        lowProgress,
      };
    });
  }, [projects, tasks]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let items = projectInsights.filter(project => {
      const matchesQuery = !query || [project.project.name, project.project.description, project.manager, project.members.join(' ')].join(' ').toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'all'
          || (statusFilter === 'active' && project.project.status === 'active')
          || (statusFilter === 'completed' && project.project.status === 'completed')
          || (statusFilter === 'delayed' && project.derivedStatus === 'delayed');
      return matchesQuery && matchesStatus;
    });

    items = items.slice().sort((a, b) => {
      switch (sortMode) {
        case 'progress-desc':
          return b.project.progress - a.project.progress;
        case 'progress-asc':
          return a.project.progress - b.project.progress;
        case 'deadline-asc':
          return sortDate(a.deadline, b.deadline);
        case 'name-asc':
          return a.project.name.localeCompare(b.project.name);
        case 'updated-desc':
        default:
          return Number(b.project.id) - Number(a.project.id);
      }
    });

    return items;
  }, [projectInsights, searchQuery, sortMode, statusFilter]);

  const stats = useMemo(() => {
    const total = projectInsights.length;
    const active = projectInsights.filter(project => project.project.status === 'active').length;
    const completed = projectInsights.filter(project => project.project.status === 'completed').length;
    const delayed = projectInsights.filter(project => project.derivedStatus === 'delayed').length;
    return { total, active, completed, delayed };
  }, [projectInsights]);

  const statusPieData = useMemo(() => ([
    { name: 'On Track', value: projectInsights.filter(project => project.derivedStatus === 'on-track').length, fill: 'var(--chart-2)' },
    { name: 'At Risk', value: projectInsights.filter(project => project.derivedStatus === 'at-risk').length, fill: 'var(--chart-4)' },
    { name: 'Delayed', value: projectInsights.filter(project => project.derivedStatus === 'delayed').length, fill: 'var(--chart-5)' },
  ]), [projectInsights]);

  const progressBarData = useMemo(() => filteredProjects.slice(0, 6).map(project => ({
    name: project.project.name.length > 16 ? `${project.project.name.slice(0, 16)}...` : project.project.name,
    progress: project.project.progress,
  })), [filteredProjects]);
  const openCreateProject = () => {
    setDialogMode('create');
    setSelectedProject(null);
    setProjectForm({ name: '', description: '' });
    setIsCreateOpen(true);
  };

  const openViewProject = (project: ProjectInsight) => {
    setDialogMode('view');
    setSelectedProject(project);
    setProjectForm({ name: project.project.name, description: project.project.description });
    setIsCreateOpen(true);
  };

  const openEditProject = (project: ProjectInsight) => {
    setDialogMode('edit');
    setSelectedProject(project);
    setProjectForm({ name: project.project.name, description: project.project.description });
    setIsCreateOpen(true);
  };

  const openManageMembers = (project: ProjectInsight) => {
    toast.info(`Open User Management to adjust members for ${project.project.name}`);
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setSelectedProject(null);
    setProjectForm({ name: '', description: '' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dialogMode === 'view') {
      closeDialog();
      return;
    }

    if (!projectForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsSaving(true);
    try {
      if (dialogMode === 'create') {
        await createProject({
          name: projectForm.name.trim(),
          description: projectForm.description.trim(),
        });
        toast.success('Project created successfully');
      } else if (selectedProject) {
        await updateProject(selectedProject.project.id, {
          name: projectForm.name.trim(),
          description: projectForm.description.trim(),
        });
        toast.success('Project updated successfully');
      }
      await loadData();
      closeDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (project: ProjectInsight) => {
    const confirmed = window.confirm(`Delete ${project.project.name}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteProject(project.project.id);
      await loadData();
      toast.success('Project deleted successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const delayedProjects = filteredProjects.filter(project => project.derivedStatus === 'delayed' || project.lowProgress);
  const todayLabel = TODAY_FORMATTER.format(new Date());
  const statusLabel = (project: ProjectInsight) => {
    if (project.derivedStatus === 'completed') return 'Completed';
    if (project.derivedStatus === 'delayed') return 'Delayed';
    if (project.derivedStatus === 'at-risk') return 'At Risk';
    return 'On Track';
  };

  const actionButtons = (project: ProjectInsight) => (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => openViewProject(project)}>
        <Eye className="h-4 w-4" />
        View Details
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => openEditProject(project)}>
        <Edit3 className="h-4 w-4" />
        Edit
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => openManageMembers(project)}>
        <Users className="h-4 w-4" />
        Manage Members
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(project)}>
        <Trash2 className="h-4 w-4" />
        Delete
      </Button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Project Management</h1>
          <p className="text-muted-foreground">Admin-level project control and oversight</p>
          <p className="mt-2 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <Button onClick={openCreateProject} className="shadow-sm">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <h2 className="mt-2 text-3xl font-bold">{stats.total}</h2>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Active Projects</p>
              <h2 className="mt-2 text-3xl font-bold">{stats.active}</h2>
            </div>
            <div className="rounded-2xl bg-accent/20 p-3 text-accent-foreground">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Completed Projects</p>
              <h2 className="mt-2 text-3xl font-bold">{stats.completed}</h2>
            </div>
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-700">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Delayed Projects</p>
              <h2 className="mt-2 text-3xl font-bold">{stats.delayed}</h2>
            </div>
            <div className="rounded-2xl bg-destructive/15 p-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Controls</h2>
            <p className="text-sm text-muted-foreground">Search, filter, sort, and switch between layouts</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search projects, managers, members..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as ProjectStatusFilter)}>
              <SelectTrigger className="w-full lg:w-44">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={value => setSortMode(value as SortMode)}>
              <SelectTrigger className="w-full lg:w-52">
                <ArrowDownUp className="h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">Latest Updated</SelectItem>
                <SelectItem value="progress-desc">Progress: High to Low</SelectItem>
                <SelectItem value="progress-asc">Progress: Low to High</SelectItem>
                <SelectItem value="deadline-asc">Deadline: Soonest</SelectItem>
                <SelectItem value="name-asc">Name: A-Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`inline-flex h-9 items-center gap-2 px-3 text-sm transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                <Grid2X2 className="h-4 w-4" />
                Card
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex h-9 items-center gap-2 px-3 text-sm transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                <Table2 className="h-4 w-4" />
                Table
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Project Status</h2>
              <p className="text-sm text-muted-foreground">Distribution of on-track, at-risk, and delayed projects</p>
            </div>
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <ChartContainer
            config={{
              completed: CHART_CONFIG.completed,
              atRisk: CHART_CONFIG.atRisk,
              delayed: CHART_CONFIG.delayed,
            }}
            className="h-[260px] w-full"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={102} paddingAngle={3}>
                {statusPieData.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Progress Overview</h2>
              <p className="text-sm text-muted-foreground">Top projects by completion percentage</p>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <ChartContainer config={{ completed: CHART_CONFIG.completed }} className="h-[260px] w-full">
            <BarChart data={progressBarData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="progress" radius={[0, 10, 10, 0]} fill="var(--chart-2)" barSize={18} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Project List</h2>
              <p className="text-sm text-muted-foreground">Card and table views for admin project control</p>
            </div>
            <Badge className="bg-primary/10 text-primary">{filteredProjects.length} results</Badge>
          </div>

          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredProjects.map(project => (
                <div key={project.project.id} className="group rounded-2xl border border-border bg-background p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold group-hover:text-primary">{project.project.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.project.description}</p>
                    </div>
                    <Badge className={projectBadgeClass(project.derivedStatus)}>{statusLabel(project)}</Badge>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{project.project.progress}%</span>
                      </div>
                      <Progress value={project.project.progress} className="h-2.5" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Tasks</p>
                        <p className="font-medium">{project.completedTasks}/{project.totalTasks || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Deadline</p>
                        <p className={`font-medium ${project.derivedStatus === 'delayed' ? 'text-destructive' : ''}`}>{project.deadlineText}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Manager</p>
                        <p className="font-medium">{project.manager}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Team</p>
                        <p className="font-medium">{project.members.length} members</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm text-muted-foreground">Team Members</p>
                      <div className="flex flex-wrap gap-2">
                        {project.members.slice(0, 4).map(member => (
                          <Avatar key={`${project.project.id}-${member}`} className="h-8 w-8 border-2 border-background">
                            <AvatarFallback className="text-[11px] font-semibold">{initials(member)}</AvatarFallback>
                          </Avatar>
                        ))}
                        {project.members.length > 4 && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                            +{project.members.length - 4}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="opacity-100 transition-all lg:opacity-0 lg:group-hover:opacity-100">
                      {actionButtons(project)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map(project => (
                    <TableRow key={project.project.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.project.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{project.project.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>{project.manager}</TableCell>
                      <TableCell>
                        <span className={project.derivedStatus === 'delayed' ? 'font-medium text-destructive' : ''}>{project.deadlineText}</span>
                      </TableCell>
                      <TableCell className="min-w-40">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{project.project.progress}%</span>
                            <span>{project.completedTasks}/{project.totalTasks || 0}</span>
                          </div>
                          <Progress value={project.project.progress} className="h-2.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={projectBadgeClass(project.derivedStatus)}>{statusLabel(project)}</Badge>
                      </TableCell>
                      <TableCell>{project.members.length}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openViewProject(project)}>
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditProject(project)}>
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openManageMembers(project)}>
                            <Users className="h-4 w-4" />
                            Members
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredProjects.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">No projects match your current filters.</div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Risk Section</h2>
                <p className="text-sm text-muted-foreground">Delayed or low-progress projects</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {delayedProjects.length > 0 ? delayedProjects.slice(0, 4).map(project => (
                <div key={project.project.id} className={`rounded-2xl border p-4 ${toneClass(project.tone)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{project.project.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{project.deadlineText}</p>
                    </div>
                    <Badge className={projectBadgeClass(project.derivedStatus)}>{statusLabel(project)}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{project.project.progress}%</span>
                    </div>
                    <Progress value={project.project.progress} className="h-2.5" />
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  No delayed projects right now.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Quick Summary</h2>
                <p className="text-sm text-muted-foreground">Fast read on the board health</p>
              </div>
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-muted/20 px-4 py-3">
                <span className="text-sm text-muted-foreground">On Track</span>
                <span className="font-semibold text-accent-foreground">{projectInsights.filter(project => project.derivedStatus === 'on-track').length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/20 px-4 py-3">
                <span className="text-sm text-muted-foreground">At Risk</span>
                <span className="font-semibold text-amber-700">{projectInsights.filter(project => project.derivedStatus === 'at-risk').length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/20 px-4 py-3">
                <span className="text-sm text-muted-foreground">Delayed</span>
                <span className="font-semibold text-destructive">{stats.delayed}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={open => (open ? setIsCreateOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'New Project' : dialogMode === 'edit' ? 'Edit Project' : 'Project Details'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Create a new project and start tracking work immediately.'
                : dialogMode === 'edit'
                  ? 'Update the project name and description.'
                  : 'Review project progress, deadlines, and team members.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={projectForm.name}
                onChange={event => setProjectForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Enter project name"
                disabled={dialogMode === 'view'}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={projectForm.description}
                onChange={event => setProjectForm(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Describe the project goals and scope"
                disabled={dialogMode === 'view'}
              />
            </div>

            {selectedProject && (
              <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="font-medium">{selectedProject.manager}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p className="font-medium">{selectedProject.deadlineText}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="font-medium">{selectedProject.completedTasks}/{selectedProject.totalTasks || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Team Members</p>
                  <p className="font-medium">{selectedProject.members.length}</p>
                </div>
              </div>
            )}

            {selectedProject && dialogMode === 'view' && (
              <div>
                <p className="mb-2 text-sm font-medium">Team Members</p>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.members.length > 0 ? selectedProject.members.map(member => (
                    <div key={`${selectedProject.project.id}-${member}`} className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] font-semibold">{initials(member)}</AvatarFallback>
                      </Avatar>
                      <span>{member}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No members assigned yet.</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Close
              </Button>
              {dialogMode !== 'view' && (
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : dialogMode === 'create' ? 'Create Project' : 'Save Changes'}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
