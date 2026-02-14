import Role from "../modules/role/role.model";
import User from "../modules/user/user.model";

export const seedSuperAdmin = async () => {
  try {
    // 1. Find or Create SUPER_ADMIN Role
    let superAdminRole = await Role.findOne({ code: "SUPER_ADMIN" });

    // Define full permissions
    const allPermissions = {
      dashboard: { view: true },
      users: { view: true, create: true, edit: true, delete: true },
      roles: { view: true, create: true, edit: true, delete: true },
      stores: { view: true, create: true, edit: true, delete: true },
      recce: { view: true, create: true, edit: true, delete: true },
      installation: { view: true, create: true, edit: true, delete: true },
    };

    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: "Super Admin",
        code: "SUPER_ADMIN",
        permissions: allPermissions,
      });
      console.log("✅ Super Admin role created");
    } else {
      // Optional: Ensure permissions are up to date
      superAdminRole.permissions = allPermissions as any;
      await superAdminRole.save();
    }

    // 2. Find Super Admin User
    const existingUser = await User.findOne({ email: "admin@elora.com" });

    if (existingUser) {
      // --- FIX LOGIC ---
      // Cast to 'any' so we can check 'roles.length' without TS complaining
      const userAny = existingUser as any;

      if (
        !userAny.roles ||
        !Array.isArray(userAny.roles) ||
        userAny.roles.length === 0
      ) {
        console.log("⚠️  Super Admin found without roles. Fixing now...");

        existingUser.roles = [superAdminRole._id] as any;

        await existingUser.save();
        console.log("✅ Fixed: Super Admin roles updated successfully.");
      } else {
        console.log("ℹ Super Admin user already exists and is valid.");
      }
      return;
    }

    // 3. Create User if doesn't exist
    await User.create({
      name: "Super Admin",
      email: "admin@elora.com",
      password: "Admin@123",
      roles: [superAdminRole._id],
      isActive: true,
    });

    console.log("✅ Super Admin user seeded successfully");
  } catch (error) {
    console.error("❌ Seed Error:", error);
  }
};
