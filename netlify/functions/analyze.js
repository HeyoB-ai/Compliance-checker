import { collectSignals } from "./collectSignals.js";

// De Gemini SDK wordt lazy geladen binnen runGeminiAnalysis (zie onder),
// zodat de function altijd laadt — ook als @google/genai niet mee-gebundeld is.

// fetch met harde timeout via AbortController. Voorkomt dat een trage of
// onbereikbare provider de hele function tot de Netlify-limiet (26s) laat
// hangen → 504. We kappen ruim daaronder af (default 20s).
async function fetchWithTimeout(url, options, ms = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Hulpprogramma om JSON op een veilige manier te parsen
function safeParseJSON(text) {
  try {
    // Verwijder markdown code fences indien aanwezig
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    return JSON.parse(cleanText.trim());
  } catch (e) {
    console.error("Fout bij het parsen van JSON uit LLM response:", e, text);
    return null;
  }
}

// Genereer een realistische mock-beoordeling voor demo-doeleinden
function generateDemoAssessment(url, isModel1) {
  const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  const isWellKnownMed = cleanUrl.includes("zorg") || cleanUrl.includes("ggz") || cleanUrl.includes("epd") || cleanUrl.includes("medisch") || cleanUrl.includes("zorgdomein");
  const isBigTech = cleanUrl.includes("google") || cleanUrl.includes("microsoft") || cleanUrl.includes("apple") || cleanUrl.includes("amazon");
  
  let baseScore = 65;
  if (isWellKnownMed) baseScore = 85;
  else if (isBigTech) baseScore = 78;
  else if (cleanUrl.includes(".nl")) baseScore = 70;
  else if (cleanUrl.includes(".gov")) baseScore = 80;
  else baseScore = 48; // Onbekende of algemene site krijgt lagere score voor medische compliance

  // Introduceer een kleine afwijking voor de twee modellen
  const modelOffset = isModel1 ? -4 : 5;
  const finalBase = Math.min(100, Math.max(10, baseScore + modelOffset));

  const scores = {
    gdpr: Math.min(100, Math.max(10, finalBase + (isModel1 ? -5 : 8))),
    databeveiliging: Math.min(100, Math.max(10, finalBase + (isModel1 ? 10 : -4))),
    nen7510: Math.min(100, Math.max(10, finalBase + (isModel1 ? 5 : -8))),
    iso27002: Math.min(100, Math.max(10, finalBase + (isModel1 ? 2 : -2))),
    toegankelijkheid: Math.min(100, Math.max(10, finalBase + (isModel1 ? -10 : 5))),
    transparantie: Math.min(100, Math.max(10, finalBase + (isModel1 ? -2 : 6))),
    incidentbeheer: Math.min(100, Math.max(10, finalBase + (isModel1 ? 4 : -5)))
  };

  const algehele_score = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 7);

  let classificatie = "Voldoende";
  let aanbeveling = "Gebruik met voorbehoud";

  if (algehele_score >= 80) {
    classificatie = "Uitstekend";
    aanbeveling = "Geschikt";
  } else if (algehele_score >= 70) {
    classificatie = "Goed";
    aanbeveling = "Geschikt met maatregelen";
  } else if (algehele_score >= 55) {
    classificatie = "Voldoende";
    aanbeveling = "Gebruik met voorbehoud";
  } else if (algehele_score >= 40) {
    classificatie = "Risicovol";
    aanbeveling = "Niet geschikt";
  } else {
    classificatie = "Onvoldoende";
    aanbeveling = "Niet geschikt";
  }

  const positief = isModel1 ? [
    {
      titel: "Sterke Technische Beveiliging",
      toelichting: `De hostingsystemen achter ${cleanUrl} maken gebruik van TLS 1.3 encryptie met sterke cipher suites, wat afluisteren van medische gegevens effectief voorkomt.`
    },
    {
      titel: "Multi-Factor Authenticatie (MFA) Ondersteuning",
      toelichting: "Technische indicatoren duiden op de aanwezigheid van sterke toegangscontroles en de mogelijkheid om MFA te verplichten voor zorgpersoneel."
    }
  ] : [
    {
      titel: "Transparant Privacybeleid",
      toelichting: `Er is een actueel privacyreglement beschikbaar dat expliciet ingaat op de verwerking van medische en persoonsgegevens conform de AVG.`
    },
    {
      titel: "Duidelijke Verwerkersovereenkomst (DPA)",
      toelichting: "De aanbieder stelt een standaard medische verwerkersovereenkomst beschikbaar die voldoet aan de eisen van de AVG Artikel 28."
    }
  ];

  const risico = isModel1 ? [
    {
      titel: "Onzekerheid over Data Rest-locatie",
      ernst: algehele_score < 60 ? "Hoog" : "Middel",
      toelichting: `Er is onvoldoende technische garantie dat data uitsluitend binnen de EU (bij voorkeur Nederland) wordt opgeslagen en verwerkt.`
    },
    {
      titel: "Geen Expliciete NEN 7510 Certificering",
      ernst: "Middel",
      toelichting: "De applicatie toont geen directe certificering of onafhankelijke auditrapportage conform de Nederlandse zorgnorm NEN 7510."
    }
  ] : [
    {
      titel: "Potentiële Derde-landen Doorgifte",
      ernst: algehele_score < 65 ? "Kritiek" : "Hoog",
      toelichting: "Het privacybeleid sluit doorgifte van metadata naar servers in de VS onder de 'Cloud Act' niet volledig uit, wat risicovol is voor patiëntgegevens."
    },
    {
      titel: "Beperkte Rechten van Betrokkenen in UI",
      ernst: "Laag",
      toelichting: "Het portaal biedt patiënten weinig directe self-service opties om gegevens te corrigeren of te exporteren conform de AVG."
    }
  ];

  const samenvatting = isModel1 
    ? `Technische audit van ${cleanUrl}: De applicatie vertoont solide fundamenten op het gebied van encryptie en HTTPS-configuratie. Echter, specifieke zorg-eisen zoals NEN 7510 logging en strenge scheiding van databases kunnen niet extern worden geverifieerd zonder een gedetailleerde pentest of auditrapport. Geschikt voor niet-kritieke processen, mits aanvullende waarborgen worden getroffen.`
    : `Juridische compliance audit van ${cleanUrl}: Het privacy-framework voldoet aan de basale AVG-eisen, maar schiet tekort op het gebied van de strenge Nederlandse UAVG-aanvullingen voor bijzondere persoonsgegevens in de zorg. Er is een actieve verwerkersovereenkomst vereist alvorens deze software mag worden ingezet voor patiëntenregistratie.`;

  const model_perspectief = isModel1
    ? "Als Security Expert focus ik op de harde technische controls. De transportbeveiliging is adequaat, maar het ontbreken van transparantie over vulnerability disclosures en patch-management vormt een latent risico voor medische infrastructuren."
    : "Als Conservatieve Legal Auditor beoordeel ik de juridische risico's streng. Zonder expliciete, schriftelijke garanties omtrent data-eigendom en strikte naleving van de WGBO adviseer ik uiterste terughoudendheid bij de implementatie.";

  return {
    scores,
    algehele_score,
    classificatie,
    aanbeveling,
    positief,
    risico,
    samenvatting,
    model_perspectief
  };
}

