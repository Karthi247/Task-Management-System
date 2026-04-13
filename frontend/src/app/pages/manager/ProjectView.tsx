import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit,
  FolderKanban,
  Grid3X3,
  Plus,
  Search,
  Table2,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { createProject, deleteProject, getProjects, getTasks, updateProject } from '../../lib/api';
import { buildProjects, toTask } from '../../lib/mappers';
import { Project, Task } from '../../lib/types';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type ViewMode = 'grid' | 'table';
type HeaderStatusFilter = 'all' | 'active' | 'completed' | 'on-hold';
type StatusFilter = HeaderStatusFilter | 'delayed';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high';
type TeamSizeFilter = 'all' | 'small' | 'medium' | 'large';
type ProjectDialogMode = 'create' | 'edit' | 'view' | 'assign';

interface ProjectFormState {
  name: string;
  description: string;
}

interface ProjectInsight {
  project: Project;
  tasks: Task[];
  completedTasks: number;
  overdueTasks: number;
  deadline: Date | null;
  deadlineText: string;
  deadlineTone: 'default' | 'warning' | 'danger';
  members: string[];
  priority: Task['priority'];
  derivedStatus: StatusFilter;
}

const DEADLINE_WARNING_DAYS = 3;
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function getDeadlineText(date: Date | null) {
  return date ? DATE_FORMATTER.format(date) : 'No deadline set';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA';
}

function getPriority(tasks: Task[]): Task['priority'] {
  const activeTasks = tasks.filter(task => task.status !== 'completed');
  if (activeTasks.some(task => task.priority === 'high')) return 'high';
  if (activeTasks.some(task => task.priority === 'medium')) return 'medium';
  return 'low';
}

function getTeamSizeBucket(teamSize: number): TeamSizeFilter {
  if (teamSize >= 8) return 'large';
  if (teamSize >= 4) return 'medium';
  return 'small';
}

