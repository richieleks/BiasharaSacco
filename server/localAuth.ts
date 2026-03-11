import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const LOCKOUT_DURATION_MINUTES = 30;

async function getSecuritySettings() {
  const allSettings = await storage.getAllSystemSettings();
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.settingKey] = s.settingValue;
  }
  return {
    maxLoginAttempts: parseInt(settingsMap['maxLoginAttempts'] || '5', 10),
    passwordComplexity: settingsMap['passwordComplexity'] || 'medium',
    sessionTimeout: parseInt(settingsMap['sessionTimeout'] || '240', 10),
  };
}

export function validatePasswordComplexity(password: string, level: string): { valid: boolean; message: string } {
  switch (level) {
    case 'low':
      if (password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters long" };
      }
      return { valid: true, message: "" };

    case 'medium':
      if (password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long" };
      }
      if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter" };
      }
      if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one lowercase letter" };
      }
      if (!/[0-9]/.test(password)) {
        return { valid: false, message: "Password must contain at least one number" };
      }
      return { valid: true, message: "" };

    case 'high':
      if (password.length < 12) {
        return { valid: false, message: "Password must be at least 12 characters long" };
      }
      if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter" };
      }
      if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one lowercase letter" };
      }
      if (!/[0-9]/.test(password)) {
        return { valid: false, message: "Password must contain at least one number" };
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { valid: false, message: "Password must contain at least one special character (!@#$%^&*)" };
      }
      return { valid: true, message: "" };

    default:
      if (password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters long" };
      }
      return { valid: true, message: "" };
  }
}

export function getPasswordRequirementsText(level: string): string {
  switch (level) {
    case 'low':
      return "Minimum 6 characters";
    case 'medium':
      return "Minimum 8 characters with uppercase, lowercase, and number";
    case 'high':
      return "Minimum 12 characters with uppercase, lowercase, number, and special character";
    default:
      return "Minimum 6 characters";
  }
}

export { getSecuritySettings };

export async function setupLocalAuth() {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          const user = await storage.getUserByUsername(username);
          
          if (!user) {
            return done(null, false, { message: "Invalid username or password" });
          }

          if (!user.password || user.authMethod !== "local") {
            return done(null, false, { message: "Please use Replit login for this account" });
          }

          if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return done(null, false, { 
              message: `Account is locked due to too many failed login attempts. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` 
            });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            const settings = await getSecuritySettings();
            const newAttempts = (user.failedLoginAttempts || 0) + 1;
            
            if (newAttempts >= settings.maxLoginAttempts) {
              const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
              await storage.updateUser(user.id, { 
                failedLoginAttempts: newAttempts, 
                lockedUntil: lockUntil 
              });
              return done(null, false, { 
                message: `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes after ${settings.maxLoginAttempts} failed attempts.` 
              });
            } else {
              await storage.updateUser(user.id, { failedLoginAttempts: newAttempts });
              const remaining = settings.maxLoginAttempts - newAttempts;
              return done(null, false, { 
                message: `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.` 
              });
            }
          }

          if ((user.failedLoginAttempts || 0) > 0 || user.lockedUntil) {
            await storage.updateUser(user.id, { failedLoginAttempts: 0, lockedUntil: null });
          }

          const staffRoles = ['admin', 'manager', 'committee', 'teller', 'treasurer'];
          const isStaffUser = user.role && staffRoles.includes(user.role);
          
          if (!isStaffUser) {
            const member = await storage.getMemberByUserId(user.id);
            if (member && member.status !== 'active') {
              return done(null, false, { message: "Your account is pending approval. Please contact the SACCO administrator." });
            }
          }

          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
