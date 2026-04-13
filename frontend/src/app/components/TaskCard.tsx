import { Calendar, User } from 'lucide-react';
import { Task } from '../lib/types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const priorityColors = {
  high: 'bg-primary text-primary-foreground',
  medium: 'bg-secondary text-secondary-foreground',
  low: 'bg-muted text-muted-foreground'
};

const statusColors = {
  'todo': 'bg-muted text-muted-foreground',
  'in-progress': 'bg-secondary text-secondary-foreground',
  'review': 'bg-primary/20 text-primary',
  'completed': 'bg-accent text-accent-foreground'
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl p-4 border border-border hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium group-hover:text-primary transition-colors">{task.title}</h3>
        <span className={`px-2 py-1 rounded-lg text-xs ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{task.description}</p>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="w-4 h-4" />
          <span>{task.assignee}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <span className={`px-3 py-1 rounded-lg text-xs ${statusColors[task.status]}`}>
          {task.status.replace('-', ' ')}
        </span>
      </div>
    </div>
  );
}
