// app/admin/layout.tsx
// Wraps every /admin/* route with a persistent sidebar (see components/admin-nav.tsx)
// so the app reads as one cohesive tool instead of a set of unlinked pages.

import { AdminNav } from '@/components/admin-nav';
import { EmailVerificationBanner } from '@/components/email-verification-banner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F7F6F2]">
      <AdminNav />
      <main className="flex-1 min-w-0">
        <EmailVerificationBanner />
        {children}
      </main>
    </div>
  );
}
