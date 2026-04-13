import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  CheckCircle2,
  Clock3,
  Edit3,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Progress } from '../../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { getMe, getTasks, updateTask } from '../../lib/api';
import { toTask, toUser } from '../../lib/mappers';
import { Task, User } from '../../lib/types';
import { toast } from 'sonner';

type FormStatus = 'todo' | 'in-progress' | 'review' | 'completed';
type StatusSelection = '' | FormStatus;

const fullDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const priorityStyles: Record<Task['priority'], string> = {
  high: 'bg-red-500/15 text-red-700 border-red-200',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-200',
  low: 'bg-blue-500/15 text-blue-700 border-blue-200',
};

const statusStyles: Record<Task['status'], string> = {
  todo: 'bg-slate-500/10 text-slate-700 border-slate-200',
  'in-progress': 'bg-blue-500/15 text-blue-700 border-blue-200',
  review: 'bg-amber-500/15 text-amber-700 border-amber-200',
  completed: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
};

const statusLabel: Record<FormStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  review: 'Review',
  completed: 'Completed',
};

const todayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

const sameDay = (a: Date | null, b: Date) => Boolean(a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sortByDueDate = (tasks: Task[]) =>
  tasks.slice().sort((a, b) => (parseDate(a.dueDate)?.getTime() ?? 0) - (parseDate(b.dueDate)?.getTime() ?? 0));

const priorityRank: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };
const statusRank: Record<Task['status'], number> = { 'in-progress': 0, review: 1, todo: 2, completed: 3 };

