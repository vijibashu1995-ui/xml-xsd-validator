const express = require('express');
const router = express.Router();
const { app, upload } = require('../server');
const validationController = require('../controllers/validationController');

// Set up file upload for both XSD and XML
const uploadMiddleware = upload.fields([
  { name: 'xsd', maxCount: 1 },
  { name: 'xml', maxCount: 1 }
]);

// When someone posts files, validate them
router.post('/validate', uploadMiddleware, validationController.validateFiles);

// When someone wants to export, export the file
router.post('/export', validationController.exportResults);

module.exports = router;