const Folder = require("../models/Folder");

async function createFolder(req, res, next) {
  try {
    const { name, parentFolder = null } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Folder name is required" });
    }

    if (parentFolder) {
      const parent = await Folder.findOne({
        _id: parentFolder,
        owner: req.userId,
        isDeleted: false
      });

      if (!parent) return res.status(404).json({ message: "Parent folder not found" });
    }

    const folder = await Folder.create({
      name: name.trim(),
      owner: req.userId,
      parentFolder: parentFolder || null
    });

    res.status(201).json({ folder });
  } catch (error) {
    next(error);
  }
}

async function listFolders(req, res, next) {
  try {
    const parentFolder = req.query.parentFolder || null;

    const folders = await Folder.find({
      owner: req.userId,
      parentFolder,
      isDeleted: false
    }).sort({ name: 1 });

    res.json({ folders });
  } catch (error) {
    next(error);
  }
}

async function deleteFolder(req, res, next) {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: false
    });

    if (!folder) return res.status(404).json({ message: "Folder not found" });

    folder.isDeleted = true;
    folder.deletedAt = new Date();
    await folder.save();

    res.json({ message: "Folder moved to trash" });
  } catch (error) {
    next(error);
  }
}

module.exports = { createFolder, listFolders, deleteFolder };