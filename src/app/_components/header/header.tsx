"use client";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import Tooltip from "@mui/material/Tooltip";
import { cn } from "~/lib/utils";
import Image from "next/image";

interface HeaderProps {
  isOnline: boolean | undefined;
  onToggleSidebar: () => void;
  onClickNewChat: () => void;
}

export const Header = (props: HeaderProps) => {
  const { isOnline, onToggleSidebar, onClickNewChat } = props;

  return (
    <header className="bg-aida-header text-aida-header-ink flex shrink-0 items-center gap-0 px-4 py-2 shadow-sm">
      <button
        className="text-aida-header-ink/80 hover:bg-aida-surface-muted hover:text-aida-header-ink focus-visible:ring-aida-focus mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 sm:hidden"
        onClick={onToggleSidebar}
        aria-label="Apri o chiudi menu laterale"
      >
        <MenuRoundedIcon className="h-5 w-5" />
      </button>
      <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center">
        <Image
          src="/bot_logo_light.png"
          alt="AIDA"
          width={48}
          height={38}
          className="h-9 w-10 object-contain dark:hidden"
        />
        <Image
          src="/bot_logo_dark.png"
          alt="AIDA"
          width={48}
          height={38}
          className="hidden h-9 w-10 object-contain dark:block"
        />
      </div>
      <div className="flex flex-1 flex-col">
        <span className="truncate text-lg font-bold">AIDA</span>
        <div
          role="status"
          aria-live="polite"
          className="mt-0.5 flex items-center gap-1"
        >
          <span
            aria-hidden="true"
            className={cn(
              "border-aida-header h-3 w-3 rounded-full border-2",
              isOnline === undefined
                ? "bg-amber-600 dark:bg-amber-400"
                : isOnline
                  ? "bg-green-700 dark:bg-green-400"
                  : "bg-red-700 dark:bg-red-400",
            )}
          ></span>
          <span className="text-aida-header-ink/80 text-xs">
            {isOnline === undefined
              ? "Sto connettendo..."
              : isOnline
                ? "Online"
                : "Offline"}
          </span>
          {isOnline === false && (
            <Tooltip
              title="AIDA è momentaneamente non disponibile e potrebbe non rispondere ai messaggi. Prova ad aggiornare la pagina più tardi."
              arrow
            >
              <button
                type="button"
                aria-label="Perché AIDA è offline?"
                className="text-aida-header-ink/80 hover:bg-aida-surface-muted hover:text-aida-header-ink focus-visible:ring-aida-focus ml-0.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <InfoOutlinedIcon className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      <Tooltip title="Nuova chat" arrow>
        <button
          className="bg-aida-action text-aida-action-ink hover:bg-aida-action-hover focus-visible:ring-aida-focus ml-2 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 sm:px-3 sm:text-sm"
          onClick={onClickNewChat}
          aria-label="Nuova chat"
        >
          <AddRoundedIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova chat</span>
        </button>
      </Tooltip>
    </header>
  );
};
