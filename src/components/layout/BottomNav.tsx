import { Home, Clock, Users, Shuffle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

const tabs = [
  { to: '/',          icon: Home,    label: 'Home',    exact: true  },
  { to: '/teams',     icon: Users,   label: 'Teams',   exact: false },
  { to: '/team-gen',  icon: Shuffle, label: 'Squad',   exact: false },
  { to: '/history',   icon: Clock,   label: 'History', exact: false },
];

export function BottomNav() {
  return (
    <nav className="
      flex items-stretch
      glass border-t border-white/[0.07]
      shadow-[0_-2px_20px_0_rgb(0_0_0/0.4)]
      pb-safe
    ">
      {tabs.map(({ to, icon: Icon, label, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className="flex flex-1 flex-col items-center justify-center py-2 min-h-[56px]"
        >
          {({ isActive }) => (
            <div className={cn(
              'flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200',
              isActive
                ? 'bg-gold/[0.12] text-gold'
                : 'text-muted hover:text-white',
            )}>
              <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn('text-xs font-semibold leading-none', isActive ? 'text-gold' : 'text-muted')}>
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
