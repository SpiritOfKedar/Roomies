import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Award,
  Badge,
  BarChart3,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardPlus,
  CreditCard,
  Droplets,
  Eye,
  EyeOff,
  Fuel,
  Gavel,
  HelpCircle,
  Home,
  HousePlus,
  Image,
  LayoutDashboard,
  ListTodo,
  LogIn,
  LogOut,
  Mail,
  Medal,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Smile,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  User,
  Users,
  Wallet,
  Wifi,
  Wrench,
  Utensils,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

/** Maps legacy Material Symbol names → Lucide components (no external font needed). */
const ICONS: Record<string, LucideIcon> = {
  person: User,
  mail: Mail,
  visibility: Eye,
  visibility_off: EyeOff,
  home: Home,
  image: Image,
  group: Users,
  emoji_events: Trophy,
  stars: Star,
  leaderboard: BarChart3,
  arrow_forward: ArrowRight,
  roofing: Home,
  dashboard: LayoutDashboard,
  check_circle: CheckCircle,
  payments: CreditCard,
  settings: Settings,
  logout: LogOut,
  login: LogIn,
  add_home: HousePlus,
  add: Plus,
  cleaning_services: Sparkles,
  receipt_long: Receipt,
  account_balance_wallet: Wallet,
  arrow_upward: ArrowUp,
  arrow_downward: ArrowDown,
  close: X,
  badge: Badge,
  event: Calendar,
  verified_user: ShieldCheck,
  sentiment_satisfied: Smile,
  swap_horiz: ArrowLeftRight,
  calendar_month: Calendar,
  check: Check,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  chat: MessageCircle,
  gavel: Gavel,
  warning: AlertTriangle,
  search: Search,
  add_task: ClipboardPlus,
  task: ListTodo,
  wifi: Wifi,
  shopping_cart: ShoppingCart,
  water_drop: Droplets,
  restaurant: Utensils,
  local_gas_station: Fuel,
  electric_bolt: Zap,
  build: Wrench,
  delete: Trash2,
  trophy: Trophy,
  military_tech: Medal,
  workspace_premium: Award,
  expand_more: ChevronDown,
  upload: Upload,
  replay: RotateCcw,
  fact_check: ClipboardCheck,
  edit: Pencil,
};

function parseSize(style?: React.CSSProperties, fallback = 20): number {
  if (!style?.fontSize) return fallback;
  const n = parseInt(String(style.fontSize), 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, className, style }: IconProps) {
  const LucideIcon = ICONS[name] ?? HelpCircle;
  const pixelSize = parseSize(style, size);

  return (
    <LucideIcon
      size={pixelSize}
      className={clsx('shrink-0', className)}
      aria-hidden
    />
  );
}
