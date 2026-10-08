# AIDA × FinDER-Gold-570

Harness isolato e riproducibile per valutare AIDA nella configurazione **perfect
information / gold context** del paper FinDER. Non modifica la knowledge base di AIDA e
non misura il retrieval: ogni prompt contiene le evidenze annotate e la query FinDER.

## Protocollo fissato

- dataset: `Linq-AI-Research/FinDER`;
- revisione: `c4c1b6454aef7f0bb1c37235c7f52ce644642da0`;
- split pubblico: `train`, 5.703 record;
- subset: 570 record, seed `20260804`;
- esclusione documentata: 7 record con gold answer vuota;
- stratificazione: `category × normalized type`;
- alias normalizzato: `Subtract` → `Subtraction`;
- ranking entro lo strato: SHA-256 di `seed:_id`;
- allocazione: largest remainder proporzionale;
- esecuzione: una domanda alla volta, chat AIDA nuova per record;
- prompt: evidenze gold numerate, poi query, senza ulteriori istruzioni benchmark.

`data/manifest.json` contiene distribuzioni, revisioni, esclusioni e hash. La lista
pubblicabile degli identificatori è in `data/finder_gold_570_ids.json`.

## Installazione

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock.txt
pip install -e . --no-deps
```

## Download e subset

```bash
finder-eval download --output-dir data
```

## Generazione AIDA

Avviare AIDA con il database di test e poi:

```bash
export AIDA_BASE_URL=http://localhost:3000

finder-eval run \
  --data-dir data \
  --retries 4 \
  --cooldown-seconds 2 \
  --output runs/aida-finder-gold-570.jsonl
```

Il JSONL è append-only. Dopo ogni risposta viene rigenerato atomicamente anche
`runs/aida-finder-gold-570.csv`, con domanda, risposta AIDA, gold answer e gold context.
Rilanciando lo stesso comando vengono saltati tutti gli esempi già riusciti.

### Variante senza contesto fornito

Per confrontare AIDA sugli stessi 570 ID passando esclusivamente la domanda:

```bash
finder-eval run \
  --data-dir data \
  --context-mode none \
  --retries 4 \
  --cooldown-seconds 2 \
  --output runs/aida-finder-no-context-570.jsonl
```

Le evidenze gold restano nel file di output esclusivamente per la successiva
valutazione e non entrano nel prompt. Il campo `prompt_contexts_count` vale zero e il
prompt usa la versione `finder-question-only-v1`.

## Valutazione RAGAS del paper

FinDER usa Answer Correctness e Faithfulness. Questo harness usa RAGAS `0.4.3`, i pesi
default `[0.75, 0.25]` di Answer Correctness e riporta sia la scala nativa 0–1 sia la
scala 0–100 usata nelle tabelle del paper.

```bash
export GEMINI_ENDPOINT_URL='https://...:generateContent?key=...'

finder-eval score-ragas \
  --run runs/aida-finder-gold-570.jsonl \
  --output-dir reports/aida-finder-gold-570 \
  --embedding-model gemini-embedding-001 \
  --retries 4 \
  --request-timeout-seconds 120 \
  --max-tokens 16384 \
  --reasoning-effort low \
  --cooldown-seconds 1
```

Anche il giudizio è incrementale e resumable. Le credenziali non vengono salvate. Il
report contiene risultati complessivi e breakdown per categoria, ragionamento
qualitativo/quantitativo e operazione. Al completamento vengono prodotti anche
`ragas_per_item.csv`, con domanda, risposta AIDA, gold answer, contesto e metriche, e
`ragas_summary.csv`, pronto per confrontare più approcci. I valori Faithfulness non
definiti da RAGAS sono lasciati vuoti nel CSV e conteggiati separatamente nel summary.

Il paper non dichiara il modello giudice RAGAS né gli ID del proprio 10%; per questo i
risultati vanno descritti come replica locale su un subset stratificato indipendente.

## Test

```bash
python -m unittest discover -s tests -v
ruff check finder_eval tests
ruff format --check finder_eval tests
```
