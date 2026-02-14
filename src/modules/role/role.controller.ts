import { Request, Response } from "express";
import Role, { RoleDocument } from "./role.model";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

// @desc    Create a new role
// @route   POST /api/v1/roles
// @access  Private (Admin)
export const createRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, code, permissions } = req.body;

    // 1. Check if role code already exists
    const roleExists = await Role.findOne({ code });
    if (roleExists) {
      res.status(400).json({ message: "Role with this code already exists" });
      return;
    }

    // 2. Create Role
    // Note: Mongoose automatically casts the 'permissions' object to a Map
    const role = await Role.create({
      name,
      code,
      permissions,
    });

    res.status(201).json({ message: "Role created successfully", role });
  } catch (error) {
    console.error("Create Role Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get all roles
// @route   GET /api/v1/roles
// @access  Private (Admin)
export const getAllRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const roles = await Role.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Role.countDocuments(query);

    res.status(200).json({
      roles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get single role by ID
// @route   GET /api/v1/roles/:id
// @access  Private (Admin)
export const getRoleById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Update role
// @route   PUT /api/v1/roles/:id
// @access  Private (Admin)
export const updateRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, permissions, isActive } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }

    // Prevent updating the Super Admin code/critical permissions if necessary
    // For now, we allow updates but usually, we protect the 'super_admin' role
    if (
      role.code === "super_admin" &&
      req.body.code &&
      req.body.code !== "super_admin"
    ) {
      res
        .status(400)
        .json({ message: "Cannot change the code of Super Admin" });
      return;
    }

    role.name = name || role.name;
    role.isActive = isActive !== undefined ? isActive : role.isActive;

    // Update permissions if provided
    if (permissions) {
      role.permissions = permissions;
    }

    await role.save();
    res.status(200).json({ message: "Role updated successfully", role });
  } catch (error) {
    console.error("Update Role Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete role
// @route   DELETE /api/v1/roles/:id
// @access  Private (Admin)
export const deleteRole = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: "Role not found" });
      return;
    }

    if (role.code === "super_admin") {
      res.status(400).json({ message: "Cannot delete Super Admin role" });
      return;
    }

    await role.deleteOne();
    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Export roles to Excel
// @route   GET /api/v1/roles/export
// @access  Private (Admin)
export const exportRoles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const roles = await Role.find({});

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Roles");

    // Add title
    worksheet.mergeCells("A1:E2");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Role Management Report";
    titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Add headers starting from row 4
    const headers = ["Role ID", "Name", "Code", "Status", "Created At"];
    const headerRow = worksheet.getRow(4);
    
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAB308" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    
    headerRow.height = 25;

    // Format date helper
    const formatDate = (date: Date) => {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = new Date(date);
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    // Add data rows
    roles.forEach((role: any, index) => {
      const row = worksheet.getRow(5 + index);
      row.values = [
        role._id.toString(),
        role.name,
        role.code,
        role.isActive ? "Active" : "Inactive",
        formatDate(role.createdAt),
      ];
      row.alignment = { vertical: "middle", horizontal: "center" };
      row.height = 20;

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 25 },
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 18 },
    ];

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD1D5DB" } },
            left: { style: "thin", color: { argb: "FFD1D5DB" } },
            bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
            right: { style: "thin", color: { argb: "FFD1D5DB" } },
          };
        });
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=Roles.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export roles" });
  }
};
