import { Sidebar } from "@/components/sidebar";
import { CommandBarProvider } from "@/components/command-bar-provider";
import { CommandBar } from "@/components/command-bar";
import { PostTransactionProvider } from "@/components/post-transaction-provider";
import { PostTransactionModal } from "@/components/post-transaction-modal";
import { NavigationProgress } from "@/components/navigation-progress";
import { NameCaptureModal } from "@/components/name-capture-modal";
import { DashboardHeader } from "@/components/dashboard-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandBarProvider>
      <PostTransactionProvider>
        <NavigationProgress />
        <div className="flex min-h-screen">
          <Sidebar />
          <main
            className="flex-1 page-content"
            style={{
              marginLeft: "var(--sidebar-width)",
              padding: "2rem 2rem",
              maxWidth: "75rem",
              minHeight: "100vh",
              position: "relative",
              zIndex: 1,
            }}
          >
            <DashboardHeader />
            {children}
          </main>
          <CommandBar />
          <PostTransactionModal />
          <NameCaptureModal />
        </div>
      </PostTransactionProvider>
    </CommandBarProvider>
  );
}
