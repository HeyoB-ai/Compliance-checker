import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Laad omgevingsvariabelen
dotenv.config();

// Directe import van onze Netlify handler om api requests te verwerken
import { handler as analyzeHandler } from "./netlify/functions/analyze.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request body parser inschakelen
  app.use(express.json());

  // Log alle API verzoeken
  app.use((req, res, next) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/.netlify")) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });

  // Koppel /.netlify/functions/analyze aan onze lokale Netlify handler
  app.post("/.netlify/functions/analyze", async (req, res) => {
    try {
      const mockEvent = {
        httpMethod: "POST",
        body: JSON.stringify(req.body),
        headers: req.headers
      };
      
      const result = await analyzeHandler(mockEvent, {});
      
      // Headers overzetten
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      res.status(result.statusCode || 200).send(result.body);
    } catch (error: any) {
      console.error("Fout in server analyze handler:", error);
      res.status(500).json({ error: error?.message || "Interne serverfout tijdens de analyse." });
    }
  });

  // Ondersteun ook /api/analyze voor maximale compatibiliteit
  app.post("/api/analyze", async (req, res) => {
    try {
      const mockEvent = {
        httpMethod: "POST",
        body: JSON.stringify(req.body),
        headers: req.headers
      };
      
      const result = await analyzeHandler(mockEvent, {});
      
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      res.status(result.statusCode || 200).send(result.body);
    } catch (error: any) {
      console.error("Fout in server api/analyze handler:", error);
      res.status(500).json({ error: error?.message || "Interne serverfout tijdens de analyse." });
    }
  });

  // Vite middleware inladen in development modus
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MedSec Server] Live op http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fout bij starten van de server:", err);
});
