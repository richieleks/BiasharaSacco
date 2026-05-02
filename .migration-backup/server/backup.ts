import { storage } from "./storage";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

interface BackupInfo {
  filename: string;
  timestamp: string;
  size: number;
  tables: string[];
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export async function createBackup(): Promise<BackupInfo> {
  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup_${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  const tables: string[] = [];
  const backupData: Record<string, any[]> = {};

  try {
    const membersResult = await storage.getAllMembers();
    backupData.members = membersResult;
    tables.push(`members (${membersResult.length})`);
  } catch (e) {
    console.error("Backup: failed to export members", e);
  }

  try {
    const savingsResult = await storage.getAllSavingsAccounts();
    backupData.savingsAccounts = savingsResult;
    tables.push(`savingsAccounts (${savingsResult.length})`);
  } catch (e) {
    console.error("Backup: failed to export savings accounts", e);
  }

  try {
    const loansResult = await storage.getAllLoans();
    backupData.loans = loansResult;
    tables.push(`loans (${loansResult.length})`);
  } catch (e) {
    console.error("Backup: failed to export loans", e);
  }

  try {
    const transactionsResult = await storage.getAllTransactions();
    backupData.transactions = transactionsResult;
    tables.push(`transactions (${transactionsResult.length})`);
  } catch (e) {
    console.error("Backup: failed to export transactions", e);
  }

  try {
    const settingsResult = await storage.getAllSystemSettings();
    backupData.systemSettings = settingsResult;
    tables.push(`systemSettings (${settingsResult.length})`);
  } catch (e) {
    console.error("Backup: failed to export system settings", e);
  }

  backupData.metadata = {
    createdAt: new Date().toISOString(),
    version: "1.0",
    tables: tables,
  };

  const sensitiveFields = ['password', 'twoFactorSecret'];
  const sanitize = (data: any): any => {
    if (Array.isArray(data)) return data.map(sanitize);
    if (data && typeof data === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (sensitiveFields.includes(key)) continue;
        cleaned[key] = sanitize(value);
      }
      return cleaned;
    }
    return data;
  };
  const sanitizedData = sanitize(backupData);

  const jsonString = JSON.stringify(sanitizedData, null, 2);
  fs.writeFileSync(filepath, jsonString, "utf-8");

  const stats = fs.statSync(filepath);

  const maxBackups = 10;
  cleanupOldBackups(maxBackups);

  return {
    filename,
    timestamp: new Date().toISOString(),
    size: stats.size,
    tables,
  };
}

function cleanupOldBackups(maxKeep: number) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxKeep) {
      for (const file of files.slice(maxKeep)) {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
      }
    }
  } catch (e) {
    console.error("Backup cleanup error:", e);
  }
}

export function getBackupList(): BackupInfo[] {
  ensureBackupDir();
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .map(f => {
        const filepath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filepath);
        let tables: string[] = [];
        try {
          const content = JSON.parse(fs.readFileSync(filepath, "utf-8"));
          tables = content.metadata?.tables || [];
        } catch (e) {}
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          size: stats.size,
          tables,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    return [];
  }
}

export function downloadBackup(filename: string): string | null {
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filename.startsWith("backup_") || !filename.endsWith(".json")) {
    return null;
  }
  if (!fs.existsSync(filepath)) {
    return null;
  }
  return filepath;
}

let backupInterval: NodeJS.Timeout | null = null;

export async function startScheduledBackups() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }

  try {
    const allSettings = await storage.getAllSystemSettings();
    let autoEnabled = true;
    let frequency = "daily";

    for (const s of allSettings) {
      if (s.settingKey === "autoBackupEnabled") autoEnabled = s.settingValue === "true";
      if (s.settingKey === "backupFrequency") frequency = s.settingValue;
    }

    if (!autoEnabled) {
      console.log("[backup] Auto backup is disabled");
      return;
    }

    let intervalMs: number;
    switch (frequency) {
      case "daily":
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case "weekly":
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case "monthly":
        intervalMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        intervalMs = 24 * 60 * 60 * 1000;
    }

    console.log(`[backup] Scheduled auto backup every ${frequency} (${intervalMs / 3600000}h)`);

    backupInterval = setInterval(async () => {
      try {
        const settings = await storage.getAllSystemSettings();
        let stillEnabled = true;
        for (const s of settings) {
          if (s.settingKey === "autoBackupEnabled") stillEnabled = s.settingValue === "true";
        }
        if (!stillEnabled) {
          console.log("[backup] Auto backup disabled, skipping scheduled run");
          return;
        }
        console.log("[backup] Running scheduled backup...");
        const result = await createBackup();
        console.log(`[backup] Backup completed: ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`);
      } catch (error) {
        console.error("[backup] Scheduled backup failed:", error);
      }
    }, intervalMs);
  } catch (error) {
    console.error("[backup] Failed to initialize scheduled backups:", error);
  }
}

export function restartScheduledBackups() {
  startScheduledBackups();
}
