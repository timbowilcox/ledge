import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1"
        style={{
          marginLeft: 260,
          padding: "40px 48px",
          maxWidth: 1200,
        }}
      >
        {children}
      </main>
      <ChatPanel />
    </div>
  );
}
