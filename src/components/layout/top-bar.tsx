'use client';

import { Coffee, Lock, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/use-session';
import { useRole } from '@/hooks/use-role';

interface TopBarProps {
  isOnBreak: boolean;
  onStartBreak: () => void;
  loading?: boolean;
}

export function TopBar({ isOnBreak, onStartBreak, loading = false }: TopBarProps) {
  const { data: user } = useCurrentUser();
  const { data: role } = useRole();

  const userName = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur px-4 sm:px-6 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnBreak ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnBreak ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isOnBreak ? 'Status: On Break' : 'Status: Duty Active'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Break button - Only visible for staff members */}
        {role !== 'admin' && (
          <Button
            onClick={onStartBreak}
            disabled={loading || isOnBreak}
            size="sm"
            className={`h-9 px-4 rounded-xl font-medium text-xs shadow-sm transition-all flex items-center gap-2 ${
              isOnBreak
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 hover:shadow-amber-500/20'
            }`}
          >
            <Coffee className="h-4 w-4" />
            <span>{isOnBreak ? 'On Break' : 'Break'}</span>
            {!isOnBreak && <Lock className="h-3 w-3 opacity-70 ml-0.5" />}
          </Button>
        )}

        {/* User Info */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border/60 text-xs">
          <div className="h-7 w-7 rounded-full bg-primary/15 grid place-items-center text-primary font-bold">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate max-w-[120px]">{userName}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{role || 'staff'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
