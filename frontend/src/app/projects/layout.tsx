import BreadcrumbNav from "@/components/layout/BreadcrumbNav";

export default function ProjectsLayout({
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
