const libxmljs = require('libxmljs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Read XSD file and find all the paths it expects
function extractXSDPaths(xsdContent) {
  try {
    const xsdDoc = libxmljs.parseXml(xsdContent);
    const paths = [];
    
    const elements = xsdDoc.find('//xs:element', 
      { xs: 'http://www.w3.org/2001/XMLSchema' });
    
    elements.forEach(elem => {
      const name = elem.attr('name')?.value();
      if (name) {
        paths.push({
          path: name,
          name: name,
          minOccurs: elem.attr('minOccurs')?.value() || 'unbounded',
          maxOccurs: elem.attr('maxOccurs')?.value() || '1'
        });
      }
    });

    return paths;
  } catch (error) {
    throw new Error(`Error reading XSD: ${error.message}`);
  }
}

// Read XML file and find all the paths it has
function extractXMLPaths(xmlContent) {
  try {
    const xmlDoc = libxmljs.parseXml(xmlContent);
    const paths = [];
    const lines = xmlContent.split('\n');

    const processNode = (node, currentPath = '') => {
      if (node.type() === 'element') {
        const name = node.name();
        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        
        let lineNum = 1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`<${name}`)) {
            lineNum = i + 1;
            break;
          }
        }

        paths.push({
          path: fullPath,
          name: name,
          lineNumber: lineNum
        });

        node.childNodes().forEach(child => {
          processNode(child, fullPath);
        });
      }
    };

    processNode(xmlDoc.root());
    return paths;
  } catch (error) {
    throw new Error(`Error reading XML: ${error.message}`);
  }
}

// Compare XSD paths with XML paths
function validateXMLAgainstXSD(xmlPath, xsdPath) {
  try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    const xsdContent = fs.readFileSync(xsdPath, 'utf8');

    const xsdDoc = libxmljs.parseXml(xsdContent);
    const xmlDoc = libxmljs.parseXml(xmlContent);

    const errors = [];
    let isValid = true;

    // Get all paths
    const xsdPaths = extractXSDPaths(xsdContent);
    const xmlPaths = extractXMLPaths(xmlContent);

    const xsdPathSet = new Set(xsdPaths.map(p => p.path));
    const xmlPathSet = new Set(xmlPaths.map(p => p.path));

    // Check for missing elements
    xsdPaths.forEach(schemaElem => {
      if (!xmlPathSet.has(schemaElem.path)) {
        errors.push({
          type: 'MISSING_ELEMENT',
          expectedPath: schemaElem.path,
          elementName: schemaElem.name,
          message: `Element not found: ${schemaElem.path}`,
          minOccurs: schemaElem.minOccurs,
          severity: schemaElem.minOccurs === '0' ? 'WARNING' : 'ERROR'
        });
        if (schemaElem.minOccurs !== '0') {
          isValid = false;
        }
      }
    });

    // Check for unexpected elements
    xmlPaths.forEach(xmlElem => {
      if (!xsdPathSet.has(xmlElem.path)) {
        errors.push({
          type: 'UNEXPECTED_ELEMENT',
          foundPath: xmlElem.path,
          elementName: xmlElem.name,
          lineNumber: xmlElem.lineNumber,
          message: `Unexpected element: ${xmlElem.path} at line ${xmlElem.lineNumber}`,
          severity: 'ERROR'
        });
        isValid = false;
      }
    });

    return {
      isValid,
      totalErrors: errors.length,
      errors,
      summary: {
        xsdElementsCount: xsdPaths.length,
        xmlElementsCount: xmlPaths.length,
        matchedElements: xmlPaths.filter(x => xsdPathSet.has(x.path)).length
      }
    };
  } catch (error) {
    return {
      isValid: false,
      totalErrors: 1,
      errors: [{
        type: 'PARSE_ERROR',
        message: error.message,
        severity: 'ERROR'
      }],
      summary: {}
    };
  }
}

// Handle file validation
exports.validateFiles = (req, res) => {
  try {
    if (!req.files || !req.files.xsd || !req.files.xml) {
      return res.status(400).json({
        success: false,
        message: 'Need both XSD and XML files'
      });
    }

    const xsdPath = req.files.xsd[0].path;
    const xmlPath = req.files.xml[0].path;

    const result = validateXMLAgainstXSD(xmlPath, xsdPath);
    
    // Delete files after 1 minute
    setTimeout(() => {
      fs.unlink(xsdPath, () => {});
      fs.unlink(xmlPath, () => {});
    }, 60000);

    res.json({
      success: true,
      validationId: uuidv4(),
      timestamp: new Date(),
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Handle export
exports.exportResults = (req, res) => {
  try {
    const { format, data } = req.body;
    const filename = `validation-report-${Date.now()}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } else if (format === 'csv') {
      let csv = 'Error Type,Element Name,Path,Line Number,Message,Severity\n';
      data.result.errors.forEach(err => {
        const row = [
          err.type,
          err.elementName || 'N/A',
          err.expectedPath || err.foundPath || 'N/A',
          err.lineNumber || 'N/A',
          `"${err.message}"`,
          err.severity
        ].join(',');
        csv += row + '\n';
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else if (format === 'html') {
      const html = generateHTMLReport(data);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.send(html);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

function generateHTMLReport(data) {
  const timestamp = new Date().toLocaleString();
  const status = data.result.isValid ? 'VALID' : 'INVALID';
  const statusColor = data.result.isValid ? '#10b981' : '#ef4444';

  let errorsHTML = '';
  data.result.errors.forEach((err, index) => {
    errorsHTML += `
    <tr>
      <td>${index + 1}</td>
      <td>${err.type}</td>
      <td>${err.elementName || 'N/A'}</td>
      <td>${err.expectedPath || err.foundPath || 'N/A'}</td>
      <td>${err.lineNumber || 'N/A'}</td>
      <td>${err.message}</td>
      <td style="color: ${err.severity === 'ERROR' ? '#ef4444' : '#f59e0b'}">${err.severity}</td>
    </tr>`;
  });

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>XML Validation Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background: #f3f4f6; }
      .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      .summary { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; background: white; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
      th { background: #f3f4f6; font-weight: bold; }
      tr:hover { background: #f9fafb; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>XML Validation Report</h1>
      <p>Status: <strong>${status}</strong> | Generated: ${timestamp}</p>
    </div>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Total Errors:</strong> ${data.result.totalErrors}</p>
      <p><strong>XSD Elements:</strong> ${data.result.summary.xsdElementsCount}</p>
      <p><strong>XML Elements:</strong> ${data.result.summary.xmlElementsCount}</p>
      <p><strong>Matched Elements:</strong> ${data.result.summary.matchedElements}</p>
    </div>

    <h2>Detailed Results</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Error Type</th>
          <th>Element Name</th>
          <th>Path</th>
          <th>Line #</th>
          <th>Message</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${errorsHTML || '<tr><td colspan="7" style="text-align: center;">No errors found</td></tr>'}
      </tbody>
    </table>
  </body>
  </html>`;
}