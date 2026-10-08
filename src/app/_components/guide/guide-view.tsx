"use client";

import {
  BookOpenText,
  Compass,
  GraduationCap,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { aidaGuideSections, aidaHero } from "~/app/_components/aida-content";

const sectionIcons = {
  "cos-e": BookOpenText,
  "ruolo-educativo": ShieldCheck,
  "canali-aief": Compass,
  destinatari: Users,
} satisfies Record<(typeof aidaGuideSections)[number]["id"], LucideIcon>;

export const GuideView = () => {
  return (
    <div className="bg-aida-canvas h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <section className="border-aida-border bg-aida-hero text-aida-hero-ink rounded-2xl border p-6 shadow-sm">
          <div className="bg-aida-brand-soft text-aida-brand-strong dark:text-aida-brand mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {aidaHero.title}
          </h1>
          <p className="text-aida-ink-muted mt-3 max-w-3xl text-sm sm:text-base">
            {aidaHero.description}
          </p>
        </section>

        <section className="border-aida-border bg-aida-surface rounded-2xl border p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {aidaGuideSections.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="border-aida-border-strong text-aida-ink hover:border-aida-focus hover:bg-aida-brand-soft hover:text-aida-brand-soft-ink rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              >
                {item.title}
              </a>
            ))}
          </div>
        </section>

        {aidaGuideSections.map((section) => {
          const Icon = sectionIcons[section.id];

          return (
            <section
              key={section.id}
              id={section.id}
              className="border-aida-border bg-aida-surface rounded-2xl border p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <Icon className="text-aida-brand h-5 w-5" />
                <h2 className="text-aida-ink text-lg font-semibold">
                  {section.title}
                </h2>
              </div>
              <div className="text-aida-ink-muted max-w-[68ch] space-y-4 text-sm leading-relaxed">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
