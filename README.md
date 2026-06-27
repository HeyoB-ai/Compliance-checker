# MedSec Compliance Checker

Een complete, productieklare full-stack webapplicatie voor het automatisch toetsen van webapplicaties op **dataveiligheid, GDPR/AVG compliance, en geschiktheid voor de Nederlandse medische sector (NEN 7510 & ISO 27002)**.

De applicatie maakt gebruik van twee onafhankelijke AI-expertises (Claude en GPT-4o) die parallel worden aangeroepen om een objectief consensusoordeel te vellen.

---

## 🛠️ Structuur van de Repository

```
/
├── index.html                  # HTML entrypoint
├── server.ts                   # Express + Vite Full-stack server voor lokale ontwikkeling en preview
├── vite.config.ts              # Vite configuratie
├── package.json                # Project dependencies & scripts
├── netlify.toml                # Netlify configuratie voor serverless hosting
├── netlify/
│   └── functions/
│       └── analyze.js          # Serverless Netlify Function (LLM API Router & Analyse)
└── src/
    ├── main.tsx                # React entrypoint
    ├── App.tsx                 # Hoofddashboard (Dutch, Dark Technical theme)
    ├── types.ts                # TypeScript interfaces & types
    ├── index.css               # Global CSS & Tailwind v4 configuratie
    └── mockData.ts             # Default mock assessment data voor directe demonstratie
```

---

## 🚀 Netlify Deployment Instructies (GitHub → Netlify)

Dit project is zo ontworpen dat het met één klik kan worden gepusht naar GitHub en gekoppeld aan Netlify. De API-aanroepen worden veilig verwerkt via **Netlify Functions** om CORS-fouten te voorkomen en API-sleutels geheim te houden.

### Stap 1: Push naar GitHub
1. Initialiseer een git repository in de hoofdmap van dit project:
   ```bash
   git init
   git add .
   git commit -m "feat: MedSec Compliance Checker initial commit"
   ```
2. Maak een nieuwe repository aan op GitHub en push uw code.

### Stap 2: Verbind met Netlify
1. Log in op uw [Netlify Dashboard](https://app.netlify.com/).
2. Klik op **"Add new site"** en selecteer **"Import an existing project"**.
3. Kies **GitHub** en geef Netlify toestemming om de zojuist gemaakte repository in te lezen.
4. Netlify herkent de instellingen in `netlify.toml` automatisch:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`

### Stap 3: Configureer Omgevingsvariabelen (Environment Variables)
Voor een werkende live-analyse moet u uw API-sleutels toevoegen in het Netlify Dashboard:
1. Navigeer in Netlify naar **Site settings** → **Environment variables**.
2. Klik op **"Add a variable"** en voeg de volgende twee variabelen toe:

| Variabele Naam | Beschrijving | Modelrol |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | Uw Anthropic API Key | Claude (Security Expert) |
| `OPENAI_API_KEY` | Uw OpenAI API Key | GPT-4o (Compliance Auditor) |

*Optioneel:* U kunt ook `GEMINI_API_KEY` toevoegen om te dienen als automatische fallback-motor indien een van de andere providers een storing heeft of niet is ingesteld.

---

## 💻 Lokale Ontwikkeling & AI Studio Preview

In de lokale omgeving (of binnen Google AI Studio) fungeert een lichtgewicht **Express + Vite** server als backend om de Netlify-functies te simuleren.

### Vereisten
- Node.js (versie 18 of hoger)
- npm

### Installatie & Opstarten
1. Installeer de project-dependencies:
   ```bash
   npm install
   ```
2. Start de ontwikkelserver:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in uw browser.

---

## 🔒 Beveiliging & Architectuur

- **Geen API-sleutels in de client:** Sleutels worden uitsluitend server-side uitgelezen uit de procesomgeving (`process.env`). Ze worden nooit verzonden naar of opgeslagen in de browser van de gebruiker.
- **CORS Oplossing:** Door gebruik te maken van `/netlify/functions/analyze` praten de frontend en de API over hetzelfde domein, waardoor browser CORS-beperkingen volledig worden omzeild.
- **Robuustheid & Fallbacks:** Mocht u de sleutels nog niet hebben geconfigureerd, dan toont de app automatisch een waarschuwing en draait de app in een uiterst realistische **Demo Modus** of een **Gemini fallback** zodat de interface altijd functioneert en gedemonstreerd kan worden.
