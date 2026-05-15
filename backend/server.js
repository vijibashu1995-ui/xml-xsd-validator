const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Setup file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        if (ext === '.xsd' || ext === '.xml') {
            cb(null, true);
        } else {
            cb(new Error('Only XML and XSD files'));
        }
    }
});

// Validation function
function validateXML(xsdContent, xmlContent) {
    const errors = [];
    
    // Find all tags in XSD
    const xsdTags = [];
    const xsdRegex = /<xs:element name="([^"]+)"/g;
    let match;
    while ((match = xsdRegex.exec(xsdContent)) !== null) {
        xsdTags.push(match[1]);
    }
    
    // Find all tags in XML
    const xmlTags = [];
    const xmlLines = xmlContent.split('\n');
    const xmlRegex = /<(\w+)[ >]/g;
    
    for (let i = 0; i < xmlLines.length; i++) {
        let lineMatch;
        while ((lineMatch = xmlRegex.exec(xmlLines[i])) !== null) {
            const tag = lineMatch[1];
            if (tag !== 'xml' && tag !== '?xml') {
                xmlTags.push({ tag, line: i + 1 });
            }
        }
    }
    
    // Compare
    xmlTags.forEach(xmlTag => {
        if (!xsdTags.includes(xmlTag.tag)) {
            errors.push({
                lineNumber: xmlTag.line,
                elementPath: xmlTag.tag,
                expectedPath: xsdTags[0] || 'unknown',
                actualPath: xmlTag.tag,
                message: `Tag "${xmlTag.tag}" not found in XSD rules!`
            });
        }
    });
    
    xsdTags.forEach(xsdTag => {
        if (!xmlTags.find(x => x.tag === xsdTag)) {
            errors.push({
                lineNumber: 0,
                elementPath: xsdTag,
                expectedPath: xsdTag,
                actualPath: 'missing',
                message: `Expected tag "${xsdTag}" is missing from XML!`
            });
        }
    });
    
    return {
        isValid: errors.length === 0,
        totalErrors: errors.length,
        errors: errors,
        summary: {
            xsdElementsCount: xsdTags.length,
            xmlElementsCount: xmlTags.length,
            matchedElements: xmlTags.filter(x => xsdTags.includes(x.tag)).length
        }
    };
}

// API endpoint
app.post('/api/validate', upload.fields([
    { name: 'xsd', maxCount: 1 },
    { name: 'xml', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.xsd || !req.files.xml) {
            return res.status(400).json({ error: 'Need both XSD and XML files!' });
        }
        
        const xsdFile = req.files.xsd[0];
        const xmlFile = req.files.xml[0];
        
        const xsdContent = fs.readFileSync(xsdFile.path, 'utf8');
        const xmlContent = fs.readFileSync(xmlFile.path, 'utf8');
        
        const result = validateXML(xsdContent, xmlContent);
        
        // Delete files after checking
        fs.unlinkSync(xsdFile.path);
        fs.unlinkSync(xmlFile.path);
        
        res.json({
            success: true,
            result: result,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📁 Upload files to check them!`);
});