import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function createDennisLekuCredentials() {
  try {
    // Generate username and password
    const username = "dennisleku";
    const password = "dennis123"; // You should change this on first login
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update DENNIS LEKU's user account
    const [updatedUser] = await db
      .update(users)
      .set({
        username: username,
        password: hashedPassword,
        authMethod: "local",
        updatedAt: new Date()
      })
      .where(eq(users.id, "43104392"))
      .returning();
    
    if (updatedUser) {
      console.log("✅ Successfully created credentials for DENNIS LEKU");
      console.log("📧 Email:", updatedUser.email);
      console.log("👤 Username:", username);
      console.log("🔑 Password:", password);
      console.log("\n⚠️  Please change the password on first login!");
    } else {
      console.error("❌ User not found");
    }
  } catch (error) {
    console.error("❌ Error creating credentials:", error);
  } finally {
    process.exit();
  }
}

createDennisLekuCredentials();