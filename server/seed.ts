import { storage } from "./storage";
import { hashPassword } from "./localAuth";
import { log } from "./vite";

export async function seedAdminUser() {
  try {
    const existingUsers = await storage.getAllUsers();
    const adminExists = existingUsers.some(u => u.role === "admin");
    
    if (!adminExists) {
      const hashedPassword = await hashPassword("NewBeginings@2026!");
      const adminId = `usr_${crypto.randomUUID()}`;
      
      await storage.upsertUser({
        id: adminId,
        username: "dleku",
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        authMethod: "local",
        mustChangePassword: false,
      });
      
      log("Admin user 'dleku' created successfully");
    }
  } catch (error) {
    log(`Admin seed check: ${error}`);
  }
}
