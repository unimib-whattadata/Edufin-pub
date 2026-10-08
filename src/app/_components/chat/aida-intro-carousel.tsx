"use client";

import { ArrowLeft, ArrowRight, Check, GraduationCap, X } from "lucide-react";
import { useState } from "react";
import {
  aidaIntroSlides,
  aidaQuestionStarters,
} from "~/app/_components/aida-content";
import { Button } from "~/app/_components/ui/button";
import { cn } from "~/lib/utils";

interface AidaIntroCarouselProps {
  open: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const AidaIntroCarousel = ({
  open,
  onClose,
  onSelectPrompt,
}: AidaIntroCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = aidaIntroSlides[activeIndex] ?? aidaIntroSlides[0];
  const isFirstSlide = activeIndex === 0;
  const isLastSlide = activeIndex === aidaIntroSlides.length - 1;

  if (!open) return null;

  const goToPreviousSlide = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const goToNextSlide = () => {
    if (isLastSlide) {
      onClose();
      return;
    }

    setActiveIndex((current) =>
      Math.min(current + 1, aidaIntroSlides.length - 1),
    );
  };

  return (
    <div className="bg-aida-canvas/95 absolute inset-0 z-20 flex items-center justify-center p-4 backdrop-blur-sm">
      <section
        className="border-aida-border bg-aida-surface text-aida-ink relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-6"
        aria-label="Introduzione ad AIDA"
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-aida-ink-muted hover:bg-aida-surface-muted hover:text-aida-ink absolute top-3 right-3 h-8 w-8 rounded-full"
          onClick={onClose}
          aria-label="Chiudi introduzione"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="mb-5 flex items-center gap-3 pr-9">
          <div className="bg-aida-brand-soft text-aida-brand-strong dark:text-aida-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-aida-brand-strong dark:text-aida-brand text-xs font-semibold tracking-wide uppercase">
              Benvenuto in AIDA
            </p>
            <p className="text-aida-ink-muted text-xs">
              {activeIndex + 1} di {aidaIntroSlides.length}
            </p>
          </div>
        </div>

        <div aria-live="polite" className="min-h-52 sm:min-h-44">
          <h2 className="text-aida-ink text-2xl leading-tight font-bold sm:text-3xl">
            {activeSlide.title}
          </h2>
          <p className="text-aida-ink-muted mt-4 text-sm leading-relaxed sm:text-base">
            {activeSlide.description}
          </p>
          {isLastSlide && (
            <div className="mt-5">
              <p className="text-aida-ink mb-2 text-sm font-semibold">
                Per iniziare, puoi chiedere di:
              </p>
              <div className="flex flex-wrap gap-2">
                {aidaQuestionStarters.map((starter) => (
                  <Button
                    key={starter.label}
                    variant="outline"
                    className="h-auto min-h-10 rounded-xl px-3 py-2 text-left text-sm whitespace-normal"
                    onClick={() => onSelectPrompt(starter.prompt)}
                  >
                    {starter.label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="link"
                className="mt-2 min-h-10 px-0 text-sm"
                onClick={onClose}
              >
                Chiedi con parole tue
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-2" aria-label="Avanzamento introduzione">
            {aidaIntroSlides.map((slide, index) => (
              <button
                key={slide.title}
                className={cn(
                  "h-2.5 rounded-full transition-all hover:cursor-pointer",
                  index === activeIndex
                    ? "bg-aida-brand w-8"
                    : "bg-aida-border-strong hover:bg-aida-ink-muted w-2.5",
                )}
                onClick={() => setActiveIndex(index)}
                aria-label={`Vai alla slide ${index + 1}`}
                aria-current={index === activeIndex ? "step" : undefined}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={goToPreviousSlide}
              disabled={isFirstSlide}
              aria-label="Slide precedente"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button className="h-9 rounded-full px-4" onClick={goToNextSlide}>
              {isLastSlide ? (
                <>
                  <Check className="h-4 w-4" />
                  Inizia
                </>
              ) : (
                <>
                  Avanti
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
