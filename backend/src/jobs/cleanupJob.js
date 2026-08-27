const cron = require("node-cron");
const File = require("../models/File");
const s3 = require("../config/s3");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

function startCleanupJob() {
  cron.schedule("0 2 * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const files = await File.find({
        isDeleted: true,
        deletedAt: { $lt: cutoff }
      });

      for (const file of files) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.s3Key
          }));

          await File.deleteOne({ _id: file._id });
          console.log("Cleaned:", file.s3Key);
        } catch (error) {
          console.error("Cleanup failed for", file.s3Key, error.message);
        }
      }
    } catch (error) {
      console.error("Cleanup job failed:", error.message);
    }
  });

  console.log("30-day cleanup job scheduled for 02:00 server time");
}

module.exports = startCleanupJob;