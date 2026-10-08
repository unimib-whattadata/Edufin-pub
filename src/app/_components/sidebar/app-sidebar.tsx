"use client";

import {
  BookOpenText,
  CalendarClock,
  MessageCircle,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { type ComponentType, useEffect, useState } from "react";
import { LogoOfficial } from "~/app/_components/logo-aief";
import { Button } from "~/app/_components/ui/button";
import { cn } from "~/lib/utils";

export type SidebarView = "chat" | "guide" | "booking";

interface AppSidebarProps {
  activeView: SidebarView;
  onOpenAida: () => void | Promise<void>;
  onSelectView: (view: SidebarView) => void;
  onClose?: () => void;
  mobile?: boolean;
}

type MenuItem = {
  id: SidebarView;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
};

export const AppSidebar = ({
  activeView,
  onOpenAida,
  onSelectView,
  onClose,
  mobile = false,
}: AppSidebarProps) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setMounted(true);
  }, []);

  const menuItems: MenuItem[] = [
    {
      id: "chat",
      label: "AIDA",
      icon: MessageCircle,
      onClick: () => {
        void onOpenAida();
        onClose?.();
      },
    },
    {
      id: "guide",
      label: "Guida",
      icon: BookOpenText,
      onClick: () => {
        onSelectView("guide");
        onClose?.();
      },
    },
    {
      id: "booking",
      label: "Prenota appuntamento",
      icon: CalendarClock,
      onClick: () => {
        onSelectView("booking");
        onClose?.();
      },
    },
  ];

  return (
    <aside
      className={cn(
        "border-aida-border bg-aida-surface flex h-full w-full shrink-0 flex-col border-r p-3 sm:pt-0",
        mobile ? "max-w-72" : "sm:w-64",
      )}
      style={
        mobile
          ? {
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }
          : undefined
      }
    >
      {mobile && (
        <div className="mb-2 flex justify-end px-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-aida-ink-muted hover:bg-aida-surface-muted h-8 w-8 rounded-lg"
            onClick={onClose}
            aria-label="Chiudi menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="mb-3 px-1 py-1 sm:h-16 sm:py-0">
        <div className="flex min-h-10 items-center justify-center sm:h-full sm:min-h-0">
          <div className="rounded-lg bg-white p-2">
            <LogoOfficial className="h-auto w-24 sm:w-24" />
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={item.onClick}
              className={cn(
                "h-11 w-full justify-start rounded-xl px-3 transition-colors hover:cursor-pointer",
                isActive
                  ? "bg-aida-brand-soft text-aida-brand-soft-ink hover:bg-aida-surface-muted"
                  : "text-aida-ink hover:bg-aida-surface-muted",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{item.label}</span>
            </Button>
          );
        })}
      </nav>
      <div className="mt-auto pt-4">
        <Button
          variant="ghost"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="text-aida-ink hover:bg-aida-surface-muted h-11 w-full justify-start rounded-xl px-3 hover:cursor-pointer"
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="text-sm">
            {mounted && resolvedTheme === "dark" ? "Tema chiaro" : "Tema scuro"}
          </span>
        </Button>
        <p className="text-aida-ink-muted px-3 pt-3 text-xs leading-relaxed">
          © AIEF {currentYear}. Tutti i diritti riservati.
        </p>
      </div>
    </aside>
  );
};
