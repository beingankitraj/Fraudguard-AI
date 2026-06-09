import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Upload,
  Bell,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { path: '/Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/Transactions', label: 'Transactions', icon: List },
  { path: '/Upload', label: 'Upload & Analyze', icon: Upload },
  { path: '/UserProfiles', label: 'User Profiles', icon: Users },
  { path: '/Alerts', label: 'Alerts', icon: Bell },
];

export default function Sidebar({ collapsed, onToggle, alertCount }) {
  const location = useLocation();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-40 transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight">FraudGuard</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Detection System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
              {path === '/Alerts' && alertCount > 0 && (
                <Badge className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                  {alertCount}
                </Badge>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse-glow" />
            <span>System Active</span>
          </div>
        </div>
      )}

      {/* Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-card border border-border shadow-sm text-foreground hover:bg-accent"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>
    </aside>
  );
}