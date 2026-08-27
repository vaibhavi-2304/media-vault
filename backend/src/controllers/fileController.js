const crypto = require("crypto");
const File = require("../models/File");
const Folder = require("../models/Folder");
const User = require("../models/User");
const s3 = require("../config/s3");

const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
}

async function generateUploadUrl(req, res, next) {
  try {
    const { fileName, contentType, fileSize, folderId = null } = req.body;
    const size = Number(fileSize);

    if (!fileName || !contentType || !Number.isSafeInteger(size) || size <= 0) {
      return res.status(400).json({ message: "fileName, contentType and valid fileSize are required" });
    }

    if (size > MAX_FILE_SIZE) {
      return res.status(413).json({ message: "MVP upload limit is 100 MB. Add multipart upload for larger files." });
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(415).json({ message: "File type is not allowed" });
    }

    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        owner: req.userId,
        isDeleted: false
      });

      if (!folder) return res.status(404).json({ message: "Folder not found" });
    }

    const user = await User.findById(req.userId).select("storageUsed storageQuota");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.storageUsed + size > user.storageQuota) {
      return res.status(413).json({
        message: "Storage quota exceeded",
        storageUsed: user.storageUsed,
        storageQuota: user.storageQuota
      });
    }

    const key = `users/${req.userId}/${crypto.randomUUID()}-${safeName(fileName)}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    res.json({
      uploadUrl,
      key,
      expiresIn: 600
    });
  } catch (error) {
    next(error);
  }
}

async function completeUpload(req, res, next) {
  try {
    const { name, key, size, mimeType, folderId = null } = req.body;
    const fileSize = Number(size);

    if (!name || !key || !Number.isSafeInteger(fileSize) || fileSize <= 0 || !mimeType) {
      return res.status(400).json({ message: "name, key, size and mimeType are required" });
    }

    if (!key.startsWith(`users/${req.userId}/`)) {
      return res.status(403).json({ message: "Invalid object key" });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.storageUsed + fileSize > user.storageQuota) {
      return res.status(413).json({ message: "Storage quota exceeded" });
    }

    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        owner: req.userId,
        isDeleted: false
      });
      if (!folder) return res.status(404).json({ message: "Folder not found" });
    }

    const existing = await File.findOne({ s3Key: key });
    if (existing) return res.status(409).json({ message: "File metadata already exists" });

    const file = await File.create({
      name,
      s3Key: key,
      size: fileSize,
      mimeType,
      owner: req.userId,
      folder: folderId || null
    });

    await User.findByIdAndUpdate(req.userId, {
      $inc: { storageUsed: fileSize }
    });

    res.status(201).json({ message: "Upload completed", file });
  } catch (error) {
    next(error);
  }
}

async function listFiles(req, res, next) {
  try {
    const folder = req.query.folder || null;

    const files = await File.find({
      owner: req.userId,
      folder,
      isDeleted: false
    }).sort({ createdAt: -1 });

    res.json({ files });
  } catch (error) {
    next(error);
  }
}

async function downloadFile(req, res, next) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: false
    });

    if (!file) return res.status(404).json({ message: "File not found" });

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key,
      ResponseContentDisposition: `attachment; filename="${file.name.replace(/"/g, "")}"`
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    res.json({ downloadUrl, expiresIn: 600 });
  } catch (error) {
    next(error);
  }
}

async function trashFile(req, res, next) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: false
    });

    if (!file) return res.status(404).json({ message: "File not found" });

    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    await User.findByIdAndUpdate(req.userId, {
      $inc: { storageUsed: -file.size }
    });

    res.json({ message: "File moved to trash" });
  } catch (error) {
    next(error);
  }
}

async function listTrash(req, res, next) {
  try {
    const files = await File.find({
      owner: req.userId,
      isDeleted: true
    }).sort({ deletedAt: -1 });

    res.json({ files });
  } catch (error) {
    next(error);
  }
}

async function restoreFile(req, res, next) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: true
    });

    if (!file) return res.status(404).json({ message: "Trashed file not found" });

    const user = await User.findById(req.userId);
    if (user.storageUsed + file.size > user.storageQuota) {
      return res.status(413).json({ message: "Not enough quota to restore this file" });
    }

    file.isDeleted = false;
    file.deletedAt = null;
    await file.save();

    await User.findByIdAndUpdate(req.userId, {
      $inc: { storageUsed: file.size }
    });

    res.json({ message: "File restored", file });
  } catch (error) {
    next(error);
  }
}

async function permanentlyDeleteFile(req, res, next) {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: true
    });

    if (!file) return res.status(404).json({ message: "Trashed file not found" });

    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: file.s3Key
    }));

    await File.deleteOne({ _id: file._id });

    res.json({ message: "File permanently deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateUploadUrl,
  completeUpload,
  listFiles,
  downloadFile,
  trashFile,
  listTrash,
  restoreFile,
  permanentlyDeleteFile
};