export function MemberDashboard() {
  const [me, setMe] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<StatusSelection>('');
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const [meData, taskData] = await Promise.all([
      getMe().catch(() => null),
      getTasks({ size: 200 }).catch(() => []),
    ]);

    setMe(meData ? toUser(meData) : null);
    setTasks(taskData.map(toTask));
  }, []);

  useEffect(() => {
    let active = true;
    loadDashboard().catch(() => {
      if (!active) return;
      setMe(null);
      setTasks([]);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const ownedTasks = useMemo(() => {
    if (!me) return tasks;
    const needles = [me.name, me.email].map(value => value.toLowerCase());
    const matched = tasks.filter(task => needles.some(needle => task.assignee.toLowerCase().includes(needle)));
    return matched.length > 0 ? matched : tasks;
  }, [me, tasks]);

  const now = new Date();
  const today = todayStart();
  const weekStart = todayStart();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = addDays(weekStart, 7);
  const dueSoonWindow = addDays(today, 3);

  const dueToday = useMemo(() => ownedTasks.filter(task => task.status !== 'completed' && sameDay(parseDate(task.dueDate), today)), [ownedTasks, today]);
  const inProgressTasks = useMemo(() => ownedTasks.filter(task => task.status === 'in-progress'), [ownedTasks]);
  const completedTasks = useMemo(() => ownedTasks.filter(task => task.status === 'completed'), [ownedTasks]);
  const overdueTasks = useMemo(() => ownedTasks.filter(task => {
    const dueDate = parseDate(task.dueDate);
    return task.status !== 'completed' && Boolean(dueDate && dueDate.getTime() < today.getTime());
  }), [ownedTasks, today]);
  const completedThisWeek = useMemo(() => completedTasks.filter(task => {
    const dueDate = parseDate(task.dueDate);
    return Boolean(dueDate && dueDate >= weekStart && dueDate < weekEnd);
  }), [completedTasks, weekEnd, weekStart]);
  const dueSoon = useMemo(() => ownedTasks.filter(task => {
    const dueDate = parseDate(task.dueDate);
    return task.status !== 'completed' && Boolean(dueDate && dueDate >= today && dueDate < dueSoonWindow);
  }), [ownedTasks, today, dueSoonWindow]);

  const totalTasks = ownedTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  const streakDays = useMemo(() => {
    const completedDates = new Set(
      completedTasks
        .map(task => parseDate(task.dueDate))
        .filter((date): date is Date => Boolean(date))
        .map(date => date.toDateString()),
    );

    let streak = 0;
    let cursor = todayStart();
    for (let i = 0; i < 30; i += 1) {
      if (!completedDates.has(cursor.toDateString())) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak > 0 ? streak : completedTasks.length > 0 ? 1 : 0;
  }, [completedTasks]);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, [now]);

  const displayName = me?.name || 'there';
  const todayLabel = fullDate.format(now);
  const motivationalSubtitle = `${dueToday.length} task${dueToday.length === 1 ? '' : 's'} due today`;

  const activeTasks = useMemo(() => sortByDueDate(
    ownedTasks
      .filter(task => task.status !== 'completed')
      .sort((a, b) => {
        const statusDiff = statusRank[a.status] - statusRank[b.status];
        if (statusDiff !== 0) return statusDiff;
        const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (parseDate(a.dueDate)?.getTime() ?? 0) - (parseDate(b.dueDate)?.getTime() ?? 0);
      }),
  ), [ownedTasks]);

  const todayHighlights = useMemo(() => sortByDueDate([...dueToday, ...dueSoon.filter(task => !dueToday.some(todayTask => todayTask.id === task.id))]).slice(0, 4), [dueSoon, dueToday]);
  const recentCompleted = useMemo(() => sortByDueDate(completedTasks).slice(-4).reverse(), [completedTasks]);
  const notifications = useMemo(() => {
    const alerts: Array<{ id: string; title: string; message: string; tone: 'danger' | 'warning' | 'info' }> = [];

    overdueTasks.slice(0, 2).forEach(task => {
      alerts.push({
        id: `overdue-${task.id}`,
        title: `Overdue: ${task.title}`,
        message: `${task.projectName || 'General'} needs attention today.`,
        tone: 'danger',
      });
    });

    dueSoon.slice(0, 2).forEach(task => {
      alerts.push({
        id: `due-soon-${task.id}`,
        title: `Due soon: ${task.title}`,
        message: `${task.dueDate ? shortDate.format(new Date(task.dueDate)) : 'Upcoming deadline'}`,
        tone: 'warning',
      });
    });

    if (alerts.length === 0 && completedThisWeek.length > 0) {
      alerts.push({
        id: 'win',
        title: 'Nice momentum',
        message: 'You have completed tasks this week. Keep the streak going.',
        tone: 'info',
      });
    }

    return alerts.slice(0, 4);
  }, [completedThisWeek.length, dueSoon, overdueTasks]);

  const achievements = useMemo(() => {
    const items: Array<{ label: string; detail: string; tone: string }> = [];
    if (streakDays > 0) items.push({ label: `${streakDays} Day Streak`, detail: 'Keep completing at least one task each day.', tone: 'from-orange-500 to-rose-500' });
    if (completedThisWeek.length >= 3) items.push({ label: 'Momentum Builder', detail: 'Strong weekly completion pace.', tone: 'from-emerald-500 to-teal-500' });
    if (overdueTasks.length === 0 && totalTasks > 0) items.push({ label: 'On Time', detail: 'No overdue tasks on your board.', tone: 'from-sky-500 to-blue-500' });
    if (items.length === 0) items.push({ label: 'First Win', detail: 'Complete a task to unlock streaks and badges.', tone: 'from-slate-500 to-slate-700' });
    return items.slice(0, 3);
  }, [completedThisWeek.length, overdueTasks.length, streakDays, totalTasks]);

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    setStatus(task.status);
    setStatusUpdateNote(task.statusUpdateNote ?? '');
    setFormError('');
    setOpen(true);
  };

  const reloadTasks = useCallback(async () => {
    const taskData = await getTasks({ size: 200 });
    setTasks(taskData.map(toTask));
  }, []);

  const quickComplete = async (task: Task) => {
    setSavingTaskId(task.id);
    try {
      await updateTask(task.id, {
        status: 'COMPLETED',
        statusUpdateNote: task.statusUpdateNote || 'Marked complete from the member dashboard.',
      });
      await reloadTasks();
      toast.success('Task marked complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTask) return;

    if (!status) {
      setFormError('Please select a status');
      return;
    }

    if ((status === 'in-progress' || status === 'completed') && !statusUpdateNote.trim()) {
      setFormError('Please add a short update note for this status change.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      await updateTask(selectedTask.id, {
        status: status === 'todo' ? 'TODO' : status === 'in-progress' ? 'IN_PROGRESS' : status === 'review' ? 'REVIEW' : 'COMPLETED',
        statusUpdateNote: statusUpdateNote.trim(),
      });
      await reloadTasks();
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
    <div className="relative space-y-8 overflow-hidden">
      <div className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-40 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.2),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Member Dashboard
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {greeting}, {displayName} ??
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/75 md:text-base">
                {motivationalSubtitle}. Here&apos;s your personal workspace for staying focused and finishing strong.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-white/80">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">{todayLabel}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">{inProgressTasks.length} in progress</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">{overdueTasks.length} overdue</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Streak</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-bold">{streakDays}</span>
                <span className="pb-1 text-sm text-white/70">days</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Focus</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-bold">{completionRate}%</span>
                <span className="pb-1 text-sm text-white/70">complete</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Today</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-bold">{dueToday.length}</span>
                <span className="pb-1 text-sm text-white/70">tasks due</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Tasks Due Today</p>
              <h2 className="mt-2 text-3xl font-bold">{dueToday.length}</h2>
            </div>
            <div className="rounded-2xl bg-red-500/15 p-3 text-red-700">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-red-700">
            <ArrowUpRight className="h-4 w-4" />
            Prioritize these first
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">In Progress Tasks</p>
              <h2 className="mt-2 text-3xl font-bold">{inProgressTasks.length}</h2>
            </div>
            <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-700">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-700">
            <ArrowUpRight className="h-4 w-4" />
            Keep the momentum going
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Completed This Week</p>
              <h2 className="mt-2 text-3xl font-bold">{completedThisWeek.length}</h2>
            </div>
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <ArrowUpRight className="h-4 w-4" />
            Great weekly progress
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Overdue Tasks</p>
              <h2 className="mt-2 text-3xl font-bold">{overdueTasks.length}</h2>
            </div>
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-700">
            <ArrowUpRight className="h-4 w-4" />
            Resolve these first
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Productivity</h2>
                <p className="text-sm text-muted-foreground">Your overall completion rate and task balance</p>
              </div>
              <div className="rounded-2xl bg-muted px-4 py-2 text-sm font-medium">
                {completedTasks.length}/{totalTasks} tasks
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-4xl font-bold">{completionRate}%</p>
                  </div>
                  <div className="pb-1 text-sm text-muted-foreground">Keep pushing toward 100%</div>
                </div>
                <Progress value={completionRate} className="h-3" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Todo</p>
                    <p className="mt-1 text-lg font-semibold">{ownedTasks.filter(task => task.status === 'todo').length}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <p className="mt-1 text-lg font-semibold">{inProgressTasks.length}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Review</p>
                    <p className="mt-1 text-lg font-semibold">{ownedTasks.filter(task => task.status === 'review').length}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p className="mt-1 text-lg font-semibold text-red-600">{overdueTasks.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-50 to-white p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Target className="h-4 w-4 text-blue-600" />
                  Focus Tip
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Start with high-priority tasks due today, finish one task at a time, and use the streak to keep momentum high.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-blue-500/10 px-3 py-2 text-sm text-blue-700">
                  <Flame className="h-4 w-4" />
                  You are building consistency.
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Today&apos;s Tasks</h2>
                <p className="text-sm text-muted-foreground">Important work due today or very soon</p>
              </div>
              <Badge className="rounded-full border border-blue-200 bg-blue-500/10 text-blue-700">{todayHighlights.length} highlighted</Badge>
            </div>

            {todayHighlights.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {todayHighlights.map(task => (
                  <div key={task.id} className="group rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold group-hover:text-blue-700">{task.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.projectName || 'General project'}</p>
                      </div>
                      <Badge className={`rounded-full border ${priorityStyles[task.priority]}`}>{task.priority}</Badge>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Deadline</span>
                      <span className={task.status !== 'completed' && parseDate(task.dueDate)?.getTime() < Date.now() ? 'font-medium text-red-600' : 'font-medium'}>
                        {task.dueDate ? fullDate.format(new Date(task.dueDate)) : 'No deadline'}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => quickComplete(task)}
                        disabled={savingTaskId === task.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {savingTaskId === task.id ? 'Saving...' : 'Mark Complete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(task)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-muted"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-3 font-medium">Nothing urgent for today</p>
                <p className="mt-1 text-sm text-muted-foreground">You&apos;re caught up. Keep an eye on your upcoming tasks below.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Active Tasks</h2>
                <p className="text-sm text-muted-foreground">Interactive list for managing your current workload</p>
              </div>
              <Badge className="rounded-full border border-slate-200 bg-slate-500/10 text-slate-700">{activeTasks.length} active</Badge>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTasks.slice(0, 8).map(task => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{task.projectName || 'General project'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full border ${priorityStyles[task.priority]}`}>{task.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={task.status !== 'completed' && parseDate(task.dueDate)?.getTime() < Date.now() ? 'font-medium text-red-600' : ''}>
                          {task.dueDate ? fullDate.format(new Date(task.dueDate)) : 'No deadline'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full border ${statusStyles[task.status]}`}>{statusLabel[task.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => quickComplete(task)}
                            disabled={savingTaskId === task.id || task.status === 'completed'}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditDialog(task)}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition-all hover:bg-muted"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {activeTasks.length === 0 && (
              <div className="py-10 text-center text-muted-foreground">No active tasks right now.</div>
            )}
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-700">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Gamification</h2>
                <p className="text-sm text-muted-foreground">Small wins that keep you moving</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-orange-500/20">
              <p className="text-sm/none uppercase tracking-[0.2em] text-white/75">Streak</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-bold">{streakDays}</span>
                <span className="pb-1 text-lg text-white/80">Day Streak</span>
              </div>
              <p className="mt-3 text-sm text-white/85">Keep completing tasks daily to grow your streak and unlock better rhythm.</p>
            </div>

            <div className="mt-4 space-y-3">
              {achievements.map(achievement => (
                <div key={achievement.label} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl bg-gradient-to-br ${achievement.tone} p-2 text-white`}>
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{achievement.label}</p>
                      <p className="text-sm text-muted-foreground">{achievement.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-2xl bg-blue-500/15 p-3 text-blue-700">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Notifications</h2>
                <p className="text-sm text-muted-foreground">Alerts, deadlines, and quick reminders</p>
              </div>
            </div>

            <div className="space-y-3">
              {notifications.length > 0 ? notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`rounded-2xl border p-4 ${
                    notification.tone === 'danger'
                      ? 'border-red-200 bg-red-500/10'
                      : notification.tone === 'warning'
                        ? 'border-amber-200 bg-amber-500/10'
                        : 'border-blue-200 bg-blue-500/10'
                  }`}
                >
                  <p className="font-medium">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  No alerts right now. Your board looks calm.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recently Completed</h2>
                <p className="text-sm text-muted-foreground">Your latest wins</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="space-y-3">
              {recentCompleted.length > 0 ? recentCompleted.map(task => (
                <div key={task.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{task.projectName || 'General project'}</p>
                    </div>
                    <Badge className="rounded-full border border-emerald-200 bg-emerald-500/10 text-emerald-700">Done</Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Completed tasks will show up here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Task</DialogTitle>
            <DialogDescription>Change status and add a quick note for this task.</DialogDescription>
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
                className="h-10 w-full rounded-md border border-input bg-input-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select status
                </option>
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status Update Note</label>
              <Textarea
                value={statusUpdateNote}
                onChange={event => setStatusUpdateNote(event.target.value)}
                placeholder="Share progress, blockers, or completion notes..."
                aria-invalid={Boolean(formError)}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-md border border-border bg-background px-4 hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-9 rounded-md bg-primary px-4 text-primary-foreground hover:opacity-90 disabled:opacity-60"
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
