import {
  Banknote,
  Bus,
  CircleDollarSign,
  Clapperboard,
  Ellipsis,
  GraduationCap,
  Gift,
  HandHeart,
  HeartPulse,
  House,
  Laptop,
  PiggyBank,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Utensils,
  Zap,
  Coffee,
  Car,
  Dumbbell,
  Baby,
  PawPrint,
  Wrench,
  Tag,
  type LucideIcon,
} from "lucide-react";

/** The curated icons a category can use, keyed by the lucide name the API stores. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  bus: Bus,
  house: House,
  zap: Zap,
  smartphone: Smartphone,
  "heart-pulse": HeartPulse,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  "graduation-cap": GraduationCap,
  clapperboard: Clapperboard,
  ellipsis: Ellipsis,
  banknote: Banknote,
  laptop: Laptop,
  "hand-heart": HandHeart,
  "circle-dollar-sign": CircleDollarSign,
  coffee: Coffee,
  car: Car,
  plane: Plane,
  dumbbell: Dumbbell,
  baby: Baby,
  "paw-print": PawPrint,
  wrench: Wrench,
  "piggy-bank": PiggyBank,
};

export const CATEGORY_COLORS = [
  { name: "Green", value: "#047857" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Pink", value: "#db2777" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#b45309" },
  { name: "Slate", value: "#475569" },
] as const;

/** An icon the API may have stored that is not in the curated set still renders, as a tag. */
export function CategoryIcon({ icon, color }: { icon: string | null; color: string | null }) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || Tag;
  return (
    <Icon className="h-4 w-4 shrink-0" style={color ? { color } : undefined} aria-hidden="true" />
  );
}
