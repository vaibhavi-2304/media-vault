const User = require("../models/User");

async function checkQuota(req, res, next) {
  try {
    const fileSize = Number(req.body.fileSize);

    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return res.status(400).json({ message: "fileSize must be a positive integer in bytes" });
    }

    const user = await User.findById(req.userId).select("storageUsed storageQuota");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.storageUsed + fileSize > user.storageQuota) {
      return res.status(413).json({
        message: "Storage quota exceeded",
        storageUsed: user.storageUsed,
        storageQuota: user.storageQuota,
        requested: fileSize
      });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = checkQuota;