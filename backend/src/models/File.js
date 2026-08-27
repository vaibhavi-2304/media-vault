const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  s3Key: { type: String, required: true, unique: true },
  size: { type: Number, required: true, min: 1 },
  mimeType: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

fileSchema.index({ owner: 1, isDeleted: 1, folder: 1 });

module.exports = mongoose.model("File", fileSchema);