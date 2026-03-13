import BreadcrumbNav from "@/components/layout/BreadcrumbNav";

export default function ArchitectureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <BreadcrumbNav />
      {children}
    </div>
  );
}
