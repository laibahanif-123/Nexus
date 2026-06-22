const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'signed', 'rejected'], default: 'pending' },
    signature: {
      imagePath: { type: String, default: null },
      signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      signedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);