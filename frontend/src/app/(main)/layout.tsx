import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <div className="min-h-0 flex-1 overflow-auto bg-surface-primary p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
