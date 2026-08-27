const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  generateUploadUrl,
  completeUpload,
  listFiles,
  downloadFile,
  trashFile,
  listTrash,
  restoreFile,
  permanentlyDeleteFile
} = require("../controllers/fileController");

const router = express.Router();

router.use(authMiddleware);

router.post("/upload-url", generateUploadUrl);
router.post("/complete", completeUpload);
router.get("/", listFiles);
router.get("/trash", listTrash);
router.get("/:id/download", downloadFile);
router.patch("/:id/restore", restoreFile);
router.delete("/:id", trashFile);
router.delete("/:id/permanent", permanentlyDeleteFile);

module.exports = router;