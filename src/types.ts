export interface ScoreBreakdown {
  gdpr: number;
  databeveiliging: number;
  nen7510: number;
  iso27002: number;
  toegankelijkheid: number;
  transparantie: number;
  incidentbeheer: number;
}

export interface ModelDetail {
  naam: string;
  isFallback: boolean;
  algehele_score: number;
  classificatie: string;
  aanbeveling: string;
  samenvatting: string;
  model_perspectief: string;
  gebaseerd_op?: string;
  scores: ScoreBreakdown;
}

export interface RiskFinding {
  titel: string;
  ernst: "Laag" | "Middel" | "Hoog" | "Kritiek";
  toelichting: string;
  model: string;
  bron?: string;
}

export interface PositiveFinding {
  titel: string;
  toelichting: string;
  model: string;
  bron?: string;
}

// --- Opgehaalde, objectief meetbare signalen van de doel-URL ---
export interface SecurityHeaderItem {
  naam: string;
  aanwezig: boolean | null;
  waarde: string | null;
}

export interface PrivacySignalItem {
  key: string;
  naam: string;
  gevonden: boolean;
}

export interface CertItem {
  norm: string;
  op: string;
}

export interface Signals {
  domein: string | null;
  finalUrl: string | null;
  fetchedAt: string;
  reachable: string; // "gevonden" | "afwezig" | "onbekend"
  https: {
    status: string;
    httpsBereikbaar: boolean | null;
    httpDoorverwijzing: boolean | null;
    tlsOk: boolean | null;
    bron: string;
  };
  securityHeaders: {
    status: string;
    items: SecurityHeaderItem[];
    aanwezig: number;
    totaal: number;
    bron: string;
  };
  securityTxt: {
    status: string;
    gevondenOp: string | null;
    heeftContact: boolean | null;
    heeftPolicy: boolean | null;
    bron: string;
  };
  privacybeleid: {
    status: string;
    gevondenOp: string | null;
    items: PrivacySignalItem[];
    bron: string;
  };
  certificeringen: {
    status: string; // "geclaimd op eigen site" | "niet gevonden" | "onbekend"
    gevonden: CertItem[];
    trefwoorden: string[];
    bron: string;
  };
  metaInfo: {
    taal: string | null;
    heeftContactOfColofon: boolean | null;
    euTld: boolean | null;
    bron: string;
  };
  fouten: string[];
  durationMs?: number;
}

export interface AnalysisPayload {
  url: string;
  metadata: {
    analyzedAt: string;
    isDemoMode: boolean;
    usedGeminiForClaude: boolean;
    usedGeminiForOpenAI: boolean;
    hasRealAnthropic: boolean;
    hasRealOpenAI: boolean;
  };
  consensus: {
    algehele_score: number;
    classificatie: string;
    aanbeveling: string;
    verdictIcon: string;
    sterkstDomein: string;
    zwakstDomein: string;
    scores: ScoreBreakdown;
    agreementPercentage: number;
  };
  model1: ModelDetail;
  model2: ModelDetail;
  risks: RiskFinding[];
  positives: PositiveFinding[];
  signals?: Signals | null;
  verificatie?: Verificatie | null;
}

// --- Verifieerbare NEN 7510-registerverwijzing (puur informatief, geen score-effect) ---
export interface Verificatie {
  nenRegisterUrl: string;
  zoekhint: string;
  claimt: { nen7510: boolean; iso: boolean };
  disclaimer: string;
  beinvloedtScore: boolean;
  status: "nen7510-claim" | "iso-claim" | "geen-claim";
  toonRegisterLink: boolean;
  titel: string;
  boodschap: string;
}
