import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-6 border border-border hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <span className={`text-sm ${trendUp ? 'text-accent' : 'text-primary'}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-3xl font-bold mb-1">{value}</h3>
      <p className="text-muted-foreground text-sm">{title}</p>
    </div>
  );
}
