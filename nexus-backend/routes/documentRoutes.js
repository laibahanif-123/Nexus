const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

const DOCS_DIR = path.join(__dirname, '..', 'uploads', 'documents');
const SIGNATURES_DIR = path.join(__dirname, '..', 'uploads', 'signatures');
fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(SIGNATURES_DIR, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|png|jpg|jpeg/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, PNG, JPG files are allowed'));
  },
});

const sigStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, SIGNATURES_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const sigUpload = multer({
  storage: sigStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /png|jpg|jpeg/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Signature must be a PNG or JPG image'));
  },
});

router.post('/upload', protect, docUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { title, sharedWith } = req.body;

    const document = await Document.create({
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      filePath: `/uploads/documents/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
    });

    res.status(201).json({ success: true, document });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const documents = await Document.find({
      $or: [{ uploadedBy: req.user._id }, { sharedWith: req.user._id }],
    }).populate('uploadedBy', 'name email').sort({ createdAt: -1 });

    res.json({ success: true, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, document });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/sign', protect, sigUpload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No signature image uploaded' });

    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    document.signature = {
      imagePath: `/uploads/signatures/${req.file.filename}`,
      signedBy: req.user._id,
      signedAt: new Date(),
    };
    document.status = 'signed';
    await document.save();

    res.json({ success: true, document });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });
    if (document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    const filePath = path.join(__dirname, '..', document.filePath);
    fs.unlink(filePath, () => {});

    await document.deleteOne();
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;