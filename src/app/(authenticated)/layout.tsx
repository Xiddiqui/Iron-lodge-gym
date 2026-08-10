'use client';
export const dynamic = 'force-dynamic';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { StaffBreakOverlay } from '@/components/layout/staff-break-overlay';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useStaffTracker } from '@/hooks/use-staff-tracker';
import { useStaffBreak } from '@/hooks/use-staff-break';
import { BiometricAlertsProvider } from '@/providers/biometric-alerts-provider';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useStaffTracker();

  const {
    isOnBreak,
    elapsedSeconds,
    startBreak,
    endBreak,
    loading: breakLoading,
  } = useStaffBreak();

  return (
    <BiometricAlertsProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            isOnBreak={isOnBreak}
            onStartBreak={startBreak}
            loading={breakLoading}
          />
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Lock Screen Overlay when Staff is on Break */}
        <StaffBreakOverlay
          isOpen={isOnBreak}
          elapsedSeconds={elapsedSeconds}
          onEndBreak={endBreak}
          loading={breakLoading}
        />
      </div>
    </BiometricAlertsProvider>
  );
}


