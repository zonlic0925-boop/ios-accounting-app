import React from "react";
import * as Icons from "lucide-react";

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  className = "w-5 h-5",
  size = 20,
}) => {
  // Map some custom/special icon names to Lucide icons
  const iconMap: Record<string, keyof typeof Icons> = {
    Utensils: "Utensils",
    Coffee: "Coffee",
    Car: "Car",
    ShoppingBag: "ShoppingBag",
    Film: "Film",
    Home: "Home",
    HeartPulse: "HeartPulse",
    GraduationCap: "GraduationCap",
    MoreHorizontal: "MoreHorizontal",
    Briefcase: "Briefcase",
    TrendingUp: "TrendingUp",
    Gift: "Gift",
    DollarSign: "DollarSign",
    CreditCard: "CreditCard",
    Smartphone: "Smartphone",
    Plane: "Plane",
    Tag: "Tag",
    Wallet: "Wallet",
    Building2: "Building2",
    Coins: "Coins",
    Landmark: "Landmark",
  };

  const resolvedName = (iconMap[name] || name) as keyof typeof Icons;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[resolvedName] || Icons.HelpCircle;

  return <IconComponent className={className} size={size} />;
};
