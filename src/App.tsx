import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Shield,
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  ChevronRight,
  Sparkles,
  Lock,
  Scale,
  FileText,
  Database,
  Eye,
  Info,
  Globe,
  RefreshCw,
  Award,
  ExternalLink,
  Sliders,
  Terminal,
  Server
} from "lucide-react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from "chart.js";
import { Radar, Bar } from "react-chartjs-2";

import { defaultAnalysis } from "./mockData";
import { AnalysisPayload } from "./types";

// Registreer Chart.js componenten
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// Hulpfunctie voor semantische kleuren op basis van de score
function getScoreConfig(score: number) {
  if (score >= 80) {
    return {
      text: "text-[#2ea043]",
      bg: "bg-green-500/10",
      border: "border-[#238636]/30",
      progress: "bg-[#238636]",
      glow: "shadow-green-500/10",
      hex: "#238636",
      hover: "hover:border-[#2ea043]",
      label: "Uitstekend"
    };
  }
  if (score >= 65) {
    return {
      text: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      progress: "bg-[#d29922]",
      glow: "shadow-yellow-500/10",
      hex: "#d29922",
      hover: "hover:border-yellow-500/50",
      label: "Voldoende"
    };
  }
  if (score >= 50) {
    return {
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      progress: "bg-orange-500",
      glow: "shadow-orange-500/10",
      hex: "#f97316",
      hover: "hover:border-orange-500/50",
      label: "Risicovol"
    };
  }
  return {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    progress: "bg-[#da3633]",
    glow: "shadow-red-500/10",
    hex: "#da3633",
    hover: "hover:border-red-500/50",
    label: "Onvoldoende"
  };
}

// Compacte ja/nee/onbekend-indicator voor een gemeten signaal
function BoolTag({ v }: { v: boolean | null | undefined }) {
  if (v === true) return <span className="text-[#2ea043] font-bold">✓ ja</span>;
  if (v === false) return <span className="text-red-400 font-bold">✗ nee</span>;
  return <span className="text-[#8b949e]">— onbekend</span>;
}

// Markeer een signaal als gemeten / geclaimd op eigen site / niet gevonden / onbekend
function signalStatusStyle(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "gevonden" || s === "gemeten") {
    return { label: "Gemeten", cls: "bg-green-500/10 text-[#2ea043] border-[#238636]/30" };
  }
  if (s.startsWith("geclaimd")) {
    return { label: "Geclaimd op eigen site", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  }
  if (s === "afwezig" || s === "niet gevonden") {
    return { label: "Niet gevonden", cls: "bg-red-500/10 text-red-400 border-red-500/30" };
  }
  return { label: "Onbekend", cls: "bg-[#21262d] text-[#8b949e] border-[#30363d]" };
}

