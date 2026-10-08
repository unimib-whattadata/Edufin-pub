---
target: Composer della chat AIDA — textarea Domanda per AIDA
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/Fabio_Dadda/Desktop/edufin-new/Edufin/src/app/_components/footer/footer.tsx"
target_fingerprint: "sha256:792ad9c957d15f2f31ecc23cdf03b077b1a2a68c5fc9b9bcdf9353a9843c2450"
target_path: /Users/Fabio_Dadda/Desktop/edufin-new/Edufin/src/app/_components/footer/footer.tsx
timestamp: 2026-09-23T15-46-39Z
slug: src-app-components-footer-footer-tsx
closed: true
---
Method: dual-agent (A: /root/composer_assessment_a · B: /root/composer_assessment_b)

### Oggetto

Composer della chat AIDA, campo “Domanda per AIDA” e azione “Invia messaggio”, valutato sul codice corrente e sulla pagina locale.

### Punteggio di salute UX

| # | Euristica | Punteggio | Evidenza principale |
|---|---|---:|---|
| 1 | Visibilità dello stato | 3/4 | Pulsante disabilitato a campo vuoto e spinner durante la risposta; l’errore però non conserva la bozza. |
| 2 | Corrispondenza col mondo reale | 3/4 | “Hai una domanda?” e l’icona di invio sono familiari; la regola di Invio non è esplicitata. |
| 3 | Controllo e libertà | 2/4 | Non si può recuperare il testo dopo l’errore né annullare un invio già avviato. |
| 4 | Coerenza e standard | 3/4 | Composer convenzionale; Invio e Maiusc+Invio non sono dichiarati nell’interfaccia. |
| 5 | Prevenzione degli errori | 2/4 | Impedisce l’invio vuoto, ma il ramo senza anonId lascia la chat in caricamento. |
| 6 | Riconoscimento invece di memoria | 3/4 | Campo e pulsante hanno nomi accessibili; manca un’indicazione visibile delle scorciatoie. |
| 7 | Flessibilità ed efficienza | 2/4 | Invio e Maiusc+Invio sono supportati, ma il comportamento è nascosto e non considera la composizione IME. |
| 8 | Design essenziale | 3/4 | Composizione semplice e persistente; ombra interna e bordo/ring esterno aggiungono contorni concorrenti. |
| 9 | Recupero dagli errori | 1/4 | In caso di errore la bozza viene persa; senza anonId resta attivo lo stato “generazione”. |
| 10 | Aiuto e documentazione | 2/4 | Nessun suggerimento contestuale vicino al campo per inviare o andare a capo. |
| **Totale** |  | **24/40 — Accettabile (60%)** | Ci sono miglioramenti concreti da fare soprattutto su affidabilità e uso mobile. |

### Specificità e impressione generale

Nel solo composer, la specificità è medio-bassa: textarea, invio e placeholder sono pattern standard da chat. Etichetta AIDA e palette contestualizzano il componente, ma non lo rendono particolarmente riconoscibile come strumento di educazione finanziaria. La semplicità aiuta; la maggiore opportunità è renderlo più affidabile senza complicare l’azione principale.

Il detector Impeccable non ha segnalato problemi (zero rilievi) sui quattro file esaminati. È coerente con la natura dei punti emersi: i problemi principali sono comportamentali e non vengono rilevati dalla scansione automatica.

Sul focus, la cornice blu e il marker nello screenshot allegato sono annotazione del commento, non stile dell’interfaccia. Nella cattura pulita del browser, invece, resta un’ombra molto leggera della textarea (shadow-xs) dentro al bordo/ring del form: il contorno doppio percepito ha quindi una causa reale, ma più tenue di quella indicata dalla selezione.

La verifica visiva è stata possibile in entrambe le modalità, con catture desktop a 2560×960 e 1280×720. Non è stato possibile impostare una viewport mobile; i rilievi mobile qui sotto derivano quindi dalle dimensioni e dagli stili nel codice, non da una cattura mobile.

