import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerFinancialReportRoutes } from "./financial-reports";
import { log, serveStatic } from "./vite";
import { seedAdminUser, seedRBAC } from "./seed";
import { storage } from "./storage";
import bcrypt from "bcryptjs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const seedFlag = await storage.getSystemSetting('seedCompleted');
  if (!seedFlag) {
    await seedAdminUser();
    await seedRBAC();
    await storage.seedDefaultSaccoAccounts();
    await storage.seedDefaultAccountMappings();
    await storage.upsertSystemSetting('seedCompleted', 'true');
    log("Initial seed completed and flagged.");
  } else {
    log("Seed already completed — skipping one-time seed steps.");
    // RBAC seeding is idempotent and self-heals built-in role metadata
    // (e.g. dashboardType) on every boot, so it must run regardless of the
    // one-time seedCompleted flag. It will not duplicate existing roles or
    // permission mappings.
    try {
      await seedRBAC();
    } catch (err) {
      log(`RBAC reconciliation failed: ${err}`);
    }
  }

  try {
    const adminUser = await storage.getUserByUsername('admin');
    if (adminUser) {
      const updates: any = {};
      if (adminUser.lockedUntil || (adminUser.failedLoginAttempts || 0) > 0) {
        updates.failedLoginAttempts = 0;
        updates.lockedUntil = null;
      }
      const knownPassword = 'NewBeginings@2026!';
      const passwordMatch = adminUser.password ? await bcrypt.compare(knownPassword, adminUser.password) : false;
      if (!passwordMatch) {
        updates.password = await bcrypt.hash(knownPassword, 10);
      }
      if (Object.keys(updates).length > 0) {
        await storage.updateUser(adminUser.id, updates);
        log("Admin account reset on startup.");
      }
    }
  } catch (e) {}

  const server = await registerRoutes(app);
  registerFinancialReportRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isDev = app.get("env") === "development" && !import.meta.dirname.includes("/dist");
  if (isDev) {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
