export const aidaHero = {
  kicker: "Guida AIDA",
  title: "L'educazione finanziaria che parla con te",
  description:
    "AIDA è l'assistente digitale di AIEF, progettato per spiegare in modo semplice e accessibile i principali temi di finanza, con contenuti validati dall'Università degli Studi di Milano-Bicocca.",
};

export const aidaGuideSections = [
  {
    id: "cos-e",
    title: "Cos'è AIDA",
    paragraphs: [
      "AIDA è un assistente digitale progettato per spiegare la finanza in modo semplice, chiaro e accessibile a tutti. Non è un consulente finanziario, non fornisce raccomandazioni personalizzate e non suggerisce cosa comprare o vendere: il suo ruolo non è guidare direttamente le scelte, ma aiutare le persone a comprendere meglio i concetti che stanno alla base di quelle decisioni.",
      "Il progetto nasce dalla collaborazione tra AIEF (Associazione Italiana Educatori Finanziari) e l'Università degli Studi di Milano-Bicocca, unendo competenze di educazione finanziaria e rigore accademico. Questo significa che ogni contenuto è pensato non già per essere di facile comprensione, ma anche per essere corretto, verificato e coerente con i principi della disciplina.",
    ],
  },
  {
    id: "ruolo-educativo",
    title: "Il ruolo educativo di AIDA",
    paragraphs: [
      "In virtù del suo ruolo educativo, AIDA non fornisce raccomandazioni personalizzate di investimento e non sostituisce un professionista. Rimane focalizzata sui contenuti informativi e, quando necessario, indirizza verso fonti ufficiali o suggerisce di rivolgersi a un esperto qualificato.",
      "In questo modo AIDA mantiene il proprio ruolo educativo e informativo, lasciando la gestione operativa e i casi specifici al supporto umano qualificato.",
    ],
  },
  {
    id: "canali-aief",
    title: "Canali AIEF",
    paragraphs: [
      "Per tutto ciò che riguarda AIEF, come formazione, certificazioni o iscrizione al registro, AIDA non si sostituisce a un assistente virtuale o al supporto diretto dell'associazione: fornisce indicazioni di primo livello e rimanda ai canali ufficiali, ove necessario.",
      "Per informazioni più specifiche o di secondo livello, è possibile contattare direttamente AIEF attraverso il numero 389 997 5672 ovvero l'indirizzo e-mail segreteria@aief.eu.",
    ],
  },
  {
    id: "destinatari",
    title: "A chi si rivolge",
    paragraphs: [
      "AIDA è pensata per un pubblico ampio: si rivolge a chi vuole migliorare la propria alfabetizzazione finanziaria, alle famiglie che desiderano gestire meglio budget e obiettivi economici, ai giovani e agli studenti che si avvicinano a questi temi, ma anche a chiunque cerchi una guida introduttiva, chiara e indipendente per orientarsi nella finanza di base.",
      "AIDA è particolarmente utile quando si vuole comprendere meglio un argomento finanziario prima di prendere decisioni. Non offre soluzioni preconfezionate, ma aiuta a leggere e interpretare le informazioni, fornendo un orientamento educativo che aumenta la consapevolezza.",
    ],
  },
] as const;

export const aidaIntroSlides = [
  {
    title: aidaHero.title,
    description: aidaHero.description,
  },
  {
    title: "Cos'è AIDA",
    description:
      "Un assistente digitale per spiegare la finanza in modo semplice, chiaro e accessibile. Non dà raccomandazioni personalizzate e non suggerisce cosa comprare o vendere: aiuta a capire meglio i concetti alla base delle decisioni.",
  },
  {
    title: "A chi si rivolge",
    description:
      "È pensata per cittadini, famiglie, giovani, studenti e per chiunque cerchi una guida introduttiva, chiara e indipendente per orientarsi nella finanza di base.",
  },
] as const;

export const aidaQuestionStarters = [
  {
    label: "Budget familiare",
    prompt: "Come posso impostare un budget familiare mensile?",
  },
  {
    label: "Risparmio",
    prompt: "Quali sono i principi base per costruire un fondo di emergenza?",
  },
  {
    label: "Rischio",
    prompt: "Che cosa significa diversificare e come incide sul rischio?",
  },
  {
    label: "Mutuo",
    prompt: "Qual è la differenza tra un mutuo a tasso fisso e variabile?",
  },
] as const;
