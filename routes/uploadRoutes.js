const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post('/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = req.files.file || Object.values(req.files)[0];
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file found in request' });
    }

    const ext = path.extname(uploadedFile.name).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ error: 'Only PDF, DOC, DOCX, and Image files are allowed.' });
    }

    const sanitizedBase = path.basename(uploadedFile.name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFilename = `${sanitizedBase}_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const destinationPath = path.join(uploadDir, uniqueFilename);

    await uploadedFile.mv(destinationPath);

    res.json({
      success: true,
      fileUrl: `/uploads/${uniqueFilename}`,
      fileName: uploadedFile.name,
      size: uploadedFile.size,
    });
  } catch (err) {
    console.error('File upload error with express-fileupload:', err);
    res.status(500).json({ error: err.message || 'Server error uploading file' });
  }
});

module.exports = router;
