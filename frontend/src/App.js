import React, { useState } from 'react';

function App() {
  const [xsdFile, setXsdFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!xsdFile || !xmlFile) {
      setError('Please select both files!');
      return;
    }

    setLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('xsd', xsdFile);
    formData.append('xml', xmlFile);

    try {
      const response = await fetch('http://localhost:5000/api/validate', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError('Failed to connect to server! Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    let report = 'XML VALIDATION REPORT\n';
    report += '='.repeat(50) + '\n\n';
    report += `Date: ${new Date().toLocaleString()}\n`;
    report += `Total Errors: ${result.totalErrors}\n`;
    report += `XSD Elements: ${result.summary.xsdElementsCount}\n`;
    report += `XML Elements: ${result.summary.xmlElementsCount}\n`;
    report += `Matched: ${result.summary.matchedElements}\n\n`;
    
    if (result.errors.length > 0) {
      report += 'ERROR DETAILS:\n';
      report += '-'.repeat(50) + '\n';
      result.errors.forEach((err, idx) => {
        report += `\n${idx + 1}. Line ${err.lineNumber || '?'}: ${err.message}\n`;
        report += `   Path: ${err.elementPath}\n`;
      });
    }
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: 'white', fontSize: '48px', marginBottom: '10px' }}>
            📄 XML & XSD Checker
          </h1>
          <p style={{ color: 'white', fontSize: '18px' }}>
            Upload your files and see if they match!
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          
          {/* File Upload Boxes */}
          <div style={{ marginBottom: '30px' }}>
            {/* XSD Upload */}
            <div style={{
              border: '2px dashed #ddd',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <h3>📋 XSD File (The Rules)</h3>
              <input
                type="file"
                accept=".xsd"
                onChange={(e) => setXsdFile(e.target.files[0])}
                style={{ marginTop: '10px' }}
              />
              {xsdFile && (
                <div style={{ marginTop: '10px', color: 'green' }}>
                  ✅ {xsdFile.name}
                </div>
              )}
            </div>

            {/* XML Upload */}
            <div style={{
              border: '2px dashed #ddd',
              borderRadius: '10px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <h3>📄 XML File (Your Data)</h3>
              <input
                type="file"
                accept=".xml"
                onChange={(e) => setXmlFile(e.target.files[0])}
                style={{ marginTop: '10px' }}
              />
              {xmlFile && (
                <div style={{ marginTop: '10px', color: 'green' }}>
                  ✅ {xmlFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Validate Button */}
          <button
            onClick={handleValidate}
            disabled={loading || !xsdFile || !xmlFile}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '20px'
            }}
          >
            {loading ? '🔍 Checking...' : '✅ Check My Files'}
          </button>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '15px',
              background: '#ffebee',
              color: '#c62828',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              ❌ {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              {/* Status Card */}
              <div style={{
                padding: '20px',
                borderRadius: '10px',
                background: result.isValid ? '#e8f5e9' : '#ffebee',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '48px' }}>
                    {result.isValid ? '✅' : '❌'}
                  </div>
                  <div>
                    <h2 style={{ margin: 0 }}>
                      {result.isValid ? 'VALIDATION PASSED!' : 'VALIDATION FAILED!'}
                    </h2>
                    <p>Found {result.totalErrors} issue(s)</p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '10px',
                marginBottom: '20px'
              }}>
                <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.summary.xsdElementsCount}</div>
                  <div>Rules in XSD</div>
                </div>
                <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{result.summary.xmlElementsCount}</div>
                  <div>Items in XML</div>
                </div>
                <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>{result.summary.matchedElements}</div>
                  <div>Matched Correctly</div>
                </div>
              </div>

              {/* Download Button */}
              {!result.isValid && (
                <button
                  onClick={downloadReport}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  📥 Download Error Report
                </button>
              )}

              {/* Error List */}
              {!result.isValid && result.errors.length > 0 && (
                <div>
                  <h3>Problems Found:</h3>
                  {result.errors.map((error, idx) => (
                    <div key={idx} style={{
                      padding: '15px',
                      marginBottom: '10px',
                      background: '#fff3e0',
                      borderLeft: '4px solid #ff9800',
                      borderRadius: '5px'
                    }}>
                      <div><strong>Line {error.lineNumber || '?'}:</strong></div>
                      <div style={{ fontFamily: 'monospace', marginTop: '5px' }}>
                        {error.message}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                        Path: {error.elementPath}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{
          background: 'white',
          borderRadius: '10px',
          padding: '20px',
          marginTop: '20px'
        }}>
          <h3>📖 How to use:</h3>
          <ol>
            <li>Upload an <strong>.xsd</strong> file (this has the rules)</li>
            <li>Upload an <strong>.xml</strong> file (this is what we check)</li>
            <li>Click "Check My Files"</li>
            <li>See if everything matches!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default App;