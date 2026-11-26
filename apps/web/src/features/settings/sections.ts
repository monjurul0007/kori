import { List, Repeat, Settings, Tag, Wallet, type LucideIcon } from "lucide-react";

export interface SettingsSection {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Every settings page, in menu order: the desktop sub-menu and the phone list both read this. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { to: "/settings", label: "General", icon: Settings },
  { to: "/settings/categories", label: "Categories", icon: List },
  { to: "/settings/payment-methods", label: "Payment methods", icon: Wallet },
  { to: "/settings/tags", label: "Tags", icon: Tag },
  { to: "/settings/recurring", label: "Recurring", icon: Repeat },
];
