const Role = require("./src/modules/role/role.model");
const mongoose = require("mongoose");
require('dotenv').config();

const updateSuperAdminPermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/elora");
    
    const result = await Role.updateOne(
      { code: "SUPER_ADMIN" },
      {
        $set: {
          "permissions.store": { view: true, create: true, edit: true, delete: true }
        }
      }
    );
    
    console.log("Super Admin permissions updated:", result);
    process.exit(0);
  } catch (error) {
    console.error("Error updating permissions:", error);
    process.exit(1);
  }
};

updateSuperAdminPermissions();