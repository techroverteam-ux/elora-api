import { Request, Response } from "express";
import Client from "./client.model";
import ExcelJS from "exceljs";

const generateClientCode = (clientName: string, branchName: string): string => {
  const clientPrefix = clientName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const branchPrefix = branchName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const timestamp = Date.now().toString().slice(-6);
  return `${clientPrefix}${branchPrefix}${timestamp}`;
};

export const getClients = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    if (search) {
      query.$or = [
        { clientName: { $regex: search, $options: "i" } },
        { clientCode: { $regex: search, $options: "i" } },
        { branchName: { $regex: search, $options: "i" } },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Client.countDocuments(query),
    ]);

    res.json({
      clients,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getClientById = async (req: Request, res: Response) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createClient = async (req: Request, res: Response) => {
  try {
    const { clientName, branchName, amount, gstNumber, elements } = req.body;

    const clientCode = generateClientCode(clientName, branchName);

    const client = new Client({
      clientCode,
      clientName,
      branchName,
      amount,
      gstNumber,
      elements: elements || [],
    });

    await client.save();
    res.status(201).json({ message: "Client created successfully", client });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  try {
    const { clientName, branchName, amount, gstNumber, elements } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { clientName, branchName, amount, gstNumber, elements },
      { new: true, runValidators: true },
    );

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json({ message: "Client updated successfully", client });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.json({ message: "Client deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const exportClients = async (req: Request, res: Response) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Clients");

    worksheet.columns = [
      { header: "Client Code", key: "clientCode", width: 20 },
      { header: "Client Name", key: "clientName", width: 25 },
      { header: "Branch Name", key: "branchName", width: 25 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "GST Number", key: "gstNumber", width: 20 },
      { header: "Elements Count", key: "elementsCount", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE4A11B" },
    };

    clients.forEach((client: any) => {
      worksheet.addRow({
        clientCode: client.clientCode,
        clientName: client.clientName,
        branchName: client.branchName,
        amount: client.amount,
        gstNumber: client.gstNumber,
        elementsCount: client.elements.length,
        createdAt: client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "-",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=Clients.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
