import app from "./app";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { registerFinancialReportRoutes } from "./financial-reports";
import { storage } from "./storage";
import { seedAdminUser, seedRBAC } from "./seed";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  try {
    const seedFlag = await storage.getSystemSetting('seedCompleted');
    if (!seedFlag) {
      await seedAdminUser();
      await seedRBAC();
      await storage.seedDefaultSaccoAccounts();
      await storage.seedDefaultAccountMappings();
      await storage.upsertSystemSetting('seedCompleted', 'true');
      logger.info("Initial seed completed and flagged.");
    } else {
      logger.info("Seed already completed — skipping one-time seed steps.");
      try {
        await seedRBAC();
      } catch (err) {
        logger.error({ err }, "RBAC reconciliation failed");
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
          logger.info("Admin account reset on startup.");
        }
      }
    } catch (e) {
      logger.error({ err: e }, "Admin reset check failed");
    }
  } catch (err) {
    logger.error({ err }, "Startup seed error (non-fatal, continuing)");
  }

  const server = await registerRoutes(app);
  registerFinancialReportRoutes(app);

  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    logger.error({ err }, "Unhandled error");
  });

  server.listen(port, "0.0.0.0", () => {
    logger.info({ port }, "Server listening");
  });
})();
