import mongoose, { Schema, Document, HydratedDocument } from "mongoose";

export enum StoreStatus {
  MANUALLY_ADDED = "MANUALLY_ADDED",
  UPLOADED = "UPLOADED",
  RECCE_ASSIGNED = "RECCE_ASSIGNED",
  RECCE_SUBMITTED = "RECCE_SUBMITTED",
  RECCE_APPROVED = "RECCE_APPROVED",
  RECCE_REJECTED = "RECCE_REJECTED",
  INSTALLATION_ASSIGNED = "INSTALLATION_ASSIGNED",
  INSTALLATION_SUBMITTED = "INSTALLATION_SUBMITTED",
  INSTALLATION_REJECTED = "INSTALLATION_REJECTED",
  COMPLETED = "COMPLETED",
}

export interface StoreDocument extends Document {
  projectID: string;
  storeId: string; // NEW: Auto-generated Store ID
  dealerCode: string;
  storeCode?: string;
  storeName?: string;
  vendorCode?: string; // NEW: Added Vendor Code

  location: {
    zone?: string; // NEW
    state?: string; // NEW
    district?: string; // NEW
    city?: string;
    area?: string;
    address?: string;
    pincode?: string;
    coordinates?: { lat: number; lng: number };
  };

  contact: {
    personName?: string;
    mobile?: string;
  };

  // NEW: Commercial Details (PO & Invoice)
  commercials: {
    poNumber?: string;
    poMonth?: string;
    invoiceNumber?: string;
    invoiceRemarks?: string;
    totalCost?: number;
  };

  // NEW: Detailed Costing Breakdown
  costDetails: {
    boardRate?: number;
    totalBoardCost?: number;
    angleCharges?: number;
    scaffoldingCharges?: number;
    transportation?: number;
    flanges?: number;
    lollipop?: number;
    oneWayVision?: number;
    sunboard?: number;
  };

  specs: {
    boardSize?: string;
    type?: string;
    width?: number; // NEW
    height?: number; // NEW
    qty?: number; // NEW
  };

  remark?: string; // General remark field
  imagesAttached?: boolean; // Images attached in PPT (yes/no)

  currentStatus: StoreStatus;

  workflow: {
    recceAssignedTo?: mongoose.Types.ObjectId;
    recceAssignedBy?: mongoose.Types.ObjectId;
    installationAssignedTo?: mongoose.Types.ObjectId;
    installationAssignedBy?: mongoose.Types.ObjectId;
    priority: "HIGH" | "MEDIUM" | "LOW";
  };

  recce?: {
    assignedDate?: Date;
    submittedDate?: Date;
    sizes?: { width: number; height: number; unit?: string };
    photos?: { front: string; side: string; closeUp: string };
    notes?: string;
  };

  installation?: {
    assignedDate?: Date;
    submittedDate?: Date;
    photos?: {
      after1?: string;
      after2?: string;
    };
  };
}

const StoreSchema = new Schema<StoreDocument>(
  {
    projectID: { type: String },
    storeId: { type: String, unique: true, sparse: true }, // NEW: Auto-generated Store ID
    dealerCode: { type: String, required: true, unique: true, index: true },
    storeCode: { type: String },
    storeName: { type: String },
    vendorCode: { type: String }, // NEW

    location: {
      zone: { type: String }, // NEW
      state: { type: String }, // NEW
      district: { type: String }, // NEW
      city: { type: String },
      area: { type: String },
      address: { type: String },
      pincode: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    contact: {
      personName: { type: String },
      mobile: { type: String },
    },

    // NEW SECTION
    commercials: {
      poNumber: { type: String },
      poMonth: { type: String },
      invoiceNumber: { type: String },
      invoiceRemarks: { type: String },
      totalCost: { type: Number },
    },

    // NEW SECTION
    costDetails: {
      boardRate: { type: Number },
      totalBoardCost: { type: Number },
      angleCharges: { type: Number },
      scaffoldingCharges: { type: Number },
      transportation: { type: Number },
      flanges: { type: Number },
      lollipop: { type: Number },
      oneWayVision: { type: Number },
      sunboard: { type: Number },
    },

    specs: {
      boardSize: { type: String },
      type: { type: String },
      width: { type: Number }, // NEW
      height: { type: Number }, // NEW
      qty: { type: Number }, // NEW
    },

    remark: { type: String },
    imagesAttached: { type: Boolean, default: false },

    currentStatus: {
      type: String,
      enum: Object.values(StoreStatus),
      default: StoreStatus.UPLOADED,
      index: true,
    },

    workflow: {
      recceAssignedTo: { type: Schema.Types.ObjectId, ref: "User" },
      recceAssignedBy: { type: Schema.Types.ObjectId, ref: "User" },
      installationAssignedTo: { type: Schema.Types.ObjectId, ref: "User" },
      installationAssignedBy: { type: Schema.Types.ObjectId, ref: "User" },
      priority: {
        type: String,
        enum: ["HIGH", "MEDIUM", "LOW"],
        default: "MEDIUM",
      },
    },

    recce: {
      assignedDate: Date,
      submittedDate: Date,
      sizes: { width: Number, height: Number, unit: { type: String, default: "ft" } },
      photos: { front: String, side: String, closeUp: String },
      notes: String,
    },

    installation: {
      assignedDate: Date,
      submittedDate: Date,
      photos: {
        after1: String,
        after2: String,
      },
    },
  },
  { timestamps: true },
);

// Helper function to generate Store ID
const generateStoreId = (city: string, district: string, dealerCode: string): string => {
  const cityPrefix = (city || '').trim().substring(0, 3).toUpperCase();
  const districtPrefix = (district || '').trim().substring(0, 3).toUpperCase();
  const cleanDealerCode = (dealerCode || '').trim().toUpperCase();
  return `${cityPrefix}${districtPrefix}${cleanDealerCode}`;
};

// Pre-save hook to auto-generate storeId
StoreSchema.pre('save', function() {
  if (!this.storeId && this.location?.city && this.location?.district && this.dealerCode) {
    this.storeId = generateStoreId(this.location.city, this.location.district, this.dealerCode);
  }
});

export default mongoose.model<StoreDocument>("Store", StoreSchema);
