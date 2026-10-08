"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import IconButton from "@mui/material/IconButton";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className="border-aida-border bg-aida-surface fixed top-4 right-4 z-50 rounded-full border p-1 shadow-sm">
      <IconButton
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        color="inherit"
        className="!text-aida-ink hover:!bg-aida-surface-muted"
      >
        {resolvedTheme === "dark" ? (
          <LightModeRoundedIcon className="!text-yellow-400" />
        ) : (
          <DarkModeRoundedIcon className="!text-aida-ink" />
        )}
      </IconButton>
    </div>
  );
}
