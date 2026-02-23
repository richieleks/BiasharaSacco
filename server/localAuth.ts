import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function setupLocalAuth() {
  // Configure local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          // Find user by username
          const user = await storage.getUserByUsername(username);
          
          if (!user) {
            return done(null, false, { message: "Invalid username or password" });
          }

          // Check if user has a password (local auth)
          if (!user.password || user.authMethod !== "local") {
            return done(null, false, { message: "Please use Replit login for this account" });
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.password);
          
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid username or password" });
          }

          // Check if user has a member profile that requires approval
          const staffRoles = ['admin', 'manager', 'committee', 'teller', 'treasurer'];
          const isStaffUser = user.role && staffRoles.includes(user.role);
          
          if (!isStaffUser) {
            const member = await storage.getMemberByUserId(user.id);
            if (member && member.status !== 'active') {
              return done(null, false, { message: "Your account is pending approval. Please contact the SACCO administrator." });
            }
          }

          // Return user without password
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

// Hash password utility
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Verify password utility
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}