### Cosa funziona

- Il composer resta disponibile in fondo alla chat e il prompt invita a iniziare subito.
- Il campo e il pulsante hanno aria-label; l’invio vuoto è impedito.
- Durante la generazione lo spinner e il messaggio temporaneo danno un riscontro immediato.

### Problemi prioritari

- **[P1] La bozza scompare se l’invio fallisce.** setInputValue("") avviene prima dell’esito della richiesta e onSettled rimuove anche il messaggio temporaneo. Un errore di rete lascia solo il toast, senza testo da correggere o ritentare. Inoltre, se anonId manca, isGenerating viene attivato ma non c’è una richiesta che lo disattivi. **Fix:** conserva la bozza fino all’esito positivo, ripristinala su errore e verifica anonId prima di entrare nello stato di caricamento. **Comando suggerito:** $impeccable harden.

- **[P2] La convenzione da tastiera è nascosta e può causare invii involontari.** Inviare con Invio e andare a capo con Maiusc+Invio è efficiente per chi lo conosce, ma non viene spiegato; inoltre il gestore non considera event.isComposing, rilevante per chi usa una tastiera con composizione IME. **Fix:** mostra un hint breve, collegalo al campo con aria-describedby e ignora Invio durante una composizione IME. **Comando suggerito:** $impeccable clarify.

- **[P2] Il pulsante di invio è piccolo per il tocco.** La variante icon misura 36×36 px, sotto i 44×44 px comunemente consigliati per un target touch. **Fix:** amplia l’area cliccabile su schermi touch senza ingrandire l’icona. **Comando suggerito:** $impeccable adapt.

- **[P2] Il campo può crescere senza limite.** field-sizing-content insieme a min-h-16, senza un’altezza massima, può sottrarre progressivamente spazio alla conversazione se si incolla un testo lungo, soprattutto su mobile. **Fix:** limita l’altezza e abilita lo scorrimento interno oltre il limite. **Comando suggerito:** $impeccable adapt.

- **[P3] Il focus resta visivamente stratificato.** Il ring del form è più sobrio dopo la modifica, ma il leggero shadow-xs interno della textarea rimane insieme al bordo/ring esterno. **Fix:** rimuovi l’ombra solo nel composer e mantieni un singolo indicatore di focus ben visibile da tastiera. **Comando suggerito:** $impeccable polish.

### Profili da tenere in considerazione

- **Jordan, primo utilizzo:** il placeholder chiarisce cosa fare, ma la regola di Invio non è evidente; potrebbe aspettarsi una nuova riga e inviare la domanda troppo presto.
- **Sam, tastiera o tecnologia assistiva:** i nomi accessibili ci sono; va resa esplicita la convenzione Invio/Maiusc+Invio e verificato che il focus sul contenitore sia percepibile senza contorni ridondanti.
- **Casey, mobile distratto:** il target di invio da 36 px è piccolo; una bozza lunga può inoltre occupare lo spazio utile alla conversazione. Non è stata disponibile una cattura a viewport mobile.

Non ho derivato persona aggiuntive specifiche del progetto: nel repository non risulta una sezione Design Context in AGENTS.md.

### Osservazioni minori

Il placeholder sparisce quando si inizia a scrivere, ma l’etichetta accessibile rimane. Il pulsante disabilitato a campo vuoto è una buona prevenzione; assicurati solo che il suo stato resti chiaramente distinguibile in entrambi i temi.

### Domande di design

- È preferibile mantenere Invio come invio immediato, o dare priorità all’andare a capo e lasciare l’invio al pulsante?
- Quante righe dovrebbe mostrare il composer prima di scorrere al suo interno?
- Dopo un errore di rete è più rassicurante ripristinare la bozza nel campo o mostrarla come messaggio non inviato con un’azione “Riprova”?
