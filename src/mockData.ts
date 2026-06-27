import { AnalysisPayload } from "./types";

export const defaultAnalysis: AnalysisPayload = {
  url: "https://zorgportaal-nederland.nl",
  metadata: {
    analyzedAt: "2026-06-27T00:00:00Z",
    isDemoMode: false,
    usedGeminiForClaude: false,
    usedGeminiForOpenAI: false,
    hasRealAnthropic: true,
    hasRealOpenAI: true
  },
  consensus: {
    algehele_score: 74,
    classificatie: "Goed",
    aanbeveling: "Geschikt met maatregelen",
    verdictIcon: "✅",
    sterkstDomein: "AVG / GDPR Compliance",
    zwakstDomein: "Toegankelijkheid (WCAG)",
    scores: {
      gdpr: 82,
      databeveiliging: 76,
      nen7510: 71,
      iso27002: 75,
      toegankelijkheid: 60,
      transparantie: 80,
      incidentbeheer: 74
    },
    agreementPercentage: 96
  },
  model1: {
    naam: "Claude (Security Expert)",
    isFallback: false,
    algehele_score: 72,
    classificatie: "Goed",
    aanbeveling: "Geschikt met maatregelen",
    samenvatting: "De technische beveiligingsbeoordeling toont een solide configuratie. HTTPS is correct geïmplementeerd met moderne cipher suites (TLS 1.3) en HSTS is actief. Toegangscontrole is aanwezig, maar NEN 7510 specifieke logging-eisen voor het inzien van medische dossiers konden niet volledig worden geverifieerd vanaf de buitenkant. Er is een actieve tweefactorauthenticatie (2FA) vereist voor al het medische personeel.",
    model_perspectief: "Als Security Expert focus ik op technische controls. De transportbeveiliging is van uitstekende kwaliteit, maar we missen inzicht in de diepere database-isolatie en de onafhankelijke penetratietest-rapporten.",
    scores: {
      gdpr: 78,
      databeveiliging: 80,
      nen7510: 68,
      iso27002: 74,
      toegankelijkheid: 58,
      transparantie: 76,
      incidentbeheer: 70
    }
  },
  model2: {
    naam: "GPT-4o (Compliance Auditor)",
    isFallback: false,
    algehele_score: 76,
    classificatie: "Goed",
    aanbeveling: "Geschikt met maatregelen",
    samenvatting: "Het juridische framework en de AVG-documentatie zijn uitstekend uitgewerkt. Er is een duidelijk privacybeleid dat expliciet ingaat op patiëntenrechten en de verwerking van medische gegevens conform AVG Artikel 9. De verwerkersovereenkomst (DPA) voldoet aan de basale eisen van Artikel 28. Echter, de toegankelijkheid (WCAG) van het patiëntenportaal toont enkele tekortkomingen voor visueel beperkte gebruikers.",
    model_perspectief: "Als conservatieve Legal Auditor let ik streng op de administratieve en contractuele verplichtingen. De juridische basis is solide, maar de WCAG-toegankelijkheid en helderheid over de verwerkingsketen (sub-verwerkers) behoeven extra aandacht.",
    scores: {
      gdpr: 86,
      databeveiliging: 72,
      nen7510: 74,
      iso27002: 76,
      toegankelijkheid: 62,
      transparantie: 84,
      incidentbeheer: 78
    }
  },
  risks: [
    {
      titel: "Mogelijke sub-verwerkers buiten de EER",
      ernst: "Middel",
      toelichting: "Het privacyreglement vermeldt het gebruik van een analytics-sub-verwerker die gevestigd is in de Verenigde Staten, wat risico's op het gebied van de WGBO en de doorgifte van metadata met zich meebrengt.",
      model: "GPT-4o"
    },
    {
      titel: "Ontbreken van openbare NEN 7510 verklaring",
      ernst: "Middel",
      toelichting: "Er wordt nergens expliciet melding gemaakt van een NEN 7510:2017 certificering of onafhankelijke auditverklaring, wat essentieel is voor Nederlandse zorginstellingen.",
      model: "Claude"
    },
    {
      titel: "Toegankelijkheidsknelpunten in de patiënt-UI",
      ernst: "Laag",
      toelichting: "De interface voldoet op meerdere kritieke punten niet volledig aan de WCAG 2.1 AA-richtlijnen (met name contrastverhoudingen en toetsenbordnavigatie), wat de toegang voor bepaalde groepen patiënten bemoeilijkt.",
      model: "GPT-4o"
    },
    {
      titel: "Onduidelijkheid over logging retentieperiode",
      ernst: "Laag",
      toelichting: "De bewaartermijn van technische logs en audit-trails (cruciaal voor NEN 7510 en AVG) wordt in de publieke documenten niet gespecificeerd.",
      model: "Claude"
    }
  ],
  positives: [
    {
      titel: "Correcte HTTPS- & TLS-beveiliging",
      toelichting: "De applicatie dwingt HTTPS af en maakt gebruik van up-to-date encryptieprotocollen (TLS 1.3), waarmee gegevens in transit afdoende worden beschermd.",
      model: "Claude"
    },
    {
      titel: "Actueel en zorg-specifiek Privacybeleid",
      toelichting: "Het privacyreglement bevat specifieke bepalingen omtrent medische gegevens conform AVG Artikel 9 en de Wet op de geneeskundige behandelingsovereenkomst (WGBO).",
      model: "GPT-4o"
    },
    {
      titel: "Verplichte Multi-Factor Authenticatie",
      toelichting: "Toegangscontrolemechanismen vereisen verplichte MFA voor beheerders en zorgverleners, wat ongeoorloofde toegang effectief blokkeert.",
      model: "Claude"
    },
    {
      titel: "Heldere procedure voor datalekken",
      toelichting: "De documentatie omschrijft een gedegen proces voor het melden van datalekken bij de Autoriteit Persoonsgegevens (AP) binnen 72 uur.",
      model: "GPT-4o"
    }
  ]
};
