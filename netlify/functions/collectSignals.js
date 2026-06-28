// Signaal-verzamelaar: haalt objectief meetbare, externe signalen op van de
// doel-URL zodat de LLM's beoordelen op feiten i.p.v. gokken.
//
// Ontwerpprincipes:
// - Nooit gooien: elk niet-ophaalbaar signaal wordt "onbekend", geen crash.
// - Strak tijdsbudget: per-fetch AbortController + een hard totaalbudget,
//   zodat dit ruim binnen de Netlify-limiet (26s) blijft vóór de LLM-calls.
// - Nette User-Agent, en faal-eerlijk bij bot-detectie / blokkades.

const USER_AGENT =
  "MedSecComplianceChecker/1.0 (+https://zorgcompliance.netlify.app; geautomatiseerde compliance-signaalscan)";

const SECURITY_HEADERS = [
  { key: "strict-transport-security", naam: "Strict-Transport-Security (HSTS)" },
  { key: "content-security-policy", naam: "Content-Security-Policy (CSP)" },
  { key: "x-frame-options", naam: "X-Frame-Options" },
  { key: "x-content-type-options", naam: "X-Content-Type-Options" },
  { key: "referrer-policy", naam: "Referrer-Policy" },
  { key: "permissions-policy", naam: "Permissions-Policy" }
];

const EU_TLDS = [
  ".nl", ".eu", ".be", ".de", ".fr", ".lu", ".at", ".es", ".it", ".pt",
  ".ie", ".dk", ".se", ".fi", ".pl", ".cz", ".sk", ".hu", ".ro", ".bg",
  ".gr", ".hr", ".si", ".ee", ".lv", ".lt", ".mt", ".cy"
];

