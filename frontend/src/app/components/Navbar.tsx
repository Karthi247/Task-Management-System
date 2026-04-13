import { useEffect, useState } from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications } from '../lib/api';
import { ApiNotification } from '../lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    setError('');
    getNotifications()
      .then(data => {
        if (!active) return;
        setNotifications(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  const hasAttentionItems = notifications.some(note => note.type === 'OVERDUE' || note.type === 'DUE_SOON');

  const notificationTypeClass = (type: string) => {
    if (type === 'OVERDUE') return 'bg-destructive/10 text-destructive';
    if (type === 'DUE_SOON') return 'bg-primary/10 text-primary';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks, projects..."
            className="pl-10 pr-4 py-2 bg-input-background rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring w-64 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="w-5 h-5" />
              {hasAttentionItems && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="p-4 text-sm text-muted-foreground">Loading notifications...</p>}
              {!loading && error && <p className="p-4 text-sm text-destructive">{error}</p>}
              {!loading && !error && notifications.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No notifications right now.</p>
              )}
              {!loading && !error && notifications.length > 0 && (
                <div className="divide-y divide-border">
                  {notifications.map(note => (
                    <div key={note.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-sm">{note.title}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${notificationTypeClass(note.type)}`}>
                          {note.type.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{note.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="font-medium text-sm">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
