import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Edit3,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Save,
  Shield,
  User as UserIcon,
  UserCircle2,
  UserCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { changeMyPassword, getTasks, updateMe, uploadMyAvatar } from '../lib/api';
import { toTask } from '../lib/mappers';
import { Task, UserRole } from '../lib/types';
import { useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

type RoleProfileMeta = {
  jobTitle: string;
  teamName: string;
  managerName: string;
  skills: string[];
  experienceLevel: string;
};

type ProfessionalFormState = {
  jobTitle: string;
  teamName: string;
  managerName: string;
  experienceLevel: string;
  skillsText: string;
};

const roleMeta: Record<UserRole, RoleProfileMeta> = {
  member: {
    jobTitle: 'Team Member',
    teamName: 'Execution Team',
    managerName: 'Manager One',
    skills: ['Task Execution', 'Team Collaboration', 'Status Reporting'],
    experienceLevel: 'Mid Level',
  },
  manager: {
    jobTitle: 'Project Manager',
    teamName: 'Operations Leadership',
    managerName: 'Admin Team',
    skills: ['Planning', 'Team Leadership', 'Risk Management'],
    experienceLevel: 'Senior Level',
  },
  admin: {
    jobTitle: 'System Administrator',
    teamName: 'Platform Administration',
    managerName: 'Executive Board',
    skills: ['Governance', 'Security', 'System Configuration'],
    experienceLevel: 'Expert Level',
  },
};

function getJoinDateFromId(id: string | undefined) {
  if (!id) return 'N/A';
  const numeric = Number(id) || 1;
  const joined = new Date(2024, Math.min(11, numeric % 12), Math.max(1, (numeric % 27) + 1));
  return joined.toLocaleDateString();
}

export function ProfilePageContent() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [username, setUsername] = useState(
    user?.email ? user.email.split('@')[0] : 'user_profile',
  );
  const [professionalDetails, setProfessionalDetails] = useState<RoleProfileMeta>(
    roleMeta[user?.role ?? 'member'],
  );
  const [professionalDialogOpen, setProfessionalDialogOpen] = useState(false);
  const [professionalForm, setProfessionalForm] = useState<ProfessionalFormState>({
    jobTitle: roleMeta[user?.role ?? 'member'].jobTitle,
    teamName: roleMeta[user?.role ?? 'member'].teamName,
    managerName: roleMeta[user?.role ?? 'member'].managerName,
    experienceLevel: roleMeta[user?.role ?? 'member'].experienceLevel,
    skillsText: roleMeta[user?.role ?? 'member'].skills.join(', '),
  });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setUsername(user?.email ? user.email.split('@')[0] : 'user_profile');
    const meta = roleMeta[user?.role ?? 'member'];
    setProfessionalDetails(meta);
    setProfessionalForm({
      jobTitle: meta.jobTitle,
      teamName: meta.teamName,
      managerName: meta.managerName,
      experienceLevel: meta.experienceLevel,
      skillsText: meta.skills.join(', '),
    });
  }, [user]);

  useEffect(() => {
    let active = true;
    getTasks({ size: 200 })
      .then(data => {
        if (!active) return;
        setTasks(data.map(toTask));
      })
      .catch(() => {
        if (!active) return;
        setTasks([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const profileMeta = roleMeta[user?.role ?? 'member'];
  const now = new Date();

  const stats = useMemo(() => {
    const completed = tasks.filter(task => task.status === 'completed').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const pending = tasks.filter(task => task.status === 'todo' || task.status === 'review').length;
    const overdue = tasks.filter(task => {
      if (!task.dueDate || task.status === 'completed') return false;
      return new Date(task.dueDate).getTime() < new Date(now.toDateString()).getTime();
    }).length;
    return { completed, inProgress, pending, overdue };
  }, [tasks, now]);

  const timelineItems = useMemo(() => {
    const items = [];
    const completedTask = tasks.find(task => task.status === 'completed');
    const activeTask = tasks.find(task => task.status === 'in-progress' || task.status === 'todo');

    if (completedTask) {
      items.push({
        title: `Completed "${completedTask.title}"`,
        subtitle: 'Task marked as completed',
        icon: CheckCircle2,
      });
    }
    if (activeTask) {
      items.push({
        title: `Assigned "${activeTask.title}"`,
        subtitle: 'Task assignment added to your queue',
        icon: UserCog,
      });
    }
    items.push({
      title: 'Profile information updated',
      subtitle: 'Account details reviewed and saved',
      icon: UserCircle2,
    });
    return items;
  }, [tasks]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        email: email.trim(),
      });
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutAllDevices = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleAvatarUploadClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      await uploadMyAvatar(file);
      await refreshUser();
      toast.success('Avatar updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleOpenPasswordDialog = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogOpen(true);
  };

  const handleOpenProfessionalDialog = () => {
    setProfessionalForm({
      jobTitle: professionalDetails.jobTitle,
      teamName: professionalDetails.teamName,
      managerName: professionalDetails.managerName,
      experienceLevel: professionalDetails.experienceLevel,
      skillsText: professionalDetails.skills.join(', '),
    });
    setProfessionalDialogOpen(true);
  };

  const handleSaveProfessionalDetails = () => {
    const skills = professionalForm.skillsText
      .split(',')
      .map(skill => skill.trim())
      .filter(Boolean);

    setProfessionalDetails({
      jobTitle: professionalForm.jobTitle.trim() || professionalDetails.jobTitle,
      teamName: professionalForm.teamName.trim() || professionalDetails.teamName,
      managerName: professionalForm.managerName.trim() || professionalDetails.managerName,
      experienceLevel: professionalForm.experienceLevel.trim() || professionalDetails.experienceLevel,
      skills: skills.length > 0 ? skills : professionalDetails.skills,
    });
    setProfessionalDialogOpen(false);
    toast.success('Professional details updated');
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      toast.error('Current password is required');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('New password is required');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password must match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setPasswordDialogOpen(false);
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Profile</h1>
        <p className="text-muted-foreground">
          Manage identity, account settings, activity, and security.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile avatar"
                  className="w-24 h-24 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-3xl font-semibold">
                  {user?.name?.[0] || 'U'}
                </div>
              )}
              <button
                type="button"
                onClick={handleAvatarUploadClick}
                disabled={isUploadingAvatar}
                className="absolute -right-1 -bottom-1 size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-all"
                aria-label="Upload profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>
            <h2 className="text-xl font-semibold mt-4">{user?.name || 'User Name'}</h2>
            <p className="text-muted-foreground capitalize">{user?.role || 'member'}</p>

            <div className="w-full mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-medium">#{user?.id || '000'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{user?.department || 'Task Operations'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Join Date</span>
                <span className="font-medium">{getJoinDateFromId(user?.id)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-accent" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Account Information
            </h2>
            <button
              type="button"
              onClick={handleOpenPasswordDialog}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm font-medium"
            >
              Change Password
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Full Name</label>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Username</label>
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>
      </div>

      <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          Task Statistics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-background p-4 hover:shadow-sm transition-all">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-accent" />Completed</p>
            <p className="text-2xl font-bold mt-1">{stats.completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4 hover:shadow-sm transition-all">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock3 className="w-4 h-4 text-primary" />In Progress</p>
            <p className="text-2xl font-bold mt-1">{stats.inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4 hover:shadow-sm transition-all">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><CalendarDays className="w-4 h-4 text-secondary-foreground" />Pending</p>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4 hover:shadow-sm transition-all">
            <p className="text-sm text-muted-foreground flex items-center gap-2"><CircleAlert className="w-4 h-4 text-destructive" />Overdue</p>
            <p className="text-2xl font-bold mt-1">{stats.overdue}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Professional Details
            </h2>
            <button
              type="button"
              onClick={handleOpenProfessionalDialog}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm font-medium"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Job Title</p>
              <p className="font-medium">{professionalDetails.jobTitle}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Team Name</p>
              <p className="font-medium">{professionalDetails.teamName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Manager Name</p>
              <p className="font-medium">{professionalDetails.managerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Experience Level</p>
              <p className="font-medium">{professionalDetails.experienceLevel}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {professionalDetails.skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1 rounded-full text-xs bg-muted text-muted-foreground border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            Security Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">Change Password</p>
                <p className="text-sm text-muted-foreground">Update your password regularly for account safety.</p>
              </div>
              <button
                type="button"
                onClick={handleOpenPasswordDialog}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted transition-all text-sm"
              >
                <KeyRound className="w-4 h-4 inline mr-2" />
                Change
              </button>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium">Last Login</p>
              <p className="text-sm text-muted-foreground">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button
              type="button"
              onClick={handleLogoutAllDevices}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout From All Devices
            </button>
          </div>
        </section>
      </div>

      <section className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          Activity Timeline
        </h2>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-5">
            {timelineItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={`${item.title}-${index}`} className="relative">
                  <span className="absolute -left-[22px] top-1 size-5 rounded-full bg-card border border-border flex items-center justify-center">
                    <Icon className="w-3 h-3 text-primary" />
                  </span>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Use your current password to set a new password.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setPasswordDialogOpen(false)}
              className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isChangingPassword}
              onClick={handleChangePassword}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={professionalDialogOpen} onOpenChange={setProfessionalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Professional Details</DialogTitle>
            <DialogDescription>
              Update the details shown in your profile summary.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Job Title</label>
              <input
                value={professionalForm.jobTitle}
                onChange={event => setProfessionalForm(prev => ({ ...prev, jobTitle: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Team Name</label>
              <input
                value={professionalForm.teamName}
                onChange={event => setProfessionalForm(prev => ({ ...prev, teamName: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Manager Name</label>
              <input
                value={professionalForm.managerName}
                onChange={event => setProfessionalForm(prev => ({ ...prev, managerName: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Experience Level</label>
              <input
                value={professionalForm.experienceLevel}
                onChange={event => setProfessionalForm(prev => ({ ...prev, experienceLevel: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Skills</label>
              <textarea
                value={professionalForm.skillsText}
                onChange={event => setProfessionalForm(prev => ({ ...prev, skillsText: event.target.value }))}
                placeholder="Separate skills with commas"
                className="w-full min-h-24 px-3 py-2.5 rounded-xl bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setProfessionalDialogOpen(false)}
              className="h-9 px-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveProfessionalDetails}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            >
              Save Details
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
