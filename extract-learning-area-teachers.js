const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Extract from LESSON-PLAN-guide.docx specifically
const file = 'public/LESSON-PLAN-guide.docx';

try {
  // Extract docx (it's just a zip file)
  const extractDir = 'temp-docx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  execSync('mkdir ' + extractDir, { cwd: '.' });
  execSync('tar -xf "' + file + '" -C ' + extractDir, { cwd: '.' });
  
  // Read document.xml
  const xmlPath = path.join(extractDir, 'word', 'document.xml');
  if (fs.existsSync(xmlPath)) {
    const xml = fs.readFileSync(xmlPath, 'utf8');
    
    // Find and display raw XML for target rows
    console.log('\n=== Raw XML for Target Rows ===');
    showRawXmlForRows(xml);
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function showRawXmlForRows(xml) {
  // Find all table rows
  const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  let rowCount = 0;
  
  while ((rowMatch = rowRegex.exec(xml)) !== null && rowCount < 30) {
    const rowContent = rowMatch[1];
    
    // Check if this row contains any of our target fields
    if (rowContent.includes('Learning Area') || 
        rowContent.includes('Name of Teachers') || 
        rowContent.includes('Grade level')) {
      
      console.log('\n--- Row ' + (rowCount + 1) + ' ---');
      console.log('Raw XML (first 500 chars):');
      console.log(rowContent.substring(0, 500));
      console.log('\nExtracted text:');
      
      // Extract all text
      const textMatches = rowContent.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      const fullText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      console.log(fullText);
    }
    
    rowCount++;
  }
}