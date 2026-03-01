// Enhanced Store Controller Methods for Image Management

// Add these methods to your existing store.controller.ts

export const uploadStoreImages = async (req: Request | any, res: Response) => {
  try {
    const { id } = req.params;
    const { folderType } = req.body; // 'initial', 'recce', 'installation'
    const filesArray = req.files as Express.Multer.File[];

    if (!filesArray || filesArray.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    // Generate storeId if missing
    if (!store.storeId) {
      if (store.location?.city && store.location?.district && store.dealerCode) {
        const cityPrefix = store.location.city.trim().substring(0, 3).toUpperCase();
        const districtPrefix = store.location.district.trim().substring(0, 3).toUpperCase();
        const storeId = `${cityPrefix}${districtPrefix}${store.dealerCode.toUpperCase()}`;
        store.storeId = storeId;
        await store.save();
      } else {
        return res.status(400).json({
          message: "Cannot generate Store ID. Missing city or district information.",
        });
      }
    }

    const userName = req.user?.name || "Unknown";
    const clientCode = store.clientCode || "DEFAULT";
    const uploadedFiles = [];

    // Use enhanced upload service
    const enhancedUploadService = require('../utils/enhancedUploadService').default;

    for (const file of filesArray) {
      try {
        const fileUrl = await enhancedUploadService.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          clientCode,
          store.storeId,
          folderType,
          userName
        );

        uploadedFiles.push({
          fileName: path.basename(fileUrl),
          url: fileUrl,
          fileId: path.basename(fileUrl).split('_')[1] // Extract unique hash
        });
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
      }
    }

    res.status(200).json({
      message: `Successfully uploaded ${uploadedFiles.length} files`,
      files: uploadedFiles,
      storeId: store.storeId
    });

  } catch (error: any) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Failed to upload files", error: error.message });
  }
};

export const deleteStoreImage = async (req: Request, res: Response) => {
  try {
    const { id, fileName } = req.params;
    const { folderType } = req.body;

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const clientCode = store.clientCode || "DEFAULT";
    const enhancedUploadService = require('../utils/enhancedUploadService').default;

    await enhancedUploadService.deleteFile(
      clientCode,
      store.storeId,
      folderType,
      fileName
    );

    res.status(200).json({
      message: "File deleted successfully"
    });

  } catch (error: any) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Failed to delete file", error: error.message });
  }
};

export const getStoreImageUrl = async (req: Request, res: Response) => {
  try {
    const { id, fileName } = req.params;
    const { folderType } = req.query;

    const store = await Store.findById(id);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const clientCode = store.clientCode || "DEFAULT";
    const enhancedUploadService = require('../utils/enhancedUploadService').default;

    const fileUrl = enhancedUploadService.getFileUrl(
      clientCode,
      store.storeId,
      folderType as string,
      fileName
    );

    res.status(200).json({
      success: true,
      url: fileUrl
    });

  } catch (error: any) {
    console.error("Get URL Error:", error);
    res.status(500).json({ message: "Failed to get file URL", error: error.message });
  }
};