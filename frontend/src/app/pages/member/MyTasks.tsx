import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { TaskCard } from '../../components/TaskCard';
import { getTasks, updateTask } from '../../lib/api';
import { toTask } from '../../lib/mappers';
import { Task } from '../../lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type FormStatus = 'todo' | 'in-progress' | 'review' | 'completed';
type StatusSelection = '' | FormStatus;

export function MyTasks() {
  const [filter, setFilter] = useState<string>('all');
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusSelection>('');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadTasks = useCallback(async () => {
    const data = await getTasks({ size: 200 });
    setMyTasks(data.map(toTask));
  }, []);

  useEffect(() => {
    let active = true;
    loadTasks().catch(() => {
      if (!active) return;
      setMyTasks([]);
    });
    return () => {
      active = false;
    };
  }, [loadTasks]);

  const filteredTasks = filter === 'all'
    ? myTasks
    : myTasks.filter(t => t.status === filter);

  const statusToApi: Record<FormStatus, 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED'> = {
    todo: 'TODO',
    'in-progress': 'IN_PROGRESS',
    review: 'REVIEW',
    completed: 'COMPLETED',
  };

  const requiresDescription = useMemo(
    () => status === 'in-progress' || status === 'completed',
    [status],
  );

  const openUpdateDialog = (task: Task) => {
    setSelectedTask(task);
    setStatus('');
    setStatusUpdateNote(task.statusUpdateNote ?? '');
    setFormError('');
    setOpen(true);
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTask) return;
    if (!status) {
      setFormError('Please select a status');
      return;
    }

    if (requiresDescription && !statusUpdateNote.trim()) {
      setFormError('Description is required when status is in progress or completed');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      await updateTask(selectedTask.id, {
        status: statusToApi[status],
        statusUpdateNote: statusUpdateNote.trim(),
      });
      await loadTasks();
      setOpen(false);
      setSelectedTask(null);
      toast.success('Task updated successfully');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Tasks</h1>
        <p className="text-muted-foreground">Manage your assigned tasks</p>
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
          <TaskCard key={task.id} task={task} onClick={() => openUpdateDialog(task)} />
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found in this category</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Task</DialogTitle>
            <DialogDescription>
              Change status and add update notes for this task.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStatusUpdate} className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedTask?.title}</p>
              <p className="text-xs text-muted-foreground">Project: {selectedTask?.projectName || 'General'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={event => setStatus(event.target.value as StatusSelection)}
                className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select status
                </option>
                <option value="in-progress">in progress</option>
                <option value="review">review</option>
                <option value="completed">completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Status Update Description
                {requiresDescription ? ' *' : ''}
              </label>
              <Textarea
                value={statusUpdateNote}
                onChange={event => setStatusUpdateNote(event.target.value)}
                placeholder="Add progress details, completion notes, blockers, etc."
                aria-invalid={Boolean(formError)}
              />
              {requiresDescription && (
                <p className="text-xs text-muted-foreground">Required for in progress and completed status.</p>
              )}
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {isSaving ? 'Updating...' : 'Update Task'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
