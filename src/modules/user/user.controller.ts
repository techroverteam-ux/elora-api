import { Request, Response } from "express";
import User from "./user.model";
import Role from "../role/role.model";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// @desc    Create a new user (Admin only)
// @route   POST /api/v1/users
// @access  Private (Admin with 'users.create' permission)
export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 1. Accept 'roles' array instead of single 'roleId'
    const { name, email, password, roles } = req.body;

    // 2. Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: "User with this email already exists" });
      return;
    }

    // 3. Validate Roles
    // Ensure 'roles' is an array and not empty
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      res.status(400).json({ message: "At least one role is required" });
      return;
    }

    // Check if all provided Role IDs exist in DB
    const foundRoles = await Role.find({ _id: { $in: roles } });
    if (foundRoles.length !== roles.length) {
      res.status(400).json({ message: "One or more Invalid Role IDs" });
      return;
    }

    // 4. Create User
    const user = await User.create({
      name,
      email,
      password,
      roles: roles, // Save array of IDs
    });

    // Populate roles for response
    await user.populate("roles", "name");

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles, // Return array
      },
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get all users with pagination
// @route   GET /api/v1/users
// @access  Private (Admin with 'users.view' permission)
export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();

    // Build search filter
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .populate("roles", "name code")
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      users,
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
// @desc    Get single user by ID
// @route   GET /api/v1/users/:id
// @access  Private
export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("roles", "name code permissions"); // Changed 'role' to 'roles'

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// --- NEW FUNCTION: Get Users by Role Code ---
export const getUsersByRole = async (req: Request, res: Response) => {
  try {
    const { roleCode } = req.params;
    const searchString = String(roleCode).toUpperCase();

    // Find the Role ID first
    const role = await Role.findOne({
      $or: [{ code: searchString }, { name: searchString }],
    });

    if (!role) {
      return res
        .status(404)
        .json({ message: `Role '${searchString}' not found` });
    }

    // Find users where 'roles' array CONTAINS this role._id
    // MongoDB automatically handles searching inside arrays with this syntax
    const users = await User.find({
      roles: role._id,
      isActive: true,
    }).select("name email mobile roles");

    res.status(200).json({ users });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
};

// @desc    Update user details
// @route   PUT /api/v1/users/:id
// @access  Private (Admin with 'users.edit' permission)
export const updateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, roles, isActive, password } = req.body; // 'roles' instead of 'roleId'

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Update basic fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    // Handle Roles Change
    if (roles) {
      if (!Array.isArray(roles) || roles.length === 0) {
        res.status(400).json({ message: "Roles must be a non-empty array" });
        return;
      }

      // Verify all new roles exist
      const foundRoles = await Role.find({ _id: { $in: roles } });
      if (foundRoles.length !== roles.length) {
        res.status(400).json({ message: "One or more Invalid Role IDs" });
        return;
      }

      user.roles = roles as any; // Update array
    }

    // Handle Password Change
    if (password) {
      user.password = password;
    }

    await user.save();

    // Populate for response
    await user.populate("roles", "name");

    res.status(200).json({
      message: "User updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        roles: user.roles,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
// @access  Private (Admin with 'users.delete' permission)
export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Prevent deleting yourself
    // We cast req.user._id to string for comparison
    if (user._id.toString() === (req.user as any)._id.toString()) {
      res.status(400).json({ message: "You cannot delete your own account." });
      return;
    }

    await user.deleteOne();
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Export users to Excel
// @route   GET /api/v1/users/export
// @access  Private (Admin)
export const exportUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const users = await User.find({}).populate("roles", "name");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");

    // Add logo from PNG file
    const logoPngPath = path.join(process.cwd(), "public", "elora-logo-excel.png");
    
    if (fs.existsSync(logoPngPath)) {
      try {
        const logoId = workbook.addImage({
          filename: logoPngPath,
          extension: "png",
        });
        
        worksheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 150, height: 60 },
        });
      } catch (error) {
        console.error("Error adding logo:", error);
      }
    }

    // Add company name
    worksheet.mergeCells("A1:F3");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "User Management Report";
    titleCell.font = { size: 18, bold: true, color: { argb: "FF1F2937" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Add headers starting from row 5
    const headers = ["User ID", "Name", "Email", "Roles", "Status", "Created At"];
    const headerRow = worksheet.getRow(5);
    
    // Apply styling only to header cells with data
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
    users.forEach((user: any, index) => {
      const row = worksheet.getRow(6 + index);
      row.values = [
        user._id.toString(),
        user.name,
        user.email,
        user.roles.map((r: any) => r.name).join(", "),
        user.isActive ? "Active" : "Inactive",
        formatDate(user.createdAt),
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
      { width: 20 },
      { width: 30 },
      { width: 25 },
      { width: 15 },
      { width: 18 },
    ];

    // Add borders to all cells
    worksheet.eachRow((row: any, rowNumber: any) => {
      if (rowNumber >= 5) {
        row.eachCell((cell: any) => {
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
    res.setHeader("Content-Disposition", "attachment; filename=Users.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to export users" });
  }
};


export const downloadUserTemplate = async (req: Request, res: Response) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    const headers = ['Name', 'Email', 'Password', 'Role Codes (comma separated)'];
    const headerRow = sheet.getRow(1);
    for (let i = 0; i < headers.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.value = headers[i];
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAB308' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    sheet.columns = [{ width: 25 }, { width: 30 }, { width: 20 }, { width: 35 }];
    const samples = [
      ['John Doe', 'john@example.com', 'Password123!', 'RECCE'],
      ['Jane Smith', 'jane@example.com', 'SecurePass456!', 'INSTALLATION'],
      ['Admin User', 'admin@example.com', 'Admin789!', 'ADMIN,RECCE'],
      ['Field Staff', 'field@example.com', 'Field123!', 'RECCE,INSTALLATION'],
      ['Manager', 'manager@example.com', 'Manager456!', 'ADMIN']
    ];
    samples.forEach((data, idx) => {
      const row = sheet.getRow(idx + 2);
      row.values = data;
      row.eachCell((cell: any) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });
    const instructionsSheet = workbook.addWorksheet('Instructions');
    const titleCell = instructionsSheet.getCell('A1');
    titleCell.value = 'Instructions for User Template';
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAB308' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const instructions = ['1. Fill all required fields in the Users sheet', '2. Email must be unique for each user', '3. Password must be at least 8 characters', '4. Role Codes: Use SUPER_ADMIN, ADMIN, RECCE, or INSTALLATION', '5. Multiple roles can be separated by commas', '6. Delete sample data before uploading'];
    instructions.forEach((text, i) => {
      const cell = instructionsSheet.getCell('A' + (i + 3));
      cell.value = text;
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    instructionsSheet.getColumn(1).width = 60;
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Elora_User_Upload_Template.xlsx');
    res.send(buffer);
  } catch (error: any) {
    console.error('Template Error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
};

export const uploadUsersBulk = async (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    let totalProcessed = 0;
    let totalSuccess = 0;
    let allErrors: any[] = [];
    const toInsert: any[] = [];
    const existingEmails = new Set((await User.find().select('email')).map((u) => u.email));
    for (const file of files) {
      try {
        const workbook = XLSX.readFile(file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData: any[] = XLSX.utils.sheet_to_json(sheet);
        totalProcessed += rawData.length;
        for (const [index, row] of rawData.entries()) {
          const rowNum = index + 2;
          const email = row['Email'];
          if (!email) {
            allErrors.push({ file: file.originalname, row: rowNum, error: 'Email is missing' });
            continue;
          }
          if (existingEmails.has(email)) {
            allErrors.push({ file: file.originalname, row: rowNum, error: `Duplicate email: ${email}` });
            continue;
          }
          if (toInsert.find((u) => u.email === email)) {
            allErrors.push({ file: file.originalname, row: rowNum, error: `Duplicate in file: ${email}` });
            continue;
          }
          const roleCodesStr = row['Role Codes (comma separated)'] || '';
          const roleCodes = roleCodesStr.split(',').map((c: string) => c.trim().toUpperCase()).filter((c: string) => c);
          if (roleCodes.length === 0) {
            allErrors.push({ file: file.originalname, row: rowNum, error: 'At least one role is required' });
            continue;
          }
          const foundRoles = await Role.find({ code: { $in: roleCodes } });
          if (foundRoles.length !== roleCodes.length) {
            allErrors.push({ file: file.originalname, row: rowNum, error: `Invalid role codes: ${roleCodes.join(', ')}` });
            continue;
          }
          const newUser = {
            name: row['Name'] || 'Unknown',
            email: email,
            password: row['Password'] || 'DefaultPass123!',
            roles: foundRoles.map((r) => r._id),
            isActive: true,
          };
          toInsert.push(newUser);
        }
      } catch (err: any) {
        allErrors.push({ file: file.originalname, error: 'Parsing Error: ' + err.message });
      } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    if (toInsert.length > 0) {
      try {
        await User.insertMany(toInsert, { ordered: false });
        totalSuccess = toInsert.length;
      } catch (err: any) {
        if (err.writeErrors) {
          totalSuccess = toInsert.length - err.writeErrors.length;
          err.writeErrors.forEach((e: any) => {
            allErrors.push({ error: `DB Error: ${e.errmsg}` });
          });
        } else {
          allErrors.push({ error: `Critical Error: ${err.message}` });
        }
      }
    }
    res.status(201).json({
      message: 'Bulk upload processed',
      totalProcessed,
      successCount: totalSuccess,
      errorCount: allErrors.length,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
