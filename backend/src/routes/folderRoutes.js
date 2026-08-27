const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createFolder,
  listFolders,
  deleteFolder
} = require("../controllers/folderController");

const router = express.Router();

router.use(authMiddleware);
router.post("/", createFolder);
router.get("/", listFolders);
router.delete("/:id", deleteFolder);

module.exports = router;