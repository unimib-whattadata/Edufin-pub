import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/ui/dialog";

interface ConditionsDialogProps {
  acceptedChatCondition: boolean;
  setAcceptedChatCondition: Dispatch<SetStateAction<boolean>>;
  onDecline: () => void;
  onAccepted?: () => void;
}

const CONDITIONS_KEY = "conditions-v2";

export const ConditionDialog = ({
  acceptedChatCondition,
  setAcceptedChatCondition,
  onDecline,
  onAccepted,
}: ConditionsDialogProps) => {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  return (
    <Dialog open={!acceptedChatCondition}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          onDecline();
        }}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        showCloseButton={false}
        className="border-aida-border bg-aida-surface text-aida-ink max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[480px] sm:rounded-2xl sm:shadow-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-aida-ink text-2xl">
            Prima di iniziare
          </DialogTitle>
          <DialogDescription className="text-aida-ink-muted text-sm leading-relaxed">
            AIDA offre educazione finanziaria, non consulenza personalizzata di
            investimento. Le decisioni di investimento restano responsabilità
            dell&apos;utente.
          </DialogDescription>
        </DialogHeader>
        <details className="border-aida-border-strong bg-aida-surface-muted rounded-xl border p-3">
          <summary className="text-aida-ink cursor-pointer text-sm font-medium">
            Leggi i termini e le condizioni completi
          </summary>
          <div className="text-aida-ink-muted mt-3 max-h-[35dvh] space-y-3 overflow-y-auto pr-2 text-sm leading-relaxed">
            <p>L&apos;Utente prende atto ed accetta espressamente che:</p>
            <p>
              a) i contenuti presentati dal chatbot di <strong>AIEF</strong>{" "}
              denominato “<strong>AIDA</strong>” e gli educatori finanziari che
              operano sul sito, forniscono solo ed esclusivamente servizi di
              educazione finanziaria, <strong>NON</strong> consulenza
              personalizzata di investimento;
            </p>
            <p>
              b) ogni decisione di investimento rimane di esclusiva
              responsabilità dell&apos;Utente;
            </p>
            <p>
              c) AIEF garantisce la qualificazione iniziale degli educatori ma
              non può monitorare costantemente ogni singola attività. Esclusione
              di responsabilità: AIEF non risponde per:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                decisioni di investimento assunte autonomamente
                dall&apos;Utente;
              </li>
              <li>
                danni indiretti, perdite di profitto, danni consequenziali;
              </li>
              <li>
                attività dell&apos;educatore non riconducibili al rapporto con
                AIEF;
              </li>
              <li>
                comportamenti dell&apos;educatore che esulino dall&apos;attività
                educativa autorizzata.
              </li>
            </ul>
            <p>L&apos;utente si impegna espressamente a manlevare AIEF per:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                pretese derivanti da uso improprio delle informazioni educative
                ricevute;
              </li>
              <li>
                azioni legali conseguenti a decisioni di investimento autonome
                dell&apos;Utente;
              </li>
              <li>
                comportamenti dell&apos;educatore espressamente vietati dal
                Codice Deontologico AIEF di cui l&apos;Utente sia stato
                preavvertito.
              </li>
            </ul>
            <p>
              La presente clausola non si applica in caso di dolo o colpa grave
              di AIEF e non pregiudica i diritti inderogabili
              dell&apos;Utente-consumatore ai sensi del D.Lgs. 206/2005.
            </p>
          </div>
        </details>
        <label className="text-aida-ink flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={hasAcknowledged}
            onChange={(event) => setHasAcknowledged(event.target.checked)}
            className="border-aida-border-strong text-aida-brand focus:ring-aida-focus mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <span>Ho letto e accetto i termini e le condizioni.</span>
        </label>
        <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row">
          <button
            className="text-aida-ink-muted hover:bg-aida-surface-muted focus-visible:ring-aida-focus inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={onDecline}
          >
            Non accetto
          </button>
          <button
            className="bg-aida-action text-aida-action-ink hover:bg-aida-action-hover focus-visible:ring-aida-focus inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasAcknowledged}
            onClick={() => {
              localStorage.setItem(CONDITIONS_KEY, "approved");
              setAcceptedChatCondition(true);
              onAccepted?.();
            }}
          >
            Accetta e continua
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
