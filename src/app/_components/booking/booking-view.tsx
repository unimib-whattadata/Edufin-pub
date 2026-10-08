"use client";

import { CalendarClock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "~/app/_components/ui/button";
import { Label } from "~/app/_components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/app/_components/ui/radio-group";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type BookingArea =
  | "PROTEZIONE"
  | "FISCALITA"
  | "RISPARMIO/INVESTIMENTI"
  | "FINANZIAMENTI";

const bookingAreas: Array<{
  value: BookingArea;
  label: string;
  description: string;
}> = [
  {
    value: "PROTEZIONE",
    label: "Protezione e Previdenza",
    description: "Tutela personale, familiare e pianificazione previdenziale.",
  },
  {
    value: "FISCALITA",
    label: "Fiscalità",
    description:
      "Temi fiscali e inquadramento generale delle scelte economiche.",
  },
  {
    value: "RISPARMIO/INVESTIMENTI",
    label: "Risparmio e Investimenti",
    description: "Gestione del risparmio e principi base sugli investimenti.",
  },
  {
    value: "FINANZIAMENTI",
    label: "Finanziamenti",
    description: "Mutui, prestiti e strumenti di finanziamento personali.",
  },
];

type FormErrors = {
  name?: string;
  surname?: string;
  email?: string;
  area?: string;
  conditions?: string;
};

export const BookingView = () => {
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState<BookingArea | undefined>(undefined);
  const [acceptedConditions, setAcceptedConditions] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const normalizedName = name.trim();
  const normalizedSurname = surname.trim();
  const normalizedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isFormReadyToSubmit =
    normalizedName.length > 0 &&
    normalizedSurname.length > 0 &&
    normalizedEmail.length > 0 &&
    isEmailValid &&
    area !== undefined &&
    acceptedConditions;
  const missingBookingRequirements = [
    !normalizedName,
    !normalizedSurname,
    !normalizedEmail || !isEmailValid,
    !area,
    !acceptedConditions,
  ].filter(Boolean).length;

  const sendEmailMutation = api.email.sendEmail.useMutation({
    onSuccess: () => {
      toast.success(
        "Richiesta inviata correttamente. Un educatore finanziario ti contatterà via mail.",
      );
      setName("");
      setSurname("");
      setEmail("");
      setArea(undefined);
      setAcceptedConditions(false);
      setErrors({});
    },
    onError: () => {
      toast.error("Invio non riuscito. Riprova tra qualche minuto.");
    },
  });

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!normalizedName) {
      nextErrors.name = "Inserisci il nome.";
    }

    if (!normalizedSurname) {
      nextErrors.surname = "Inserisci il cognome.";
    }

    if (!normalizedEmail) {
      nextErrors.email = "Inserisci l'email.";
    } else if (!isEmailValid) {
      nextErrors.email = "Inserisci un'email valida.";
    }

    if (!area) {
      nextErrors.area = "Seleziona una delle 4 aree.";
    }

    if (!acceptedConditions) {
      nextErrors.conditions =
        "Per continuare devi accettare i termini e le condizioni.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) return;
    if (!area) return;

    sendEmailMutation.mutate({
      name: name.trim(),
      surname: surname.trim(),
      to: email.trim(),
      area,
    });
  };

  return (
    <div className="bg-aida-canvas h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="border-aida-border bg-aida-surface w-full rounded-2xl border p-6 shadow-sm sm:p-8">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="text-aida-brand h-5 w-5" />
            <h2 className="text-aida-ink text-xl font-semibold">
              Prenota appuntamento
            </h2>
          </div>
          <p className="text-aida-ink-muted text-sm">
            Compila il form per richiedere un appuntamento gratuito di 30 minuti
            con un educatore finanziario.
          </p>
          <section
            aria-labelledby="booking-next-steps-title"
            className="border-aida-border-strong bg-aida-brand-soft text-aida-brand-soft-ink mt-4 rounded-xl border px-4 py-3"
          >
            <h3 id="booking-next-steps-title" className="text-sm font-semibold">
              Cosa succede dopo
            </h3>
            <p className="mt-1 text-sm leading-relaxed">
              Inviamo nome, cognome ed email all&apos;educatore dell&apos;area
              scelta. L&apos;educatore potrà ricontattarti via email per
              concordare l&apos;incontro gratuito di 30 minuti.
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              L&apos;invio non conferma una data e non è indicato un tempo di
              risposta garantito.
            </p>
          </section>

          <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="booking-name" className="text-aida-ink">
                  Nome
                </Label>
                <input
                  id="booking-name"
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  className={cn(
                    "bg-aida-surface text-aida-ink placeholder:text-aida-ink-muted focus:ring-aida-focus w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:outline-none",
                    errors.name
                      ? "border-red-600 dark:border-red-400"
                      : "border-aida-border-strong",
                  )}
                  placeholder="Inserisci il tuo nome"
                  disabled={sendEmailMutation.isPending}
                />
                {errors.name && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking-surname" className="text-aida-ink">
                  Cognome
                </Label>
                <input
                  id="booking-surname"
                  type="text"
                  value={surname}
                  onChange={(event) => {
                    setSurname(event.target.value);
                    if (errors.surname) {
                      setErrors((prev) => ({ ...prev, surname: undefined }));
                    }
                  }}
                  className={cn(
                    "bg-aida-surface text-aida-ink placeholder:text-aida-ink-muted focus:ring-aida-focus w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:outline-none",
                    errors.surname
                      ? "border-red-600 dark:border-red-400"
                      : "border-aida-border-strong",
                  )}
                  placeholder="Inserisci il tuo cognome"
                  disabled={sendEmailMutation.isPending}
                />
                {errors.surname && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {errors.surname}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-email" className="text-aida-ink">
                Email
              </Label>
              <input
                id="booking-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                className={cn(
                  "bg-aida-surface text-aida-ink placeholder:text-aida-ink-muted focus:ring-aida-focus w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:outline-none",
                  errors.email
                    ? "border-red-600 dark:border-red-400"
                    : "border-aida-border-strong",
                )}
                placeholder="nome.cognome@email.it"
                disabled={sendEmailMutation.isPending}
              />
              {errors.email && (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-aida-ink text-sm font-medium">
                Area di interesse
              </p>
              <RadioGroup
                value={area}
                onValueChange={(value) => {
                  setArea(value as BookingArea);
                  if (errors.area) {
                    setErrors((prev) => ({ ...prev, area: undefined }));
                  }
                }}
                className="grid gap-2"
                disabled={sendEmailMutation.isPending}
              >
                {bookingAreas.map((item) => (
                  <Label
                    key={item.value}
                    htmlFor={`booking-area-${item.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                      area === item.value
                        ? "border-aida-brand bg-aida-brand-soft"
                        : "border-aida-border-strong bg-aida-surface hover:bg-aida-surface-muted",
                    )}
                  >
                    <RadioGroupItem
                      id={`booking-area-${item.value}`}
                      value={item.value}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="text-aida-ink block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span className="text-aida-ink-muted block text-xs">
                        {item.description}
                      </span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              {errors.area && (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {errors.area}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <details className="border-aida-border-strong bg-aida-surface rounded-xl border p-3">
                <summary className="text-aida-ink cursor-pointer text-sm font-medium">
                  Visualizza termini e condizioni
                </summary>
                <div className="text-aida-ink-muted mt-3 max-h-56 overflow-y-auto pr-2 text-sm">
                  <p className="mb-3">
                    L&apos;Utente prende atto ed accetta espressamente che:
                  </p>
                  <p className="mb-3">
                    a) I contenuti presentati dal chatbot di{" "}
                    <strong>AIEF</strong> denominato <strong>AIDA</strong> e gli
                    educatori finanziari che operano sul sito, forniscono solo
                    ed esclusivamente servizi di educazione finanziaria,{" "}
                    <strong>NON</strong> consulenza personalizzata di
                    investimento;
                  </p>
                  <p className="mb-3">
                    b) Ogni decisione di investimento rimane di esclusiva
                    responsabilita dell&apos;Utente;
                  </p>
                  <p className="mb-3">
                    c) AIEF garantisce la qualificazione iniziale degli
                    educatori ma non puo monitorare costantemente ogni singola
                    attivita. Esclusione di responsabilita: AIEF non risponde
                    per:
                  </p>
                  <ul className="mb-3 space-y-1">
                    <li>
                      - Decisioni di investimento assunte autonomamente
                      dall&apos;Utente;
                    </li>
                    <li>
                      - Danni indiretti, perdite di profitto, danni
                      consequenziali;
                    </li>
                    <li>
                      - Attivita dell&apos;educatore non riconducibili al
                      rapporto con AIEF;
                    </li>
                    <li>
                      - Comportamenti dell&apos;educatore che esulino
                      dall&apos;attivita educativa autorizzata.
                    </li>
                  </ul>
                  <p className="mb-2">
                    L&apos;Utente si impegna espressamente a manlevare AIEF per:
                  </p>
                  <ul className="space-y-1">
                    <li>
                      - Pretese derivanti da uso improprio delle informazioni
                      educative ricevute;
                    </li>
                    <li>
                      - Azioni legali conseguenti a decisioni di investimento
                      autonome dell&apos;Utente;
                    </li>
                    <li>
                      - Comportamenti dell&apos;educatore espressamente vietati
                      dal Codice Deontologico AIEF.
                    </li>
                  </ul>
                  <p className="mt-3">
                    La presente clausola non si applica in caso di dolo o colpa
                    grave di AIEF e non pregiudica i diritti inderogabili
                    dell&apos;Utente-consumatore ai sensi del D.Lgs. 206/2005.
                  </p>
                </div>
              </details>

              <label className="text-aida-ink flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedConditions}
                  onChange={(event) => {
                    setAcceptedConditions(event.target.checked);
                    if (errors.conditions) {
                      setErrors((prev) => ({ ...prev, conditions: undefined }));
                    }
                  }}
                  className="border-aida-border-strong text-aida-brand focus:ring-aida-focus mt-0.5 h-4 w-4 rounded"
                  disabled={sendEmailMutation.isPending}
                />
                <span>
                  Ho letto e accetto i termini e le condizioni per la richiesta
                  dell&apos;appuntamento.
                </span>
              </label>
              {errors.conditions && (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {errors.conditions}
                </p>
              )}
            </div>

            <div className="pt-1">
              <p
                id="booking-submit-hint"
                aria-live="polite"
                className="text-aida-ink-muted mb-3 text-xs"
              >
                {isFormReadyToSubmit
                  ? "Tutto pronto: invia la richiesta per essere ricontattato via email."
                  : `Completa ancora ${missingBookingRequirements} su 5 requisiti per inviare la richiesta.`}
              </p>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                aria-describedby="booking-submit-hint"
                disabled={sendEmailMutation.isPending || !isFormReadyToSubmit}
              >
                {sendEmailMutation.isPending
                  ? "Invio in corso..."
                  : "Invia richiesta"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
