'use client';

// components/icon-picker.tsx
// A visual picker over a curated set of lucide-react icons, so admins pick
// an icon instead of typing its exact kebab-case name from memory. Stores
// the same kind of string (e.g. "clipboard-list") that free-text `icon`
// fields (DynamicModuleDefinition.icon, MenuItem.icon) already accept — no
// API/schema change needed.

import { useEffect, useRef, useState } from 'react';
import {
  Church,
  Cross,
  HandHeart,
  BookOpen,
  Music,
  Mic,
  Camera,
  Video,
  Image as ImageIcon,
  Folder,
  Archive,
  Search,
  Tag,
  Flag,
  Bookmark,
  Home,
  Landmark,
  Gift,
  Award,
  Star,
  Heart,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  Globe,
  ShieldCheck,
  Lock,
  KeyRound,
  Settings,
  SlidersHorizontal,
  Layers,
  Puzzle,
  Workflow,
  FormInput,
  ListChecks,
  ListPlus,
  ClipboardList,
  Briefcase,
  Wallet,
  CalendarCheck,
  CalendarDays,
  Users,
  Users2,
  UserPlus,
  Building2,
  BarChart3,
  Boxes,
  FileText,
  Bell,
  LayoutGrid,
  Palette,
  TrendingUp,
  PiggyBank,
  Megaphone,
  Handshake,
  type LucideIcon,
} from 'lucide-react';

export const ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'church', Icon: Church },
  { name: 'cross', Icon: Cross },
  { name: 'hand-heart', Icon: HandHeart },
  { name: 'book-open', Icon: BookOpen },
  { name: 'music', Icon: Music },
  { name: 'mic', Icon: Mic },
  { name: 'camera', Icon: Camera },
  { name: 'video', Icon: Video },
  { name: 'image', Icon: ImageIcon },
  { name: 'folder', Icon: Folder },
  { name: 'archive', Icon: Archive },
  { name: 'search', Icon: Search },
  { name: 'tag', Icon: Tag },
  { name: 'flag', Icon: Flag },
  { name: 'bookmark', Icon: Bookmark },
  { name: 'home', Icon: Home },
  { name: 'landmark', Icon: Landmark },
  { name: 'gift', Icon: Gift },
  { name: 'award', Icon: Award },
  { name: 'star', Icon: Star },
  { name: 'heart', Icon: Heart },
  { name: 'message-square', Icon: MessageSquare },
  { name: 'phone', Icon: Phone },
  { name: 'mail', Icon: Mail },
  { name: 'map-pin', Icon: MapPin },
  { name: 'globe', Icon: Globe },
  { name: 'shield-check', Icon: ShieldCheck },
  { name: 'lock', Icon: Lock },
  { name: 'key-round', Icon: KeyRound },
  { name: 'settings', Icon: Settings },
  { name: 'sliders-horizontal', Icon: SlidersHorizontal },
  { name: 'layers', Icon: Layers },
  { name: 'puzzle', Icon: Puzzle },
  { name: 'workflow', Icon: Workflow },
  { name: 'form-input', Icon: FormInput },
  { name: 'list-checks', Icon: ListChecks },
  { name: 'list-plus', Icon: ListPlus },
  { name: 'clipboard-list', Icon: ClipboardList },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'wallet', Icon: Wallet },
  { name: 'calendar-check', Icon: CalendarCheck },
  { name: 'calendar-days', Icon: CalendarDays },
  { name: 'users', Icon: Users },
  { name: 'users-2', Icon: Users2 },
  { name: 'user-plus', Icon: UserPlus },
  { name: 'building-2', Icon: Building2 },
  { name: 'bar-chart-3', Icon: BarChart3 },
  { name: 'boxes', Icon: Boxes },
  { name: 'file-text', Icon: FileText },
  { name: 'bell', Icon: Bell },
  { name: 'layout-grid', Icon: LayoutGrid },
  { name: 'palette', Icon: Palette },
  { name: 'trending-up', Icon: TrendingUp },
  { name: 'piggy-bank', Icon: PiggyBank },
  { name: 'megaphone', Icon: Megaphone },
  { name: 'handshake', Icon: Handshake },
];

export function IconPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = ICON_OPTIONS.find((o) => o.name === value);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-full flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 hover:border-slate-300"
      >
        {selected ? (
          <>
            <selected.Icon className="h-4 w-4 text-[#1E2A44] shrink-0" strokeWidth={2} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-slate-400">Choose an icon…</span>
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg p-2 grid grid-cols-7 gap-1">
          {ICON_OPTIONS.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={`flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${
                value === name ? 'border-[#1E2A44] bg-[#1E2A44]/5' : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4 text-[#1E2A44]" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
