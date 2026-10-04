import { Receipt, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/settings", label: "Settings", icon: Settings },
];
