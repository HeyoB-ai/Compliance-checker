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
  scores: ScoreBreakdown;
}

export interface RiskFinding {
  titel: string;
  ernst: "Laag" | "Middel" | "Hoog" | "Kritiek";
  toelichting: string;
  model: string;
}

export interface PositiveFinding {
  titel: string;
  toelichting: string;
  model: string;
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
}