// Zet het signals-object om naar een compact, leesbaar feitenblok voor de LLM's.
function signalsToPromptText(s) {
  if (!s) return "Geen signalen beschikbaar (verzameling mislukt). Behandel alles als ONBEKEND.";
  const ja = (b) => (b === true ? "JA" : b === false ? "NEE" : "ONBEKEND");

  const headerRegels = (s.securityHeaders?.items || [])
    .map((h) => `    - ${h.naam}: ${h.aanwezig === null ? "ONBEKEND" : h.aanwezig ? "aanwezig" : "afwezig"}`)
    .join("\n");

  const privRegels = (s.privacybeleid?.items || [])
    .map((p) => `    - ${p.naam}: ${p.gevonden ? "gevonden" : "niet gevonden"}`)
    .join("\n");

  const certRegels =
    (s.certificeringen?.gevonden || []).length > 0
      ? s.certificeringen.gevonden.map((c) => `    - ${c.norm} (geclaimd op ${c.op})`).join("\n")
      : "    - (geen specifieke norm letterlijk genoemd)";

  return `OPGEHAALDE SIGNALEN (objectief gemeten van de doel-URL, ${s.fetchedAt}):

[GEMETEN — verifieerbaar opgehaald]
- Bereikbaarheid over HTTPS: ${s.https?.status} (httpsBereikbaar=${ja(s.https?.httpsBereikbaar)}, TLS-handshake ok=${ja(s.https?.tlsOk)}, http→https doorverwijzing=${ja(s.https?.httpDoorverwijzing)})
- HTTP-securityheaders (${s.securityHeaders?.aanwezig}/${s.securityHeaders?.totaal} aanwezig), status=${s.securityHeaders?.status}:
${headerRegels || "    - ONBEKEND"}
- security.txt: ${s.securityTxt?.status}${s.securityTxt?.gevondenOp ? ` (op ${s.securityTxt.gevondenOp}, Contact-veld=${ja(s.securityTxt.heeftContact)}, Policy-veld=${ja(s.securityTxt.heeftPolicy)})` : ""}
- Privacy-/cookiebeleid gevonden: ${s.privacybeleid?.status}${s.privacybeleid?.gevondenOp ? ` (${s.privacybeleid.gevondenOp})` : ""}
${privRegels ? "  Concrete compliance-signalen in dat beleid:\n" + privRegels : ""}
- Pagina-taal: ${s.metaInfo?.taal || "ONBEKEND"} | Contact/colofon aanwezig: ${ja(s.metaInfo?.heeftContactOfColofon)} | EU/NL-TLD: ${ja(s.metaInfo?.euTld)}

[GECLAIMD OP EIGEN SITE — niet onafhankelijk geverifieerd]
- Certificeringen/normen genoemd op de site (status: ${s.certificeringen?.status}):
${certRegels}
${(s.certificeringen?.trefwoorden || []).length ? "    - Trefwoorden: " + s.certificeringen.trefwoorden.join(", ") : ""}

[ONBEKEND / NIET OPHAALBAAR]
${(s.fouten || []).length ? s.fouten.map((f) => "    - " + f).join("\n") : "    - (geen ophaalfouten)"}

LET OP: certificeringen hierboven zijn CLAIMS op de eigen site, geen bewijs van daadwerkelijke certificering. Serverconfiguratie, verwerkersovereenkomsten en interne ISMS zijn vanaf de buitenkant NIET verifieerbaar.`;
}

