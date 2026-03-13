import { Sidebar } from "@/components/sidebar";
import { CommandBarProvider } from "@/components/command-bar-provider";
import { CommandBar } from "@/components/command-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandBarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main
          className="flex-1"
          style={{
            marginLeft: 240,
            padding: "32px 32px",
            maxWidth: 1200,
            backgroundColor: "#FAFAFA",
            minHeight: "100vh",
          }}
        >
          {children}
        </main>
        <CommandBar />
      </div>
    </CommandBarProvider>
  );
}