async function fetchWithTimeout(url, options = {}, ms = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      ...options,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
        "Accept-Language": "nl,en;q=0.8",
        ...(options.headers || {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
}

// Lees de body, maar begrens de grootte zodat een enorme pagina geen tijd/geheugen vreet.
async function readCapped(res, maxChars = 500000) {
  try {
    const text = await res.text();
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  } catch {
    return "";
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Zoek normen/certificeringen die de site zelf claimt. Dit bewijst NIET dat ze
// gecertificeerd zijn — het is een claim op de eigen site.
function scanCertificeringen(text, bronUrl, acc) {
  const lc = text.toLowerCase();
  const patronen = [
    { norm: "NEN 7510", re: /nen[\s-]*7510/ },
    { norm: "NEN 7512", re: /nen[\s-]*7512/ },
    { norm: "NEN 7513", re: /nen[\s-]*7513/ },
    { norm: "ISO 27001", re: /iso[\s/]*(?:iec[\s]*)?27001/ },
    { norm: "ISO 27002", re: /iso[\s/]*(?:iec[\s]*)?27002/ },
    { norm: "ISO 27799", re: /iso[\s/]*(?:iec[\s]*)?27799/ }
  ];
  for (const p of patronen) {
    if (p.re.test(lc) && !acc.some((a) => a.norm === p.norm)) {
      acc.push({ norm: p.norm, op: bronUrl });
    }
  }
  // Algemene volwassenheidswoorden (alleen genoemd, niet per norm)
  const trefwoorden = [];
  if (/\bgecertificeerd\b|\bcertificaat\b|\bcertificering\b/.test(lc)) trefwoorden.push("certificering genoemd");
  if (/\bkeurmerk\b/.test(lc)) trefwoorden.push("keurmerk genoemd");
  if (/\baudit\b|\bisae[\s]*3402\b/.test(lc)) trefwoorden.push("audit/ISAE 3402 genoemd");
  return trefwoorden;
}

function scanPrivacySignalen(text) {
  const lc = text.toLowerCase();
  return [
    { key: "avg", naam: "Verwijzing naar AVG/GDPR", gevonden: /\bavg\b|\bgdpr\b|algemene verordening gegevensbescherming/.test(lc) },
    { key: "verwerkersovereenkomst", naam: "Verwerkersovereenkomst (DPA)", gevonden: /verwerkersovereenkomst|verwerkers­overeenkomst|data processing agreement|\bdpa\b/.test(lc) },
    { key: "fgDpo", naam: "Functionaris Gegevensbescherming (FG/DPO)", gevonden: /functionaris (?:voor )?(?:de )?gegevensbescherming|\bfg\b|\bdpo\b|data protection officer/.test(lc) },
    { key: "grondslag", naam: "Verwerkingsgrondslag", gevonden: /grondslag|gerechtvaardigd belang|op basis van toestemming|wettelijke verplichting/.test(lc) },
    { key: "bewaartermijn", naam: "Bewaartermijnen", gevonden: /bewaartermijn|bewaartijd|hoe lang.{0,30}bewaren|wij bewaren/.test(lc) },
    { key: "rechten", naam: "Rechten van betrokkenen", gevonden: /recht op inzage|rechten van betrokkenen|recht op (?:verwijdering|vergetelheid|correctie|rectificatie)|gegevens (?:in te zien|laten verwijderen)/.test(lc) }
  ];
}

function findPrivacyLinks(html, origin, domein) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const trefwoord = /privacy|cookie|gegevensbescherming|avg|privacyverklaring|privacybeleid|privacyreglement/i;
  while ((m = re.exec(html)) !== null && out.length < 8) {
    const href = m[1];
    const tekst = stripHtml(m[2] || "");
    if (!trefwoord.test(href) && !trefwoord.test(tekst)) continue;
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let abs;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.hostname !== domein) continue; // blijf op het eigen domein
    if (!out.includes(abs.href)) out.push(abs.href);
  }
  return out.slice(0, 2);
}

function leegSignaalObject(domein, fouten = []) {
  return {
    domein: domein || null,
    finalUrl: null,
    fetchedAt: new Date().toISOString(),
    reachable: "onbekend",
    https: { status: "onbekend", httpsBereikbaar: null, httpDoorverwijzing: null, tlsOk: null, bron: "HTTPS-respons hoofdpagina" },
    securityHeaders: {
      status: "onbekend",
      items: SECURITY_HEADERS.map((h) => ({ naam: h.naam, aanwezig: null, waarde: null })),
      aanwezig: 0,
      totaal: SECURITY_HEADERS.length,
      bron: "Response headers hoofdpagina"
    },
    securityTxt: { status: "onbekend", gevondenOp: null, heeftContact: null, heeftPolicy: null, bron: "/.well-known/security.txt" },
    privacybeleid: { status: "onbekend", gevondenOp: null, items: scanPrivacySignalen("").map((s) => ({ ...s, gevonden: false })), bron: "Privacy-/cookiepagina" },
    certificeringen: { status: "onbekend", gevonden: [], trefwoorden: [], bron: "HTML/tekst van eigen site (geclaimd)" },
    metaInfo: { taal: null, heeftContactOfColofon: null, euTld: null, bron: "Hoofdpagina HTML" },
    fouten
  };
}

/**
 * Verzamelt externe signalen voor de gegeven URL.
 * @param {string} rawUrl
 * @param {{ budgetMs?: number }} opts  hard totaalbudget in ms (default 8000)
 * @returns {Promise<object>} signals (gooit nooit)
 */
export async function collectSignals(rawUrl, opts = {}) {
  const budgetMs = opts.budgetMs ?? 8000;
  const started = Date.now();
  const remaining = () => budgetMs - (Date.now() - started);

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl);
  } catch {
    return leegSignaalObject(null, ["Ongeldige URL — kon niet worden geparset."]);
  }
  parsed.protocol = "https:";
  const domein = parsed.hostname;
  const origin = `https://${domein}`;
  const signals = leegSignaalObject(domein);

  // EU-TLD (indicatief)
  signals.metaInfo.euTld = EU_TLDS.some((t) => domein.endsWith(t));

  // --- FASE A: parallelle fetches (hoofdpagina, http→https, security.txt x2) ---
  const fetchCap = () => Math.max(1500, Math.min(6000, remaining()));
  const [mainSettled, httpSettled, secWk, secLegacy] = await Promise.allSettled([
    fetchWithTimeout(parsed.toString(), {}, fetchCap()),
    fetchWithTimeout("http://" + domein, {}, Math.min(5000, fetchCap())),
    fetchWithTimeout(origin + "/.well-known/security.txt", {}, Math.min(5000, fetchCap())),
    fetchWithTimeout(origin + "/security.txt", {}, Math.min(5000, fetchCap()))
  ]);

  // Hoofdpagina + securityheaders + TLS
  let mainHtml = "";
  if (mainSettled.status === "fulfilled") {
    const res = mainSettled.value;
    signals.reachable = "gevonden";
    signals.finalUrl = res.url || parsed.toString();
    signals.https.httpsBereikbaar = true;
    signals.https.tlsOk = true;
    signals.https.status = "gevonden";

    let aanwezig = 0;
    signals.securityHeaders.items = SECURITY_HEADERS.map((h) => {
      const waarde = res.headers.get(h.key);
      if (waarde) aanwezig++;
      return { naam: h.naam, aanwezig: !!waarde, waarde: waarde ? String(waarde).slice(0, 300) : null };
    });
    signals.securityHeaders.aanwezig = aanwezig;
    signals.securityHeaders.status = "gevonden";

    mainHtml = await readCapped(res);
  } else {
    const reason = mainSettled.reason;
    const isAbort = reason?.name === "AbortError";
    signals.reachable = "afwezig";
    signals.https.httpsBereikbaar = false;
    signals.https.tlsOk = false;
    signals.https.status = "afwezig";
    signals.fouten.push(
      isAbort
        ? "Hoofdpagina niet binnen tijdslimiet opgehaald (time-out)."
        : `Hoofdpagina niet over HTTPS bereikbaar: ${reason?.message || "onbekende fout"}.`
    );
  }

  // http → https doorverwijzing
  if (httpSettled.status === "fulfilled") {
    const finalUrl = httpSettled.value.url || "";
    signals.https.httpDoorverwijzing = finalUrl.startsWith("https://");
  } else {
    signals.https.httpDoorverwijzing = null; // onbekend
  }

  // security.txt (well-known heeft voorkeur, anders legacy)
  const secCandidates = [
    { settled: secWk, url: origin + "/.well-known/security.txt" },
    { settled: secLegacy, url: origin + "/security.txt" }
  ];
  let secDone = false;
  for (const c of secCandidates) {
    if (secDone) break;
    if (c.settled.status === "fulfilled" && c.settled.value.ok) {
      const ct = c.settled.value.headers.get("content-type") || "";
      const body = await readCapped(c.settled.value, 20000);
      // Een HTML-404-pagina kan 200 geven; eis dat het op security.txt lijkt.
      const lijktSecTxt = /contact\s*:/i.test(body) || /policy\s*:/i.test(body) || ct.includes("text/plain");
      if (lijktSecTxt) {
        signals.securityTxt.status = "gevonden";
        signals.securityTxt.gevondenOp = c.url;
        signals.securityTxt.heeftContact = /contact\s*:/i.test(body);
        signals.securityTxt.heeftPolicy = /policy\s*:/i.test(body);
        secDone = true;
      }
    }
  }
  if (!secDone) {
    const beideKlaar = secWk.status !== "rejected" || secLegacy.status !== "rejected";
    const beideTimeout = secWk.reason?.name === "AbortError" && secLegacy.reason?.name === "AbortError";
    signals.securityTxt.status = beideTimeout ? "onbekend" : beideKlaar ? "afwezig" : "onbekend";
  }

  // Metadata uit hoofdpagina-HTML
  if (mainHtml) {
    const langMatch = mainHtml.match(/<html[^>]*\blang=["']([^"']+)["']/i);
    signals.metaInfo.taal = langMatch ? langMatch[1] : null;
    const platte = stripHtml(mainHtml).toLowerCase();
    signals.metaInfo.heeftContactOfColofon = /contact|colofon|over ons|imprint/.test(platte);

    // Certificeringen geclaimd op hoofdpagina
    const trefMain = scanCertificeringen(platte, signals.finalUrl || parsed.toString(), signals.certificeringen.gevonden);
    signals.certificeringen.trefwoorden.push(...trefMain);
  }

  // --- FASE B: privacy-/cookiepagina ophalen (binnen resterend budget) ---
  if (mainHtml && remaining() > 1500) {
    const links = findPrivacyLinks(mainHtml, origin, domein);
    if (links.length === 0) {
      signals.privacybeleid.status = "afwezig";
    } else {
      let privText = "";
      let gevondenOp = null;
      for (const link of links) {
        if (remaining() < 1500) break;
        try {
          const pres = await fetchWithTimeout(link, {}, Math.min(5000, remaining()));
          if (pres.ok) {
            const phtml = await readCapped(pres);
            privText += " " + stripHtml(phtml);
            gevondenOp = gevondenOp || (pres.url || link);
          }
        } catch (e) {
          signals.fouten.push(`Privacypagina niet opgehaald (${e?.name === "AbortError" ? "time-out" : "fout"}).`);
        }
      }
      if (gevondenOp) {
        signals.privacybeleid.status = "gevonden";
        signals.privacybeleid.gevondenOp = gevondenOp;
        signals.privacybeleid.items = scanPrivacySignalen(privText);
        // Certificeringen ook op de privacypagina scannen
        const trefPriv = scanCertificeringen(privText.toLowerCase(), gevondenOp, signals.certificeringen.gevonden);
        for (const t of trefPriv) if (!signals.certificeringen.trefwoorden.includes(t)) signals.certificeringen.trefwoorden.push(t);
      } else {
        signals.privacybeleid.status = "afwezig";
      }
    }
  } else if (!mainHtml) {
    signals.privacybeleid.status = "onbekend";
  }

  // Eindstatus certificeringen
  if (signals.certificeringen.gevonden.length > 0 || signals.certificeringen.trefwoorden.length > 0) {
    signals.certificeringen.status = "geclaimd op eigen site";
  } else if (mainHtml) {
    signals.certificeringen.status = "niet gevonden";
  } else {
    signals.certificeringen.status = "onbekend";
  }

  signals.durationMs = Date.now() - started;
  return signals;
}