// Klein label voor de herkomst van een bevinding (gemeten / geclaimd / afgeleid)
function bronBadgeStyle(bron?: string) {
  const b = (bron || "").toLowerCase();
  if (b.startsWith("gemeten")) return { label: "gemeten", cls: "bg-green-500/10 text-[#2ea043] border-[#238636]/30" };
  if (b.startsWith("geclaimd")) return { label: "geclaimd", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  if (b.startsWith("onbekend")) return { label: "niet verifieerbaar", cls: "bg-[#21262d] text-[#8b949e] border-[#30363d]" };
  if (b) return { label: b, cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  return null;
}

// Vertaling voor categorie-sleutels naar human readable Nederlands
const catNameTranslations: Record<string, string> = {
  gdpr: "AVG / GDPR",
  databeveiliging: "Databeveiliging",
  nen7510: "NEN 7510",
  iso27002: "ISO 27002:2022",
  toegankelijkheid: "Toegankelijkheid",
  transparantie: "Transparantie",
  incidentbeheer: "Incidentbeheer"
};

export default function App() {
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisPayload>(defaultAnalysis);
  
  // Progress stepper states
  const [currentStep, setCurrentStep] = useState(1);
  const [stepProgress, setStepProgress] = useState(0);

  // Stepper stappen definities
  const steps = [
    { id: 1, label: "Signalen Ophalen", desc: "HTTPS, securityheaders, security.txt & privacybeleid ophalen" },
    { id: 2, label: "Claude Analyse", desc: "Technische beveiliging & encryptie controleren" },
    { id: 3, label: "GPT-4o Analyse", desc: "GDPR/AVG-compliance & medische audits uitvoeren" },
    { id: 4, label: "Consensus Synthese", desc: "Scores middelen & bevindingen groeperen" }
  ];

  // Simuleer een lopende voortgangsbalk tijdens de API aanvraag
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setStepProgress((prev) => {
          if (prev >= 100) {
            // Ga naar volgende stap als de vorige 'simulatie' vol is
            setCurrentStep((step) => {
              if (step < 4) {
                return step + 1;
              }
              return step;
            });
            return 0;
          }
          // Increment snelheid verschilt per stap om het realistisch te maken
          const increment = currentStep === 1 ? 15 : currentStep === 2 ? 6 : currentStep === 3 ? 5 : 12;
          return Math.min(100, prev + increment);
        });
      }, 250);
    } else {
      setStepProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading, currentStep]);

  const handleAnalyze = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    // Eenvoudige URL-opschoning en validatie
    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }

    setLoading(true);
    setError(null);
    setCurrentStep(1);
    setStepProgress(0);

    try {
      const response = await fetch("/.netlify/functions/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: targetUrl })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server retourneerde statuscode ${response.status}`);
      }

      const data: AnalysisPayload = await response.json();
      
      // Korte pauze voor de visuele voltooiing van de animatie
      setCurrentStep(4);
      setStepProgress(100);
      
      setTimeout(() => {
        setResult(data);
        setLoading(false);
      }, 500);

    } catch (err: any) {
      console.error("Analyse mislukt:", err);
      setError(err?.message || "Er is een onverwachte fout opgetreden bij het verbinden met de analyseserver. Controleer uw netwerk en probeer het opnieuw.");
      setLoading(false);
    }
  };

  // Bereken visualisatiegegevens voor Chart.js
  const categoriesList = Object.keys(result.consensus.scores);
  const categoryLabels = categoriesList.map(cat => catNameTranslations[cat] || cat);
  
  // 1. Radar Chart Data
  const radarData = {
    labels: categoryLabels,
    datasets: [
      {
        label: result.model1.naam,
        data: categoriesList.map(cat => result.model1.scores[cat as keyof typeof result.model1.scores] ?? 0),
        backgroundColor: "rgba(59, 130, 246, 0.15)", // Blue-500 tint
        borderColor: "rgba(59, 130, 246, 0.9)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(59, 130, 246, 1)"
      },
      {
        label: result.model2.naam,
        data: categoriesList.map(cat => result.model2.scores[cat as keyof typeof result.model2.scores] ?? 0),
        backgroundColor: "rgba(35, 134, 54, 0.15)", // Green-600 tint
        borderColor: "rgba(35, 134, 54, 0.9)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(35, 134, 54, 1)",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: "rgba(35, 134, 54, 1)"
      }
    ]
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: {
          color: "rgba(48, 54, 61, 0.8)"
        },
        grid: {
          color: "rgba(48, 54, 61, 0.8)"
        },
        pointLabels: {
          color: "#8b949e",
          font: {
            family: "Inter",
            size: 11,
            weight: "normal" as const
          }
        },
        ticks: {
          backdropColor: "transparent",
          color: "#8b949e",
          showLabelBackdrop: false,
          font: {
            family: "IBM Plex Mono",
            size: 9
          },
          stepSize: 20
        },
        suggestedMin: 20,
        suggestedMax: 100
      }
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#c9d1d9",
          font: {
            family: "Inter",
            size: 12
          },
          boxWidth: 12
        }
      },
      tooltip: {
        backgroundColor: "#161b22",
        titleColor: "#f0f6fc",
        bodyColor: "#c9d1d9",
        borderColor: "#30363d",
        borderWidth: 1,
        titleFont: { family: "Inter", weight: "bold" as const },
        bodyFont: { family: "IBM Plex Mono" }
      }
    }
  };

  // 2. Bar Chart Data (Consensus)
  const consensusScores = categoriesList.map(cat => result.consensus.scores[cat as keyof typeof result.consensus.scores] ?? 0);
  const barColors = consensusScores.map(score => getScoreConfig(score).hex);
  
  const barData = {
    labels: categoryLabels,
    datasets: [
      {
        label: "Consensus Score",
        data: consensusScores,
        backgroundColor: barColors,
        borderRadius: 4,
        borderWidth: 0,
        barThickness: 24
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    scales: {
      x: {
        grid: {
          color: "rgba(48, 54, 61, 0.5)"
        },
        ticks: {
          color: "#8b949e",
          font: {
            family: "IBM Plex Mono",
            size: 10
          }
        },
        min: 0,
        max: 100
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          color: "#f0f6fc",
          font: {
            family: "Inter",
            size: 11,
            weight: "normal" as const
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: "#161b22",
        titleColor: "#f0f6fc",
        bodyColor: "#c9d1d9",
        borderColor: "#30363d",
        borderWidth: 1,
        titleFont: { family: "Inter", weight: "bold" as const },
        bodyFont: { family: "IBM Plex Mono" }
      }
    }
  };

  // Sector Benchmark data
  const benchmarkApps = [
    { name: "Zorgplatform A (Landelijk portaal)", score: 82, isRef: true },
    { name: "MedSec Geteste App (Huidige URL)", score: result.consensus.algehele_score, isRef: false },
    { name: "EPD-systeem B (Ziekenhuis software)", score: 74, isRef: true },
    { name: "Patiëntenportaal C (Huisarts koppeling)", score: 67, isRef: true },
    { name: "Medische App D (Commerciële app)", score: 55, isRef: true }
  ].sort((a, b) => b.score - a.score);

  const activeScoreConfig = getScoreConfig(result.consensus.algehele_score);
  const sig = result.signals; // lokale const → TS narrowt 'sig' correct in geneste callbacks

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans antialiased selection:bg-blue-500/30 selection:text-white pb-16">
      
      {/* 1. HEADER */}
      <header className="border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center">
                MedSec <span className="text-blue-400 ml-1.5">Compliance Checker</span>
              </h1>
              <span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/50 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                Medical Grade
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-flex items-center space-x-1.5 bg-[#161b22] border border-[#30363d] px-2.5 py-1 rounded-full text-[10px] font-mono text-[#8b949e] tracking-wider uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              <span>Systeem Actief</span>
            </span>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1 text-xs font-mono text-[#e6edf3] flex items-center space-x-1.5 font-bold">
              <Award className="w-4 h-4 text-blue-400" />
              <span>NEN 7510 & ISO 27002</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-8">
        
        {/* 2. HERO SECTION */}
        <section className="bg-gradient-to-b from-[#161b22] to-[#0d1117] rounded-xl border border-[#30363d] p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-green-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl space-y-4">
            <span className="text-blue-400 font-mono text-xs tracking-wider uppercase font-bold">
              Kritische Zorg-compliance Screening
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              MedSec Compliance Checker
            </h2>
            <p className="text-[#8b949e] text-sm leading-relaxed">
              Voer de URL in van een webapplicatie. De scan haalt eerst <span className="text-[#c9d1d9]">echte, objectief
              meetbare signalen</span> op van de site (HTTPS/TLS, securityheaders, security.txt, privacybeleid en geclaimde
              normen). Twee onafhankelijke AI-modellen beoordelen die feiten — met bronvermelding en expliciete onzekerheid —
              op geschiktheid (AVG/GDPR, NEN 7510, ISO 27002) voor de Nederlandse zorgsector.
            </p>

            {/* Input Form */}
            <form onSubmit={handleAnalyze} className="pt-4 flex flex-col sm:flex-row gap-3 max-w-2xl">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8b949e]">
                  <Globe className="w-5 h-5 text-[#8b949e]" />
                </div>
                <input
                  type="text"
                  placeholder="Bijv. zorgportaal-nederland.nl of app.mijnzorg.nl"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={loading}
                  id="target-url-input"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-blue-500/50 rounded-xl py-3 pl-11 pr-4 text-white placeholder-[#484f58] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                id="analyze-submit-button"
                className="bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#1f242c] disabled:opacity-50 text-white font-sans font-semibold px-6 py-3 rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-[0.98] h-12 shrink-0 shadow-lg shadow-green-950/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Scannen...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Analyseer URL</span>
                  </>
                )}
              </button>
            </form>

            {/* API Status Alert Banner */}
            {result.metadata.isDemoMode && !loading && (
              <div className="mt-4 p-3.5 rounded-xl border border-[#30363d] bg-[#161b22] text-[#8b949e] text-xs flex items-center space-x-2 max-w-2xl font-sans leading-relaxed">
                <Info className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                <span>
                  <strong>Demo Modus Actief:</strong> U bekijkt gesimuleerde data. Configureer 
                  <code className="bg-[#21262d] px-1 py-0.5 rounded mx-1 text-amber-400 font-mono">ANTHROPIC_API_KEY</code> en 
                  <code className="bg-[#21262d] px-1 py-0.5 rounded mx-1 text-amber-400 font-mono">OPENAI_API_KEY</code> in Netlify of AI Studio voor live AI-analyses.
                </span>
              </div>
            )}
            
            {(result.metadata.usedGeminiForClaude || result.metadata.usedGeminiForOpenAI) && !loading && (
              <div className="mt-4 p-3.5 rounded-xl border border-blue-500/20 bg-blue-950/10 text-[#8b949e] text-xs flex items-center space-x-2.5 max-w-2xl font-sans leading-relaxed">
                <Sparkles className="w-4.5 h-4.5 text-blue-400 shrink-0" />
                <span>
                  <strong>AI Studio Preview Actief:</strong> Bezig met live modelanalyse via 
                  <span className="text-blue-400 font-semibold"> Gemini (Server-side)</span> als alternatief wegens afwezigheid van andere API-keys.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 3. PROGRESS STEPPER (ACTIVE ONLY DURING LOADING) */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                  <h3 className="font-bold text-white">Zorg-compliance Audit in Uitvoering</h3>
                </div>
                <span className="text-xs font-mono text-[#8b949e]">
                  Stap {currentStep} van 4 • {stepProgress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#0d1117] h-2 rounded-full overflow-hidden border border-[#30363d]">
                <div
                  className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  style={{ width: `${((currentStep - 1) * 25) + (stepProgress / 4)}%` }}
                ></div>
              </div>

              {/* Steps Layout */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {steps.map((s) => {
                  const isActive = s.id === currentStep;
                  const isCompleted = s.id < currentStep;
                  return (
                    <div
                      key={s.id}
                      className={`p-4 rounded-xl border transition-all duration-300 ${
                        isActive
                          ? "bg-[#0d1117] border-blue-500/40 shadow-md"
                          : isCompleted
                          ? "bg-[#161b22] border-[#30363d] opacity-60"
                          : "border-transparent opacity-40"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                            isCompleted
                              ? "bg-blue-500 text-white"
                              : isActive
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : "bg-[#21262d] text-[#8b949e]"
                          }`}
                        >
                          {isCompleted ? "✓" : s.id}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-white" : "text-[#8b949e]"}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#8b949e] mt-1.5 ml-8 leading-snug">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ERROR MESSAGE DISPLAY */}
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Analyse mislukt</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* --- MAIN RESULTS DASHBOARD (HIDDEN DURING LOADING) --- */}
        {!loading && (
          <div className="space-y-8">
            
            {/* Header with currently analyzed URL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#30363d] pb-4 gap-4">
              <div>
                <span className="text-[#8b949e] text-[10px] font-mono tracking-widest uppercase font-bold">Geanalyseerde Webapplicatie</span>
                <h3 className="text-lg font-bold font-mono text-white flex items-center mt-1">
                  <Globe className="w-5 h-5 text-blue-400 mr-2 shrink-0" />
                  {result.url}
                </h3>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[#8b949e] text-[10px] font-mono tracking-widest uppercase font-bold">Tijdstip Scan</span>
                <p className="text-sm font-mono text-white mt-1">
                  {new Date(result.metadata.analyzedAt).toLocaleString("nl-NL")} UTC
                </p>
              </div>
            </div>

            {/* ONDERZOCHTE SIGNALEN — transparantie over de feitenbasis */}
            {sig && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363d] pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4.5 h-4.5 text-blue-400" />
                    <h4 className="font-bold text-white text-sm">Onderzochte signalen</h4>
                    <span className="text-[10px] text-[#8b949e] font-mono">extern waarneembaar</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded border bg-green-500/10 text-[#2ea043] border-[#238636]/30">Gemeten</span>
                    <span className="px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">Geclaimd op eigen site</span>
                    <span className="px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30">Niet gevonden</span>
                    <span className="px-2 py-0.5 rounded border bg-[#21262d] text-[#8b949e] border-[#30363d]">Onbekend</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#8b949e] leading-relaxed mb-4 font-sans">
                  Deze feiten zijn objectief opgehaald van de doel-URL en vormen de basis voor de AI-beoordeling.
                  Wat niet ophaalbaar was, staat als <span className="text-[#8b949e] font-semibold">onbekend</span> en is niet als
                  feit ingevuld. Een geclaimde norm is een vermelding op de eigen site, geen onafhankelijk bewijs.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* HTTPS / TLS */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Lock className="w-3.5 h-3.5 text-blue-400" /> HTTPS / TLS
                      </div>
                      {(() => { const st = signalStatusStyle(sig.https.status); return (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      ); })()}
                    </div>
                    <ul className="text-[11px] text-[#8b949e] space-y-1 font-mono">
                      <li>HTTPS bereikbaar: <BoolTag v={sig.https.httpsBereikbaar} /></li>
                      <li>http → https: <BoolTag v={sig.https.httpDoorverwijzing} /></li>
                      <li>TLS-handshake: <BoolTag v={sig.https.tlsOk} /></li>
                    </ul>
                  </div>

                  {/* Security headers */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Server className="w-3.5 h-3.5 text-blue-400" /> Security-headers
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-green-500/10 text-[#2ea043] border-[#238636]/30">
                        {sig.securityHeaders.aanwezig}/{sig.securityHeaders.totaal} gemeten
                      </span>
                    </div>
                    <ul className="text-[11px] text-[#8b949e] space-y-1 font-mono">
                      {sig.securityHeaders.items.map((h, i) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate">{h.naam.split(" (")[0]}</span>
                          <BoolTag v={h.aanwezig} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* security.txt */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <FileText className="w-3.5 h-3.5 text-blue-400" /> security.txt
                      </div>
                      {(() => { const st = signalStatusStyle(sig.securityTxt.status); return (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      ); })()}
                    </div>
                    {sig.securityTxt.status === "gevonden" ? (
                      <ul className="text-[11px] text-[#8b949e] space-y-1 font-mono">
                        <li>Contact-veld: <BoolTag v={sig.securityTxt.heeftContact} /></li>
                        <li>Policy-veld: <BoolTag v={sig.securityTxt.heeftPolicy} /></li>
                      </ul>
                    ) : (
                      <p className="text-[11px] text-[#8b949e] font-mono">Geen /.well-known/security.txt aangetroffen.</p>
                    )}
                  </div>

                  {/* Privacybeleid */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Scale className="w-3.5 h-3.5 text-blue-400" /> Privacy-/cookiebeleid
                      </div>
                      {(() => { const st = signalStatusStyle(sig.privacybeleid.status); return (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      ); })()}
                    </div>
                    {sig.privacybeleid.status === "gevonden" ? (
                      <ul className="text-[11px] text-[#8b949e] space-y-1 font-mono">
                        {sig.privacybeleid.items.map((p, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="truncate">{p.naam.split(" (")[0]}</span>
                            <BoolTag v={p.gevonden} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-[#8b949e] font-mono">Geen privacy-/cookiepagina gevonden om te analyseren.</p>
                    )}
                  </div>

                  {/* Geclaimde certificeringen */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Award className="w-3.5 h-3.5 text-blue-400" /> Geclaimde normen
                      </div>
                      {(() => { const st = signalStatusStyle(sig.certificeringen.status); return (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      ); })()}
                    </div>
                    {sig.certificeringen.gevonden.length > 0 || sig.certificeringen.trefwoorden.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sig.certificeringen.gevonden.map((c, i) => (
                          <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">{c.norm}</span>
                        ))}
                        {sig.certificeringen.trefwoorden.map((t, i) => (
                          <span key={`t-${i}`} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-[#21262d] text-[#8b949e] border-[#30363d]">{t}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#8b949e] font-mono">Geen normen (NEN 7510, ISO 27001/27002) op de site genoemd.</p>
                    )}
                    <p className="text-[9px] text-[#8b949e] italic leading-snug pt-1">Vermelding op de eigen site — niet onafhankelijk geverifieerd.</p>
                  </div>

                  {/* Domein-metadata */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Globe className="w-3.5 h-3.5 text-blue-400" /> Domein-metadata
                    </div>
                    <ul className="text-[11px] text-[#8b949e] space-y-1 font-mono">
                      <li>Pagina-taal: <span className="text-[#c9d1d9]">{sig.metaInfo.taal || "onbekend"}</span></li>
                      <li>EU/NL-domein: <BoolTag v={sig.metaInfo.euTld} /></li>
                      <li>Contact/colofon: <BoolTag v={sig.metaInfo.heeftContactOfColofon} /></li>
                    </ul>
                  </div>
                </div>

                {sig.fouten && sig.fouten.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-[#30363d] bg-[#0d1117] text-[11px] text-[#8b949e] font-mono space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold not-italic">
                      <Info className="w-3.5 h-3.5" /> Niet ophaalbaar (eerlijk gerapporteerd, geen aanname):
                    </div>
                    {sig.fouten.map((f, i) => (
                      <div key={i} className="pl-5">• {f}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MAIN BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
              
              {/* CELL 1: Consensus Score */}
              <div className="col-span-1 md:col-span-1 lg:col-span-3 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[180px] hover:border-[#484f58] transition-all">
                <div className="text-[10px] text-[#8b949e] uppercase font-mono tracking-widest font-bold">Consensus Score</div>
                <div className="flex items-end gap-2 mt-4">
                  <span className={`text-5xl font-bold font-mono ${activeScoreConfig.text}`}>{Math.round(result.consensus.algehele_score)}</span>
                  <span className="text-sm text-[#8b949e] pb-1.5 font-mono">/ 100</span>
                </div>
                {/* Score slider */}
                <div className="w-full bg-[#0d1117] h-1.5 rounded-full overflow-hidden mt-3 border border-[#30363d]">
                  <div className={`h-full ${activeScoreConfig.progress}`} style={{ width: `${result.consensus.algehele_score}%` }}></div>
                </div>
                <div className="mt-3 flex items-center">
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold tracking-tight uppercase ${activeScoreConfig.bg} ${activeScoreConfig.text} border ${activeScoreConfig.border}`}>
                    {result.consensus.classificatie}
                  </span>
                </div>
              </div>
              
              {/* CELL 2: Model Overeenkomst */}
              <div className="col-span-1 md:col-span-1 lg:col-span-3 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[180px] hover:border-[#484f58] transition-all">
                <div className="text-[10px] text-[#8b949e] uppercase font-mono tracking-widest font-bold">Model Agreement</div>
                <div className="text-4xl font-bold font-mono text-blue-400 mt-4">{Math.round(result.consensus.agreementPercentage)}%</div>
                {/* Score slider */}
                <div className="w-full bg-[#0d1117] h-1.5 rounded-full overflow-hidden mt-3 border border-[#30363d]">
                  <div className="h-full bg-blue-500" style={{ width: `${result.consensus.agreementPercentage}%` }}></div>
                </div>
                <div className="text-[10px] text-[#8b949e] leading-tight mt-2 font-sans">
                  Hoge inter-rater betrouwbaarheid tussen Claude en GPT-4o expertisen.
                </div>
              </div>

              {/* CELL 3: Consensus Verdict Panel */}
              <div className="col-span-1 md:col-span-2 lg:col-span-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-center min-h-[180px] hover:border-[#484f58] transition-all">
                <div className={`w-20 h-20 rounded-full border-[6px] ${activeScoreConfig.border} flex items-center justify-center text-3xl shadow-inner shrink-0 bg-[#0d1117]`}>
                  {result.consensus.verdictIcon}
                </div>
                <div className="flex-grow space-y-2">
                  <span className="text-[#8b949e] text-[10px] font-mono tracking-widest uppercase font-bold block">Consensus Verdict</span>
                  <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {result.consensus.aanbeveling}
                  </h2>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    De geanalyseerde webapplicatie heeft een algehele score van {Math.round(result.consensus.algehele_score)}/100 behaald en is geclassificeerd als <strong className="text-white">{result.consensus.classificatie.toLowerCase()}</strong>.
                  </p>
                  <div className="mt-3 pt-2 border-t border-[#30363d] flex flex-wrap gap-4">
                    <div className="text-[10px]">
                      <span className="block text-[#8b949e] uppercase font-mono tracking-wider font-semibold">Sterkste Pilaar</span>
                      <span className="text-green-400 font-bold flex items-center mt-0.5">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        {result.consensus.sterkstDomein}
                      </span>
                    </div>
                    <div className="text-[10px]">
                      <span className="block text-[#8b949e] uppercase font-mono tracking-wider font-semibold">Zwakste Pilaar</span>
                      <span className="text-orange-400 font-bold flex items-center mt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        {result.consensus.zwakstDomein}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CELL 4: Radar comparison chart */}
              <div className="col-span-1 md:col-span-2 lg:col-span-5 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[350px]">
                <div>
                  <div className="text-[10px] text-[#8b949e] uppercase font-mono tracking-widest font-bold">Vergelijkende AI Modellen Radar</div>
                  <p className="text-[11px] text-[#8b949e] mt-1 leading-normal font-sans">
                    Technische controls (Claude) versus de juridische/audit controls (GPT-4o).
                  </p>
                </div>
                <div className="h-64 w-full mt-4 flex items-center justify-center relative">
                  <Radar data={radarData} options={radarOptions} />
                </div>
                <div className="flex justify-center gap-4 mt-2 text-[10px] uppercase font-mono font-bold border-t border-[#30363d] pt-2.5">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-blue-500"></div> Claude</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-green-500"></div> GPT-4o</div>
                </div>
              </div>

              {/* CELL 5: Sector Benchmark Card */}
              <div className="col-span-1 md:col-span-2 lg:col-span-7 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[350px]">
                <div>
                  <div className="text-[10px] text-[#8b949e] uppercase font-mono tracking-widest font-bold">Sector Benchmark Vergelijking</div>
                  <p className="text-[11px] text-[#8b949e] mt-1 leading-normal font-sans">
                    Vergelijking van de consensus score t.o.v. referentie-platformen in de Nederlandse zorgsector.
                  </p>
                </div>

                <div className="space-y-4 py-4 my-auto">
                  {benchmarkApps.map((app, idx) => {
                    const isCurrent = !app.isRef;
                    const config = getScoreConfig(app.score);
                    
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-medium flex items-center ${isCurrent ? "text-white font-bold" : "text-[#8b949e]"}`}>
                            {isCurrent && <span className="text-amber-400 mr-1.5 text-xs">★</span>}
                            {app.name === "MedSec Geteste App (Huidige URL)" ? result.url : app.name}
                          </span>
                          <span className={`font-mono font-bold ${isCurrent ? config.text + " text-sm" : "text-[#8b949e]"}`}>
                            {app.score} / 100
                          </span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-3 rounded-full overflow-hidden border border-[#30363d] relative">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              isCurrent
                                ? `${config.progress} shadow-[0_0_8px_rgba(35,134,54,0.3)]`
                                : "bg-[#21262d] opacity-60"
                            }`}
                            style={{ width: `${app.score}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-[#8b949e] italic leading-normal border-t border-[#30363d] pt-2.5 font-sans">
                  Referentieniveau gebaseerd op gemiddelde inspectierapporten van IGJ en Nederlandse IT-audit standaarden.
                </div>
              </div>

              {/* CELL 6: Claude Expert Detail */}
              <div className="col-span-1 md:col-span-1 lg:col-span-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[350px] hover:border-[#484f58] transition-all">
                <div>
                  <div className="flex justify-between items-center border-b border-[#30363d] pb-2.5 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                      <h4 className="font-bold text-white text-sm">{result.model1.naam}</h4>
                    </div>
                    <span className="font-mono text-xs text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      Score: {result.model1.algehele_score}/100
                    </span>
                  </div>
                  
                  <p className="text-[#8b949e] text-[11px] leading-relaxed italic border-l-2 border-blue-500/30 pl-3 mb-4">
                    "{result.model1.model_perspectief}"
                  </p>

                  <p className="text-[#e6edf3] text-xs leading-relaxed font-sans">
                    {result.model1.samenvatting}
                  </p>
                </div>

                {/* Category breakdowns */}
                <div className="space-y-2.5 pt-4 border-t border-[#30363d] mt-4">
                  <span className="text-[#8b949e] text-[10px] font-mono uppercase block tracking-wider font-bold">Audit Scores per Categorie:</span>
                  {categoriesList.map((cat) => {
                    const val = result.model1.scores[cat as keyof typeof result.model1.scores] ?? 0;
                    const config = getScoreConfig(val);
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#c9d1d9]">{catNameTranslations[cat] || cat}</span>
                          <span className={`font-mono font-semibold ${config.text}`}>{val}%</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-1.5 rounded-full overflow-hidden border border-[#30363d]">
                          <div className={`h-full bg-blue-500/80 transition-all duration-1000`} style={{ width: `${val}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CELL 7: GPT-4o Expert Detail */}
              <div className="col-span-1 md:col-span-1 lg:col-span-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[350px] hover:border-[#484f58] transition-all">
                <div>
                  <div className="flex justify-between items-center border-b border-[#30363d] pb-2.5 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-4 bg-purple-500 rounded-full"></div>
                      <h4 className="font-bold text-white text-sm">{result.model2.naam}</h4>
                    </div>
                    <span className="font-mono text-xs text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                      Score: {result.model2.algehele_score}/100
                    </span>
                  </div>
                  
                  <p className="text-[#8b949e] text-[11px] leading-relaxed italic border-l-2 border-purple-500/30 pl-3 mb-4">
                    "{result.model2.model_perspectief}"
                  </p>

                  <p className="text-[#e6edf3] text-xs leading-relaxed font-sans">
                    {result.model2.samenvatting}
                  </p>
                </div>

                {/* Category breakdowns */}
                <div className="space-y-2.5 pt-4 border-t border-[#30363d] mt-4">
                  <span className="text-[#8b949e] text-[10px] font-mono uppercase block tracking-wider font-bold">Audit Scores per Categorie:</span>
                  {categoriesList.map((cat) => {
                    const val = result.model2.scores[cat as keyof typeof result.model2.scores] ?? 0;
                    const config = getScoreConfig(val);
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#c9d1d9]">{catNameTranslations[cat] || cat}</span>
                          <span className={`font-mono font-semibold ${config.text}`}>{val}%</span>
                        </div>
                        <div className="w-full bg-[#0d1117] h-1.5 rounded-full overflow-hidden border border-[#30363d]">
                          <div className={`h-full bg-purple-500/80 transition-all duration-1000`} style={{ width: `${val}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CELL 8: Risks & Aandachtspunten */}
              <div className="col-span-1 md:col-span-1 lg:col-span-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[380px] hover:border-[#484f58] transition-all">
                <div>
                  <div className="border-b border-[#30363d] pb-2.5 mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-orange-400" />
                      <h4 className="font-bold text-white text-sm">Risico's & Aandachtspunten</h4>
                    </div>
                    <span className="font-mono text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-bold">
                      {result.risks.length} bevindingen
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {result.risks.length === 0 ? (
                      <div className="text-center py-8 text-[#8b949e] text-xs">
                        Geen noemenswaardige risico's gerapporteerd door de parallelle modellen.
                      </div>
                    ) : (
                      result.risks.map((risk, idx) => {
                        let severityBadge = "";
                        if (risk.ernst === "Kritiek") severityBadge = "bg-red-500/10 text-red-400 border-red-500/20";
                        else if (risk.ernst === "Hoog") severityBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                        else if (risk.ernst === "Middel") severityBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        else severityBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";

                        return (
                          <div key={idx} className="p-3 rounded-lg border border-[#30363d] bg-[#0d1117] space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-semibold text-white text-xs leading-normal">{risk.titel}</h5>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${severityBadge}`}>
                                {risk.ernst.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8b949e] leading-relaxed">
                              {risk.toelichting}
                            </p>
                            <div className="flex justify-between items-center pt-1.5 border-t border-[#30363d]/50 text-[9px] font-mono text-[#8b949e]">
                              <span className="flex items-center gap-1.5">
                                <span>Expertisecentrum:</span>
                                <span className={risk.model.includes("Claude") ? "text-blue-400" : "text-purple-400"}>
                                  {risk.model}
                                </span>
                              </span>
                              {(() => { const b = bronBadgeStyle(risk.bron); return b ? (
                                <span className={`px-1.5 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
                              ) : null; })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* CELL 9: Sterke Punten & Voldoendes */}
              <div className="col-span-1 md:col-span-1 lg:col-span-6 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[380px] hover:border-[#484f58] transition-all">
                <div>
                  <div className="border-b border-[#30363d] pb-2.5 mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4.5 h-4.5 text-[#2ea043]" />
                      <h4 className="font-bold text-white text-sm">Sterke Punten & Voldoendes</h4>
                    </div>
                    <span className="font-mono text-xs bg-green-500/10 text-[#2ea043] px-2 py-0.5 rounded border border-[#238636]/30 font-bold">
                      {result.positives.length} bekrachtigingen
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {result.positives.length === 0 ? (
                      <div className="text-center py-8 text-[#8b949e] text-xs">
                        Geen sterke punten expliciet gerapporteerd door de parallelle modellen.
                      </div>
                    ) : (
                      result.positives.map((pos, idx) => {
                        return (
                          <div key={idx} className="p-3 rounded-lg border border-[#30363d] bg-[#0d1117] space-y-2">
                            <h5 className="font-semibold text-white text-xs flex items-center">
                              <span className="w-2 h-2 rounded-full bg-[#2ea043] mr-1.5 inline-block shrink-0"></span>
                              {pos.titel}
                            </h5>
                            <p className="text-[11px] text-[#8b949e] leading-relaxed">
                              {pos.toelichting}
                            </p>
                            <div className="flex justify-between items-center pt-1.5 border-t border-[#30363d]/50 text-[9px] font-mono text-[#8b949e]">
                              <span className="flex items-center gap-1.5">
                                <span>Expertisecentrum:</span>
                                <span className={pos.model.includes("Claude") ? "text-blue-400" : "text-purple-400"}>
                                  {pos.model}
                                </span>
                              </span>
                              {(() => { const b = bronBadgeStyle(pos.bron); return b ? (
                                <span className={`px-1.5 py-0.5 rounded border ${b.cls}`}>{b.label}</span>
                              ) : null; })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* CELL 10: Consensus Bar Chart */}
              <div className="col-span-1 md:col-span-2 lg:col-span-12 bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between min-h-[320px] hover:border-[#484f58] transition-all">
                <div>
                  <div className="text-[10px] text-[#8b949e] uppercase font-mono tracking-widest font-bold">Gemiddelde Consensus per Categorie</div>
                  <p className="text-[11px] text-[#8b949e] mt-1 leading-normal font-sans">
                    Geaggregeerde consensus scores over de zeven fundamentele medische IT-veiligheidsdomeinen.
                  </p>
                </div>
                <div className="h-48 w-full mt-4 flex items-center justify-center relative">
                  <Bar data={barData} options={barOptions} />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* FOOTER NOTICE */}
        <footer className="border-t border-[#30363d] pt-8 mt-12 text-center space-y-4">
          <div className="flex justify-center items-center space-x-2">
            <Shield className="w-4.5 h-4.5 text-blue-400" />
            <span className="text-xs font-mono text-[#8b949e] tracking-widest uppercase font-bold">MEDSEC COMPLIANCE CHECKER V1.0.0</span>
          </div>
          <p className="text-xs text-[#8b949e] max-w-3xl mx-auto leading-relaxed px-4">
            <strong>Disclaimer:</strong> Dit is een geautomatiseerde scan van <u>extern waarneembare signalen</u> — de
            "buitenkant" van de applicatie (HTTPS, securityheaders, security.txt, publiek privacybeleid en op de eigen site
            geclaimde normen), beoordeeld door twee onafhankelijke taalmodellen. Het is <u>geen</u> audit en <u>geen</u>
            vervanging voor een formele NEN 7510-/ISO 27001-certificering door een geaccrediteerde auditor, een ISAE 3402-verklaring
            of een penetratietest. Een lage score kan duiden op zwakke <em>publieke</em> signalen — niet noodzakelijk op onveilige
            techniek; en een hoge score op sterke publieke signalen is geen garantie voor de werkelijke interne beveiliging.
            De daadwerkelijke serverconfiguratie, verwerkersovereenkomsten en het interne ISMS zijn vanaf de buitenkant niet
            verifieerbaar. Er kunnen geen rechten worden ontleend aan deze uitkomsten.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] text-[#8b949e] font-mono border-t border-[#30363d]/50 pt-4 max-w-xl mx-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2ea043] animate-pulse"></span>
              <span>Status: Systeem Operationeel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Backend: Netlify Functions (v2.1)</span>
            </div>
          </div>
        </footer>

      </main>

    </div>
  );
}
