'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, CalendarCheck, MessageSquare,
  Receipt, Settings, LogOut, Dumbbell, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRole } from '@/hooks/use-role';
import { useCurrentUser } from '@/hooks/use-session';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { supabase } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { to: '/members', label: 'Members', icon: Users, adminOnly: false },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, adminOnly: false },
  { to: '/enquiries', label: 'Enquiries', icon: MessageSquare, adminOnly: false },
  { to: '/expenses', label: 'Expenses', icon: Receipt, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: role, isLoading: roleLoading } = useRole();
  const { data: user } = useCurrentUser();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();

  useEffect(() => setMobileOpen(false), [pathname]);

  // Redirect staff from admin-only pages
  useEffect(() => {
    if (roleLoading || !role) return;
    if (role !== 'admin' && (pathname === '/dashboard' || pathname === '/expenses' || pathname === '/settings')) {
      router.replace('/members');
    }
  }, [role, roleLoading, pathname, router]);

  const filteredNav = NAV_ITEMS.filter(item => item.adminOnly ? role === 'admin' : true);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.replace('/auth');
  }

  const userName = user?.user_metadata?.full_name ?? user?.email ?? '?';

  const sidebarContent = (
    <aside className="flex h-full w-64 flex-col bg-gradient-sidebar text-sidebar-foreground border-r border-sidebar-border relative overflow-hidden">
      {/* Glow effect */}
      <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: 'linear-gradient(135deg, #a3e635 0%, #65a30d 100%)' }} />

      {/* Header */}
      <div className="relative px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="h-11 w-11 rounded-xl object-cover shadow-elegant bg-background" />
        ) : (
          <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-elegant">
            <Dumbbell className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display font-semibold truncate tracking-tight">{settings?.gym_name ?? 'Gym Manager'}</p>
          {role === 'admin' && (
            <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/50">Gym Manager</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item, i) => {
          const isActive = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to));
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.25 }}
            >
              <Link
                href={item.to}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-primary text-primary-foreground shadow-elegant'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-white/80"
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="relative border-t border-sidebar-border p-3">
        <div className="px-3 py-2 mb-2 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent grid place-items-center text-sm font-semibold">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm truncate">{userName}</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">{role ?? '…'}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block sticky top-0 h-screen">{sidebarContent}</div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="relative h-full"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b bg-background/85 backdrop-blur px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-md hover:bg-accent">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-cover shadow-elegant bg-background" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-gradient-primary text-primary-foreground grid place-items-center shadow-elegant">
              <Dumbbell className="h-4 w-4" />
            </div>
          )}
          <span className="font-display font-semibold">{settings?.gym_name ?? 'Gym Manager'}</span>
        </div>
        <div className="w-9" />
      </header>
    </>
  );
}
