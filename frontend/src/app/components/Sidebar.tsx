import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  User,
  LogOut,
  ListTodo
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const getNavItems = () => {
    switch (user?.role) {
      case 'admin':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
          { icon: Users, label: 'Users', path: '/admin/users' },
          { icon: FolderKanban, label: 'Projects', path: '/admin/projects' },
          { icon: User, label: 'Profile', path: '/admin/profile' },
        ];
      case 'manager':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/manager/dashboard' },
          { icon: CheckSquare, label: 'Tasks', path: '/manager/tasks' },
          { icon: FolderKanban, label: 'Projects', path: '/manager/projects' },
          { icon: User, label: 'Profile', path: '/manager/profile' },
        ];
      case 'member':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/member/dashboard' },
          { icon: ListTodo, label: 'My Tasks', path: '/member/tasks' },
          { icon: User, label: 'Profile', path: '/member/profile' },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className={`h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      <div className="p-6">
        <h1 className={`font-bold text-foreground transition-opacity ${
          collapsed ? 'opacity-0' : 'opacity-100'
        }`}>
          TaskFlow
        </h1>
      </div>

      <nav className="flex-1 px-3 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