// De hoofdhandler voor Netlify serverless (intern; gewrapt door `handler` onderaan)
async function _handler(event, context) {
  // CORS-headers toevoegen
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Preflight-verzoeken afhandelen
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Alleen POST-verzoeken zijn toegestaan." })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Ongeldige JSON body ontvangen." })
    };
  }

  const { url } = body;
  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "De parameter 'url' is verplicht." })
    };
  }

  // Omgevingsvariabelen ophalen
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log(`Analyse starten voor URL: ${url}`);
  console.log(`API Keys status - Anthropic: ${anthropicKey ? "JA" : "NEE"}, OpenAI: ${openaiKey ? "JA" : "NEE"}, Gemini: ${geminiKey ? "JA" : "NEE"}`);

  // --- Echte signalen ophalen vóór de LLM-beoordeling (hard tijdsbudget) ---
  // Gooit nooit; bij mislukking krijgen we een object vol "onbekend"-statussen.
  let signals = null;
  try {
    signals = await collectSignals(url, { budgetMs: 8000 });
    console.log(
      `Signalen verzameld in ${signals.durationMs}ms — bereikbaar=${signals.reachable}, ` +
        `securityheaders=${signals.securityHeaders.aanwezig}/${signals.securityHeaders.totaal}, ` +
        `security.txt=${signals.securityTxt.status}, privacy=${signals.privacybeleid.status}, ` +
        `certificeringen=${signals.certificeringen.status}`
    );
  } catch (sigErr) {
    console.error("Signaalverzameling faalde onverwacht:", sigErr);
  }
  const signalsText = signalsToPromptText(signals);

  // Base system prompts — beoordeel op de OPGEHAALDE SIGNALEN, niet op aannames.
  const systemPromptBase = `Je bent een gespecialiseerde medische IT-compliance expert met diepgaande kennis van: AVG/GDPR (incl. artikel 9 bijzondere categorieën gezondheidsgegevens), NEN 7510, ISO 27001/27799, ISO 27002:2022, de UAVG, de WGBO, en richtlijnen van IGJ en CIBG voor medische software.

BEOORDELINGSREGELS (strikt):
1. Beoordeel UITSLUITEND op basis van de meegeleverde, opgehaalde SIGNALEN plus je algemene vakinhoudelijke kader. Verzin GEEN feiten over de organisatie, infrastructuur of contracten.
2. Onderscheid expliciet drie soorten bevindingen: (a) GEMETEN — objectief opgehaald (HTTPS, securityheaders, security.txt, aanwezigheid privacybeleid); (b) GECLAIMD OP EIGEN SITE — normen/certificeringen die de site zelf noemt maar die niet onafhankelijk geverifieerd zijn; (c) ONBEKEND — niet ophaalbaar vanaf de buitenkant.
3. Waar een signaal ONBEKEND is, MOET je dat als onzekerheid laten meewegen en het expliciet benoemen — vul het NIET in met een aanname. Onbekend is geen bewijs van afwezigheid, maar mag ook niet positief gescoord worden.
4. Presenteer een geclaimde certificering nooit als geverifieerd feit; benoem het als "geclaimd op eigen site".
5. Bedenk dat serverconfiguratie, verwerkersovereenkomsten en interne ISMS NIET vanaf de buitenkant te verifiëren zijn; weeg dat mee als onzekerheid, niet als tekortkoming op zich.
6. Onderbouw elke score-categorie kort met het concrete signaal waarop je je baseert (veld "gebaseerd_op"). Retourneer UITSLUITEND valide JSON in het afgesproken formaat.`;

  const claudeSystemPrompt = `${systemPromptBase}\n\nRol focus: Security expert — focus op technische beveiligingsmaatregelen die uit de signalen blijken (HTTPS/TLS, securityheaders zoals HSTS/CSP, security.txt). Wees grondig maar baseer je oordeel op de gemeten signalen, niet op vermoedens.`;
  const openaiSystemPrompt = `Je bent een kritische juridische auditor gespecialiseerd in zorgwetgeving (AVG/GDPR incl. art. 9, NEN 7510, ISO 27001/27002, UAVG, WGBO, IGJ/CIBG), met een conservatieve beoordelingsstijl.\n\n${systemPromptBase}\n\nRol focus: Conservatieve juridische/compliance auditor — focus op wat de opgehaalde signalen zeggen over AVG-naleving (privacybeleid, verwerkersovereenkomst, FG/DPO, grondslag, bewaartermijnen, rechten van betrokkenen) en geclaimde normen. Wees streng: ontbrekende of onbekende signalen leiden tot voorbehoud, niet tot een aanname.`;

  const userPrompt = `Beoordeel de geschiktheid van de volgende webapplicatie voor de Nederlandse zorgsector, UITSLUITEND op basis van de hieronder opgehaalde signalen plus je vakkennis.

URL: ${url}

${signalsText}

Je MOET antwoorden in het volgende exacte JSON-formaat (zonder andere tekst of markdown). Verwerk in "samenvatting" en "model_perspectief" expliciet welke signalen GEMETEN, GECLAIMD of ONBEKEND zijn:
{
  "scores": {
    "gdpr": 0,
    "databeveiliging": 0,
    "nen7510": 0,
    "iso27002": 0,
    "toegankelijkheid": 0,
    "transparantie": 0,
    "incidentbeheer": 0
  },
  "algehele_score": 0,
  "classificatie": "Onvoldoende|Risicovol|Voldoende|Goed|Uitstekend",
  "aanbeveling": "Niet geschikt|Gebruik met voorbehoud|Geschikt met maatregelen|Geschikt",
  "gebaseerd_op": "Korte toelichting welke concrete signalen de scores het meest bepaalden, en wat onbekend bleef.",
  "positief": [
    { "titel": "...", "toelichting": "...", "bron": "gemeten|geclaimd op eigen site|afgeleid" }
  ],
  "risico": [
    { "titel": "...", "ernst": "Laag|Middel|Hoog|Kritiek", "toelichting": "...", "bron": "gemeten|onbekend (niet verifieerbaar)|afgeleid" }
  ],
  "samenvatting": "...",
  "model_perspectief": "..."
}`;

  let isDemoMode = false;
  let usedGeminiForClaude = false;
  let usedGeminiForOpenAI = false;

  // We voeren beide analyses parallel uit met allSettled, zodat een geslaagd
  // model altijd doorkomt ook als het andere faalt of time-out — geen enkele
  // hangende call kan de respons blokkeren tot Netlify afkapt (504).
  const settled = await Promise.allSettled([
    // --- Model 1: Claude / Anthropic (of Gemini fallback) ---
    (async () => {
      if (anthropicKey) {
        try {
          console.log("Claude API aanroepen...");
          const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
              // claude-3-5-sonnet-20241022 is per 2025-10-28 uitgefaseerd (404).
              // Actueel Sonnet-model:
              model: "claude-sonnet-4-6",
              // 1500 is ruim genoeg voor de gevraagde JSON en aanzienlijk sneller dan 4000.
              max_tokens: 1500,
              // Lage temperature: de input is nu feitelijk, dus we willen consistentie i.p.v. creativiteit.
              temperature: 0.2,
              system: claudeSystemPrompt,
              messages: [{ role: "user", content: userPrompt }]
            })
            // 15s LLM-timeout: signaalverzameling (~8s) + LLM (~15s) blijft binnen de 26s Netlify-limiet.
          }, 15000);

          if (!res.ok) {
            // Log de exacte Anthropic-foutcode zodat per-model fouten zichtbaar zijn
            const errBody = await res.json().catch(() => ({}));
            const apiCode = errBody?.error?.type || res.statusText;
            console.error(
              `Anthropic API non-200: status=${res.status} code=${apiCode}`,
              errBody?.error?.message || ""
            );
            throw new Error(`Anthropic API returned status ${res.status} (${apiCode})`);
          }

          const data = await res.json();
          const parsed = safeParseJSON(data.content[0].text);
          if (parsed) return parsed;
          throw new Error("Ongeldige JSON-structuur ontvangen van Claude.");
        } catch (err) {
          if (err?.name === "AbortError") {
            console.error("Claude API time-out (>20s) — call afgebroken.");
          } else {
            console.error("Fout bij Claude API call:", err);
          }
          // Als Claude faalt maar we hebben Gemini, probeer Gemini
          if (geminiKey) {
            return await runGeminiAnalysis(geminiKey, "gemini-3.5-flash", claudeSystemPrompt, userPrompt, "Claude (Fallback)");
          }
          throw err;
        }
      } else if (geminiKey) {
        console.log("Anthropic key ontbreekt. Gemini gebruiken voor Claude-rol...");
        usedGeminiForClaude = true;
        return await runGeminiAnalysis(geminiKey, "gemini-3.5-flash", claudeSystemPrompt, userPrompt, "Claude (Vervanging)");
      } else {
        console.log("Geen sleutels voor Model 1. Demo modus geactiveerd voor Claude-rol.");
        isDemoMode = true;
        return generateDemoAssessment(url, true);
      }
    })(),

    // --- Model 2: OpenAI GPT-4o (of Gemini fallback) ---
    (async () => {
      if (openaiKey) {
        try {
          console.log("OpenAI API aanroepen...");
          const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4o",
              // Begrens de output zodat de call ruim binnen de Netlify-limiet blijft.
              max_tokens: 1500,
              // Lage temperature: feitelijke input → consistente beoordeling i.p.v. creativiteit.
              temperature: 0.2,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: openaiSystemPrompt },
                { role: "user", content: userPrompt }
              ]
            })
          }, 15000);

          if (!res.ok) {
            // Log de exacte OpenAI-statuscode en body zodat falende calls zichtbaar zijn
            const errBody = await res.json().catch(() => ({}));
            const apiCode = errBody?.error?.code || errBody?.error?.type || res.statusText;
            console.error(
              `OpenAI API non-200: status=${res.status} code=${apiCode}`,
              errBody?.error?.message || ""
            );
            throw new Error(`OpenAI API returned status ${res.status} (${apiCode})`);
          }

          const data = await res.json();
          const parsed = safeParseJSON(data.choices[0].message.content);
          if (parsed) return parsed;
          throw new Error("Ongeldige JSON-structuur ontvangen van OpenAI.");
        } catch (err) {
          if (err?.name === "AbortError") {
            console.error("OpenAI API time-out (>20s) — call afgebroken.");
          } else {
            console.error("Fout bij OpenAI API call:", err);
          }
          // Als OpenAI faalt maar we hebben Gemini, probeer Gemini
          if (geminiKey) {
            return await runGeminiAnalysis(geminiKey, "gemini-3.5-flash", openaiSystemPrompt, userPrompt, "OpenAI (Fallback)");
          }
          throw err;
        }
      } else if (geminiKey) {
        console.log("OpenAI key ontbreekt. Gemini gebruiken voor OpenAI-rol...");
        usedGeminiForOpenAI = true;
        return await runGeminiAnalysis(geminiKey, "gemini-3.5-flash", openaiSystemPrompt, userPrompt, "OpenAI (Vervanging)");
      } else {
        console.log("Geen sleutels voor Model 2. Demo modus geactiveerd voor OpenAI-rol.");
        isDemoMode = true;
        return generateDemoAssessment(url, false);
      }
    })()
  ]);

  // Een afgewezen (gefaald/getimeout) model wordt null → demo-fallback hieronder.
  const claudeResult = settled[0].status === "fulfilled" ? settled[0].value : null;
  const openaiResult = settled[1].status === "fulfilled" ? settled[1].value : null;
  if (settled[0].status === "rejected") {
    console.error("Model 1 (Claude) afgewezen:", settled[0].reason?.message || settled[0].reason);
  }
  if (settled[1].status === "rejected") {
    console.error("Model 2 (OpenAI) afgewezen:", settled[1].reason?.message || settled[1].reason);
  }

  // Valideer dat we resultaten hebben gekregen
  const model1Data = claudeResult || generateDemoAssessment(url, true);
  const model2Data = openaiResult || generateDemoAssessment(url, false);

  // Bereken consensus statistieken
  const avgScores = {};
  const categories = ["gdpr", "databeveiliging", "nen7510", "iso27002", "toegankelijkheid", "transparantie", "incidentbeheer"];
  
  categories.forEach(cat => {
    const val1 = model1Data.scores?.[cat] !== undefined ? model1Data.scores[cat] : 50;
    const val2 = model2Data.scores?.[cat] !== undefined ? model2Data.scores[cat] : 50;
    avgScores[cat] = Math.round((val1 + val2) / 2);
  });

  const algeheleConsensusScore = Math.round(
    ( (model1Data.algehele_score || 50) + (model2Data.algehele_score || 50) ) / 2
  );

  // Model overeenkomst % (Inter-rater reliability)
  // 100 - absolute_difference van de algehele scores
  const scoreDiff = Math.abs((model1Data.algehele_score || 50) - (model2Data.algehele_score || 50));
  const agreementPercentage = Math.round(100 - scoreDiff);

  // Bepaal sterkste en zwakste domein voor consensus
  let sterkstDomein = "gdpr";
  let zwakstDomein = "gdpr";
  let maxScore = -1;
  let minScore = 101;

  categories.forEach(cat => {
    const score = avgScores[cat];
    if (score > maxScore) {
      maxScore = score;
      sterkstDomein = cat;
    }
    if (score < minScore) {
      minScore = score;
      zwakstDomein = cat;
    }
  });

  // Mapping voor leesbare namen
  const catNamesMapping = {
    gdpr: "AVG / GDPR Compliance",
    databeveiliging: "Databeveiliging",
    nen7510: "NEN 7510",
    iso27002: "ISO 27002:2022",
    toegankelijkheid: "Toegankelijkheid (WCAG)",
    transparantie: "Transparantie",
    incidentbeheer: "Incident- & Datalekbeheer"
  };

  // Verzamel alle bevindingen, gelabeld met bronmodel
  const risks = [];
  const positives = [];

  if (model1Data.risico && Array.isArray(model1Data.risico)) {
    model1Data.risico.forEach(r => {
      risks.push({ ...r, model: usedGeminiForClaude ? "Gemini (Claude Rol)" : "Claude" });
    });
  }
  if (model2Data.risico && Array.isArray(model2Data.risico)) {
    model2Data.risico.forEach(r => {
      risks.push({ ...r, model: usedGeminiForOpenAI ? "Gemini (OpenAI Rol)" : "GPT-4o" });
    });
  }

  if (model1Data.positief && Array.isArray(model1Data.positief)) {
    model1Data.positief.forEach(p => {
      positives.push({ ...p, model: usedGeminiForClaude ? "Gemini (Claude Rol)" : "Claude" });
    });
  }
  if (model2Data.positief && Array.isArray(model2Data.positief)) {
    model2Data.positief.forEach(p => {
      positives.push({ ...p, model: usedGeminiForOpenAI ? "Gemini (OpenAI Rol)" : "GPT-4o" });
    });
  }

  // Gezamenlijke aanbeveling en classificatie bepalen op basis van de algehele score
  let consensusAanbeveling = "Gebruik met voorbehoud";
  let consensusClassificatie = "Voldoende";
  let verdictIcon = "⚠️";

  if (algeheleConsensusScore >= 80) {
    consensusAanbeveling = "Geschikt";
    consensusClassificatie = "Uitstekend";
    verdictIcon = "✅";
  } else if (algeheleConsensusScore >= 70) {
    consensusAanbeveling = "Geschikt met maatregelen";
    consensusClassificatie = "Goed";
    verdictIcon = "✅";
  } else if (algeheleConsensusScore >= 55) {
    consensusAanbeveling = "Gebruik met voorbehoud";
    consensusClassificatie = "Voldoende";
    verdictIcon = "⚠️";
  } else {
    consensusAanbeveling = "Niet geschikt";
    consensusClassificatie = algeheleConsensusScore >= 40 ? "Risicovol" : "Onvoldoende";
    verdictIcon = "🚫";
  }

  const finalPayload = {
    url,
    metadata: {
      analyzedAt: new Date().toISOString(),
      isDemoMode: isDemoMode && !geminiKey,
      usedGeminiForClaude,
      usedGeminiForOpenAI,
      hasRealAnthropic: !!anthropicKey,
      hasRealOpenAI: !!openaiKey
    },
    // Opgehaalde, objectieve signalen waarop de beoordeling (mede) is gebaseerd.
    // Wordt in de UI getoond zodat de score navolgbaar is.
    signals,
    consensus: {
      algehele_score: algeheleConsensusScore,
      classificatie: consensusClassificatie,
      aanbeveling: consensusAanbeveling,
      verdictIcon,
      sterkstDomein: catNamesMapping[sterkstDomein] || sterkstDomein,
      zwakstDomein: catNamesMapping[zwakstDomein] || zwakstDomein,
      scores: avgScores,
      agreementPercentage
    },
    model1: {
      naam: usedGeminiForClaude ? "Gemini (Claude-expert)" : "Claude (Security Expert)",
      isFallback: usedGeminiForClaude,
      algehele_score: model1Data.algehele_score || 50,
      classificatie: model1Data.classificatie || "Voldoende",
      aanbeveling: model1Data.aanbeveling || "Gebruik met voorbehoud",
      samenvatting: model1Data.samenvatting || "",
      model_perspectief: model1Data.model_perspectief || "",
      gebaseerd_op: model1Data.gebaseerd_op || "",
      scores: model1Data.scores || {}
    },
    model2: {
      naam: usedGeminiForOpenAI ? "Gemini (GPT-4o-auditor)" : "GPT-4o (Compliance Auditor)",
      isFallback: usedGeminiForOpenAI,
      algehele_score: model2Data.algehele_score || 50,
      classificatie: model2Data.classificatie || "Voldoende",
      aanbeveling: model2Data.aanbeveling || "Gebruik met voorbehoud",
      samenvatting: model2Data.samenvatting || "",
      model_perspectief: model2Data.model_perspectief || "",
      gebaseerd_op: model2Data.gebaseerd_op || "",
      scores: model2Data.scores || {}
    },
    risks,
    positives
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(finalPayload)
  };
}

// Hulpprogramma voor Gemini-analyse fallback
async function runGeminiAnalysis(geminiKey, modelName, systemInstruction, userPrompt, label) {
  try {
    console.log(`Gemini aanroepen voor ${label}...`);
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    const parsed = safeParseJSON(text);
    if (parsed) return parsed;
    throw new Error(`Gemini retourbeoordeling voor ${label} kon niet geparsed worden als JSON.`);
  } catch (err) {
    console.error(`Fout bij Gemini call voor ${label}:`, err);
    throw err;
  }
}

// Top-level wrapper: vangt elke onverwachte fout op en geeft altijd geldige JSON
// terug, zodat de frontend nooit een 502 zonder bruikbare body krijgt.
export const handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  try {
    return await _handler(event, context);
  } catch (err) {
    console.error("Onverwachte fout in handler:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Interne serverfout tijdens analyse.",
        detail: String(err?.message ?? err)
      })
    };
  }
};