export function ProjectView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [headerStatusFilter, setHeaderStatusFilter] = useState<HeaderStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [teamSizeFilter, setTeamSizeFilter] = useState<TeamSizeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedProject, setSelectedProject] = useState<ProjectInsight | null>(null);
  const [projectDialogMode, setProjectDialogMode] = useState<ProjectDialogMode>('create');
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [projectForm, setProjectForm] = useState<ProjectFormState>({
    name: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    const [projectsData, tasksData] = await Promise.all([
      getProjects().catch(() => []),
      getTasks({ size: 300 }).catch(() => []),
    ]);

    const mappedTasks = tasksData.map(toTask);
    setTasks(mappedTasks);
    setProjects(buildProjects(projectsData, mappedTasks));
  }, []);

  useEffect(() => {
    let active = true;
    loadData().then(() => {
      if (!active) return;
    }).catch(() => {
      if (!active) return;
      setTasks([]);
      setProjects([]);
    });

    return () => {
      active = false;
    };
  }, [loadData]);

  const projectInsights = useMemo<ProjectInsight[]>(() => {
    const now = new Date();

    return projects.map(project => {
      const projectTasks = tasks.filter(task => task.projectName === project.name);
      const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
      const dueDates = projectTasks
        .map(task => (task.dueDate ? new Date(task.dueDate) : null))
        .filter((date): date is Date => Boolean(date) && !Number.isNaN(date.getTime()));
      const deadline = dueDates.length > 0
        ? new Date(Math.max(...dueDates.map(date => date.getTime())))
        : null;
      const overdueTasks = projectTasks.filter(task => {
        if (task.status === 'completed') return false;
        const dueDate = new Date(task.dueDate);
        return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime();
      }).length;
      const members = Array.from(
        new Set(
          projectTasks
            .map(task => task.assignee)
            .filter(assignee => Boolean(assignee) && assignee !== 'Unassigned'),
        ),
      );

      let derivedStatus: StatusFilter = project.status;
      if (project.status !== 'completed' && overdueTasks > 0) {
        derivedStatus = 'delayed';
      }

      let deadlineTone: ProjectInsight['deadlineTone'] = 'default';
      if (deadline) {
        const dayDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff < 0 && derivedStatus !== 'completed') {
          deadlineTone = 'danger';
        } else if (dayDiff <= DEADLINE_WARNING_DAYS && derivedStatus !== 'completed') {
          deadlineTone = 'warning';
        }
      }

      return {
        project,
        tasks: projectTasks,
        completedTasks,
        overdueTasks,
        deadline,
        deadlineText: getDeadlineText(deadline),
        deadlineTone,
        members,
        priority: getPriority(projectTasks),
        derivedStatus,
      };
    });
  }, [projects, tasks]);

  const summary = useMemo(() => {
    const total = projectInsights.length;
    const active = projectInsights.filter(item => item.derivedStatus === 'active').length;
    const completed = projectInsights.filter(item => item.derivedStatus === 'completed').length;
    const delayed = projectInsights.filter(item => item.derivedStatus === 'delayed').length;

    return { total, active, completed, delayed };
  }, [projectInsights]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projectInsights.filter(item => {
      const matchesSearch =
        query.length === 0 ||
        item.project.name.toLowerCase().includes(query) ||
        item.project.description.toLowerCase().includes(query);
      const matchesHeaderStatus =
        headerStatusFilter === 'all' || item.derivedStatus === headerStatusFilter;
      const matchesStatus = statusFilter === 'all' || item.derivedStatus === statusFilter;
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesTeamSize =
        teamSizeFilter === 'all' || getTeamSizeBucket(item.project.teamSize) === teamSizeFilter;

      return (
        matchesSearch &&
        matchesHeaderStatus &&
        matchesStatus &&
        matchesPriority &&
        matchesTeamSize
      );
    });
  }, [
    headerStatusFilter,
    priorityFilter,
    projectInsights,
    searchQuery,
    statusFilter,
    teamSizeFilter,
  ]);

  const statusBadgeClass: Record<StatusFilter, string> = {
    all: 'bg-muted text-muted-foreground border-transparent',
    active: 'bg-primary/15 text-primary border-transparent',
    completed: 'bg-accent text-accent-foreground border-transparent',
    delayed: 'bg-destructive/15 text-destructive border-transparent',
    'on-hold': 'bg-muted text-muted-foreground border-transparent',
  };

  const priorityBadgeClass: Record<Task['priority'], string> = {
    low: 'bg-muted text-muted-foreground border-transparent',
    medium: 'bg-primary/10 text-primary border-transparent',
    high: 'bg-destructive/15 text-destructive border-transparent',
  };

  const closeProjectDialog = () => {
    setIsProjectDialogOpen(false);
    setSelectedProject(null);
    setProjectError('');
    setIsSavingProject(false);
  };

  const openCreateProjectDialog = () => {
    setProjectDialogMode('create');
    setSelectedProject(null);
    setProjectForm({ name: '', description: '' });
    setProjectError('');
    setIsProjectDialogOpen(true);
  };

  const openEditProjectDialog = (project: ProjectInsight) => {
    setProjectDialogMode('edit');
    setSelectedProject(project);
    setProjectForm({
      name: project.project.name,
      description: project.project.description,
    });
    setProjectError('');
    setIsProjectDialogOpen(true);
  };

  const openViewProjectDialog = (project: ProjectInsight) => {
    setProjectDialogMode('view');
    setSelectedProject(project);
    setProjectForm({
      name: project.project.name,
      description: project.project.description,
    });
    setProjectError('');
    setIsProjectDialogOpen(true);
  };

  const openAssignProject = (project: ProjectInsight) => {
    navigate('/manager/tasks');
    toast.info(`Use Task Management to assign work for ${project.project.name}`);
  };

  const handleProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (projectDialogMode === 'view' || projectDialogMode === 'assign') {
      return;
    }

    if (!projectForm.name.trim()) {
      setProjectError('Project name is required');
      return;
    }

    setIsSavingProject(true);
    setProjectError('');

    try {
      if (projectDialogMode === 'create') {
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
      closeProjectDialog();
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Failed to save project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (project: ProjectInsight) => {
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

  const dialogTitle =
    projectDialogMode === 'create'
      ? 'Create New Project'
      : projectDialogMode === 'edit'
        ? 'Edit Project'
        : projectDialogMode === 'assign'
          ? 'Assign Project Work'
          : 'Project Details';

  const dialogDescription =
    projectDialogMode === 'create'
      ? 'Add a project and start tracking work from the manager dashboard.'
      : projectDialogMode === 'edit'
        ? 'Update the project name or description.'
        : projectDialogMode === 'assign'
          ? 'Assign related tasks from the task management page.'
          : 'Review project progress, team size, and task breakdown.';

  const isEditable = projectDialogMode === 'create' || projectDialogMode === 'edit';

  const selectedProjectTaskList = selectedProject?.tasks ?? [];

  const projectActionButtons = (
    project: ProjectInsight,
    layout: 'grid' | 'table',
  ) => (
    <div className={layout === 'grid' ? 'mt-5 grid grid-cols-2 gap-2' : 'flex items-center gap-1'}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={layout === 'table' ? 'h-8' : undefined}
        onClick={() => openViewProjectDialog(project)}
      >
        <ClipboardList />
        View
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={layout === 'table' ? 'h-8' : undefined}
        onClick={() => openEditProjectDialog(project)}
      >
        <Edit />
        Edit
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={layout === 'table' ? 'h-8' : undefined}
        onClick={() => openAssignProject(project)}
      >
        <UserPlus />
        Assign
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={layout === 'table' ? 'h-8' : undefined}
        onClick={() => handleDeleteProject(project)}
      >
        <Trash2 />
        Delete
      </Button>
    </div>
  );

  const renderProjectDialogContent = () => {
    if (!selectedProject && !isEditable) {
      return null;
    }

    if (isEditable) {
      return (
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              value={projectForm.name}
              onChange={event => setProjectForm(prev => ({ ...prev, name: event.target.value }))}
              placeholder="Enter project name"
              aria-invalid={Boolean(projectError)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={projectForm.description}
              onChange={event => setProjectForm(prev => ({ ...prev, description: event.target.value }))}
              placeholder="Add a short project summary"
            />
          </div>

          {projectError && <p className="text-sm text-destructive">{projectError}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={closeProjectDialog}
              className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingProject}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isSavingProject
                ? projectDialogMode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : projectDialogMode === 'create'
                  ? 'Create Project'
                  : 'Save Changes'}
            </button>
          </DialogFooter>
        </form>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{selectedProject?.project.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedProject?.project.description}</p>
            </div>
            <Badge className={statusBadgeClass[selectedProject?.derivedStatus ?? 'all']}>
              {selectedProject?.derivedStatus === 'on-hold'
                ? 'On Hold'
                : selectedProject?.derivedStatus === 'delayed'
                  ? 'Delayed'
                  : selectedProject?.derivedStatus?.charAt(0).toUpperCase() +
                    selectedProject?.derivedStatus?.slice(1)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Team Size</p>
              <p className="font-medium">{selectedProject?.project.teamSize}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Progress</p>
              <p className="font-medium">{selectedProject?.project.progress}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tasks</p>
              <p className="font-medium">
                {selectedProject?.completedTasks}/{selectedProject?.tasks.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Overdue</p>
              <p className="font-medium">{selectedProject?.overdueTasks}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Members</p>
            <div className="flex flex-wrap gap-2">
              {selectedProject?.members.length ? (
                selectedProject.members.map(member => (
                  <span
                    key={`${selectedProject.project.id}-${member}`}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                  >
                    {member}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No members assigned yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Tasks in this project</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {selectedProjectTaskList.length > 0 ? (
              selectedProjectTaskList.map(task => (
                <div key={task.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{task.title}</p>
                    <Badge variant="outline">{task.status.replace('-', ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No tasks have been linked to this project yet.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={closeProjectDialog}
            className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            Close
          </button>
          {projectDialogMode === 'view' && (
            <Button
              type="button"
              onClick={() => selectedProject && openEditProjectDialog(selectedProject)}
            >
              <Edit />
              Edit Project
            </Button>
          )}
          {projectDialogMode === 'assign' && (
            <Button
              type="button"
              onClick={() => {
                closeProjectDialog();
                navigate('/manager/tasks');
              }}
            >
              Go to Task Management
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage and monitor all projects</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={headerStatusFilter}
            onValueChange={value => setHeaderStatusFilter(value as HeaderStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" onClick={openCreateProjectDialog}>
            <Plus />
            Create Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Total Projects</p>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{summary.total}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Active Projects</p>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{summary.active}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Completed Projects</p>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{summary.completed}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Delayed Projects</p>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-3xl font-bold">{summary.delayed}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.8fr_repeat(3,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search projects by name or description"
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={value => setPriorityFilter(value as PriorityFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={teamSizeFilter}
            onValueChange={value => setTeamSizeFilter(value as TeamSizeFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Team Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Sizes</SelectItem>
              <SelectItem value="small">Small (1-3)</SelectItem>
              <SelectItem value="medium">Medium (4-7)</SelectItem>
              <SelectItem value="large">Large (8+)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredProjects.length} of {projectInsights.length} projects
          </p>

          <div className="flex items-center gap-2 rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="h-8"
            >
              <Grid3X3 />
              Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              onClick={() => setViewMode('table')}
              className="h-8"
            >
              <Table2 />
              Table
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-3">
          {filteredProjects.map(item => (
            <div
              key={item.project.id}
              className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold leading-tight">{item.project.name}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.project.description}</p>
                </div>
                <Badge className={statusBadgeClass[item.derivedStatus]}>
                  {item.derivedStatus === 'on-hold'
                    ? 'On Hold'
                    : item.derivedStatus.charAt(0).toUpperCase() + item.derivedStatus.slice(1)}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Team Size</span>
                  <span className="font-medium">{item.project.teamSize}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tasks</span>
                  <span className="font-medium">
                    {item.completedTasks}/{item.tasks.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{item.project.progress}%</span>
                  </div>
                  <Progress value={item.project.progress} className="h-2.5" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                  <p className={`text-sm font-semibold ${item.overdueTasks > 0 ? 'text-destructive' : ''}`}>
                    {item.overdueTasks}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge className={`mt-1 ${priorityBadgeClass[item.priority]}`}>
                    {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Deadline</p>
                    <p
                      className={
                        item.deadlineTone === 'danger'
                          ? 'text-destructive font-medium'
                          : item.deadlineTone === 'warning'
                            ? 'text-primary font-medium'
                            : 'font-medium'
                      }
                    >
                      {item.deadlineText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {item.members.slice(0, 3).map(member => (
                      <Avatar key={`${item.project.id}-${member}`} className="h-8 w-8 border-2 border-card">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {item.members.length > 3 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium">
                        +{item.members.length - 3}
                      </div>
                    )}
                    {item.members.length === 0 && (
                      <div className="text-xs text-muted-foreground">No members assigned</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{item.members.length} members</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {projectActionButtons(item, 'grid')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-2 sm:p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Team Size</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map(item => (
                <TableRow key={`table-${item.project.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.project.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.project.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadgeClass[item.derivedStatus]}>
                      {item.derivedStatus === 'on-hold'
                        ? 'On Hold'
                        : item.derivedStatus.charAt(0).toUpperCase() + item.derivedStatus.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">{item.project.progress}%</div>
                      <Progress value={item.project.progress} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <p
                      className={
                        item.deadlineTone === 'danger'
                          ? 'text-destructive font-medium'
                          : item.deadlineTone === 'warning'
                            ? 'text-primary font-medium'
                            : ''
                      }
                    >
                      {item.deadlineText}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{item.project.teamSize}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {projectActionButtons(item, 'table')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-muted-foreground">No projects match your current filters.</p>
        </div>
      )}

      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={open => {
          setIsProjectDialogOpen(open);
          if (!open) {
            setSelectedProject(null);
            setProjectError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {renderProjectDialogContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
