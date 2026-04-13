import { FormEvent, useCallback, useEffect, useState } from 'react';
import { TaskCard } from '../../components/TaskCard';
import { Plus } from 'lucide-react';
import { createTask, getProjects, getTasks, getUsers } from '../../lib/api';
import { toTask } from '../../lib/mappers';
import { Task } from '../../lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type FormStatus = 'todo' | 'in-progress' | 'review' | 'completed';
type FormPriority = 'low' | 'medium' | 'high';
type FormErrors = {
  title?: string;
  projectId?: string;
  dueDate?: string;
  submit?: string;
};

export function TaskManagement() {
  const [filter, setFilter] = useState<string>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    status: 'todo' as FormStatus,
    priority: 'medium' as FormPriority,
    dueDate: '',
    projectId: '',
    assignedToId: '',
  });

  const loadTasks = useCallback(async () => {
    const data = await getTasks({ size: 200 });
    setTasks(data.map(toTask));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadTasks().catch(() => {
        if (!active) return;
        setTasks([]);
      }),
      getProjects()
        .then(projectData => {
          if (!active) return;
          setProjects(projectData.map(project => ({ id: project.id, name: project.name })));
        })
        .catch(() => {
          if (!active) return;
          setProjects([]);
        }),
      getUsers()
        .then(userData => {
          if (!active) return;
          setMembers(userData.filter(user => user.roles?.some(role => role.replace('ROLE_', '').toLowerCase() === 'member')).map(user => ({ id: user.id, name: user.name, email: user.email })));
        })
        .catch(() => {
          if (!active) return;
          setMembers([]);
        }),
    ]);

    return () => {
      active = false;
    };
  }, [loadTasks]);

  useEffect(() => {
    if (projects.length > 0 && formState.projectId === '') {
      setFormState(prev => ({ ...prev, projectId: String(projects[0].id) }));
    }
  }, [projects, formState.projectId]);

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(t => t.status === filter);

  const statusToApi: Record<FormStatus, 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'> = {
    todo: 'TODO',
    'in-progress': 'IN_PROGRESS',
    review: 'REVIEW',
    completed: 'COMPLETED',
  };

  const priorityToApi: Record<FormPriority, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
  };

  const resetForm = () => {
    setFormState({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      projectId: projects.length > 0 ? String(projects[0].id) : '',
      assignedToId: '',
    });
    setFormErrors({});
  };

  const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    if (!formState.title.trim()) errors.title = 'Title is required';
    if (!formState.projectId) errors.projectId = 'Project is required';
    if (formState.dueDate && formState.dueDate < getTodayLocalDate()) {
      errors.dueDate = 'Due date cannot be in the past';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setFormErrors({});

    try {
      await createTask({
        title: formState.title.trim(),
        description: formState.description.trim(),
        status: statusToApi[formState.status],
        priority: priorityToApi[formState.priority],
        dueDate: formState.dueDate || undefined,
        assignedToId: formState.assignedToId ? Number(formState.assignedToId) : undefined,
        projectId: Number(formState.projectId),
      });
      await loadTasks();
      setIsCreateOpen(false);
      resetForm();
      toast.success('Task created successfully');
    } catch (error) {
      setFormErrors({
        submit: error instanceof Error ? error.message : 'Failed to create task',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Task Management</h1>
          <p className="text-muted-foreground">Create and assign tasks</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
          New Task
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'todo', 'in-progress', 'review', 'completed'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
              filter === status
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {status === 'all' ? 'All Tasks' : status.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Fill in task details and assign it to a team member.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formState.title}
                onChange={event => {
                  const value = event.target.value;
                  setFormState(prev => ({ ...prev, title: value }));
                  if (formErrors.title && value.trim()) {
                    setFormErrors(prev => ({ ...prev, title: undefined }));
                  }
                }}
                placeholder="Task title"
                aria-invalid={Boolean(formErrors.title)}
                required
              />
              {formErrors.title && (
                <p className="text-xs text-destructive">{formErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formState.description}
                onChange={event => setFormState(prev => ({ ...prev, description: event.target.value }))}
                placeholder="Task description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project</label>
                <select
                  value={formState.projectId}
                  onChange={event => {
                    const value = event.target.value;
                    setFormState(prev => ({ ...prev, projectId: value }));
                    if (formErrors.projectId && value) {
                      setFormErrors(prev => ({ ...prev, projectId: undefined }));
                    }
                  }}
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                  required
                >
                  {projects.length === 0 && <option value="">No projects available</option>}
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {formErrors.projectId && (
                  <p className="text-xs text-destructive">{formErrors.projectId}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee</label>
                <select
                  value={formState.assignedToId}
                  onChange={event => setFormState(prev => ({ ...prev, assignedToId: event.target.value }))}
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formState.status}
                  onChange={event => setFormState(prev => ({ ...prev, status: event.target.value as FormStatus }))}
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  <option value="todo">todo</option>
                  <option value="in-progress">in progress</option>
                  <option value="review">review</option>
                  <option value="completed">completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={formState.priority}
                  onChange={event => setFormState(prev => ({ ...prev, priority: event.target.value as FormPriority }))}
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={formState.dueDate}
                  min={getTodayLocalDate()}
                  onChange={event => {
                    const value = event.target.value;
                    setFormState(prev => ({ ...prev, dueDate: value }));
                    if (formErrors.dueDate && (!value || value >= getTodayLocalDate())) {
                      setFormErrors(prev => ({ ...prev, dueDate: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(formErrors.dueDate)}
                />
                {formErrors.dueDate && (
                  <p className="text-xs text-destructive">{formErrors.dueDate}</p>
                )}
              </div>
            </div>

            {formErrors.submit && (
              <p className="text-sm text-destructive">{formErrors.submit}</p>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || projects.length === 0}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? 'Creating...' : 'Create Task'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
