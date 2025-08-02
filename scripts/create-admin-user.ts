import { db } from "../server/db";
import { users, members, memberRoles, roles } from "../shared/schema";
import { hashPassword } from "../server/localAuth";
import { eq } from "drizzle-orm";

async function createAdminUser() {
  try {
    // Check if admin role exists
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'admin'));
    if (!adminRole) {
      console.error("Admin role does not exist. Please run role seeding first.");
      process.exit(1);
    }

    // Admin credentials
    const adminUsername = "admin";
    const adminPassword = "admin123"; // Change this in production
    const adminEmail = "admin@biasharasacco.com";

    // Check if admin user already exists
    const [existingAdmin] = await db.select().from(users).where(eq(users.username, adminUsername));
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);

    // Create admin user
    const adminUserId = `local_admin_${Date.now()}`;
    const [adminUser] = await db.insert(users).values({
      id: adminUserId,
      username: adminUsername,
      password: hashedPassword,
      email: adminEmail,
      firstName: "System",
      lastName: "Administrator",
      authMethod: "local",
      role: "admin"
    }).returning();

    console.log("Admin user created successfully");

    // Create member profile for admin
    const [adminMember] = await db.insert(members).values({
      userId: adminUserId,
      memberNumber: "ADMIN001",
      fullName: "System Administrator",
      idNumber: "ADMIN001",
      phoneNumber: adminEmail,
      status: "active",
      role: "admin",
      approvedBy: adminUserId,
      approvedAt: new Date()
    }).returning();

    console.log("Admin member profile created");

    // Assign admin role to the member
    await db.insert(memberRoles).values({
      memberId: adminMember.id,
      role: adminRole.name,
      assignedBy: adminUserId
    });

    console.log("Admin role assigned successfully");

    console.log("\n========================================");
    console.log("Admin user created successfully!");
    console.log("Username:", adminUsername);
    console.log("Password:", adminPassword);
    console.log("Please change the password after first login");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

// Run the script
createAdminUser();