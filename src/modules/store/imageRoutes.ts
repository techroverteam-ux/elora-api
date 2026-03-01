import express from "express";
import { upload, validateUploadFields } from "../../middleware/uploadMiddleware";

// Add these routes to your existing store.route.ts

// Upload store images (initial, recce, installation)
router.post("/:id/upload-images", 
  upload.array('files', 10),
  validateUploadFields,
  async (req: Request | any, res: Response) => {
    try {
      const { id } = req.params;
      const { folderType } = req.body; // 'initial', 'recce', 'installation'
      const filesArray = req.files as Express.Multer.File[];

      if (!filesArray || filesArray.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const store = await Store.findById(id);
      if (!store) return res.status(404).json({ message: "Store not found" });

      const clientCode = store.clientCode || "DEFAULT";
      const uploadedFiles = [];

      for (const file of filesArray) {
        try {
          const fileUrl = await enhancedUploadService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            clientCode,
            store.storeId,
            folderType,
            req.user?.name || "Unknown"
          );

          uploadedFiles.push({
            fileName: path.basename(fileUrl),
            url: fileUrl,
            displayUrl: imagePathResolver.getDisplayUrl(fileUrl)
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
  }
);

// Delete store image
router.delete("/:id/images/:fileName", 
  async (req: Request, res: Response) => {
    try {
      const { id, fileName } = req.params;
      const { folderType } = req.body;

      const store = await Store.findById(id);
      if (!store) return res.status(404).json({ message: "Store not found" });

      const clientCode = store.clientCode || "DEFAULT";
      await enhancedUploadService.deleteFile(clientCode, store.storeId, folderType, fileName);

      res.status(200).json({ message: "File deleted successfully" });

    } catch (error: any) {
      console.error("Delete Error:", error);
      res.status(500).json({ message: "Failed to delete file", error: error.message });
    }
  }
);

// Get store images for UI display
router.get("/:id/images/:folderType", 
  async (req: Request, res: Response) => {
    try {
      const { id, folderType } = req.params;
      const store = await Store.findById(id);
      
      if (!store) return res.status(404).json({ message: "Store not found" });

      let images: string[] = [];
      
      if (folderType === 'initial' && store.recce?.initialPhotos) {
        images = store.recce.initialPhotos;
      } else if (folderType === 'recce' && store.recce?.reccePhotos) {
        images = store.recce.reccePhotos.map((p: any) => p.photo);
      } else if (folderType === 'installation' && store.installation?.photos) {
        images = store.installation.photos.map((p: any) => p.installationPhoto);
      }

      const displayImages = images.map(img => ({
        path: img,
        displayUrl: imagePathResolver.getDisplayUrl(img)
      }));

      res.status(200).json({
        success: true,
        images: displayImages,
        count: displayImages.length
      });

    } catch (error: any) {
      console.error("Get Images Error:", error);
      res.status(500).json({ message: "Failed to get images", error: error.message });
    }
  }
);