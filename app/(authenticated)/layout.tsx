import { getViewer } from "@/lib/viewer";
import { SCHOOL } from "@/lib/school";
import { CRLA_GRADES, EXAM_GRADES, PHILIRI_GRADES, RMA_GRADES } from "@/lib/grades";
import { Sidebar, type NavItem } from "./sidebar.tsx";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  const showsFor = (grades: number[]) =>
    grades.some((g) => viewer.allowedGrades.includes(g));

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: viewer.isHead ? "/admin" : "/my-class",
      icon: "dashboard",
    },
    { label: "Learners", href: "/learners", icon: "learners" },
    ...(showsFor(CRLA_GRADES)
      ? [{ label: "CRLA", href: "/crla", icon: "crla" as const }]
      : []),
    ...(showsFor(RMA_GRADES)
      ? [{ label: "RMA", href: "/rma", icon: "rma" as const }]
      : []),
    ...(showsFor(PHILIRI_GRADES)
      ? [{ label: "Phil-IRI", href: "/philiri", icon: "philiri" as const }]
      : []),
    ...(showsFor(EXAM_GRADES)
      ? [{ label: "Exams", href: "/exam", icon: "exams" as const }]
      : []),
    ...(viewer.isHead
      ? [
          {
            label: "Teacher Assignments",
            href: "/admin/teachers",
            icon: "teachers" as const,
          },
          { label: "Reports & Exports", href: "/reports", icon: "reports" as const },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} fullName={viewer.fullName} role={viewer.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <p className="pl-10 text-[13px] font-medium text-neutral-700 md:pl-0">
            {SCHOOL.name}
          </p>
          <p className="text-[13px] text-neutral-500">
            {viewer.fullName} · {viewer.role}
          </p>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
