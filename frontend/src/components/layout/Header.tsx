import { User } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">관리자</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}
