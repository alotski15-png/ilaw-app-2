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
    
    // Show all rows in the first table (first 40 rows)
    console.log('\n=== First Table Structure (Rows 1-40) ===');
    showTableStructure(xml, 40);
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function showTableStructure(xml, maxRows) {
  // Find all table rows
  const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  let rowCount = 0;
  
  while ((rowMatch = rowRegex.exec(xml)) !== null && rowCount < maxRows) {
    const rowContent = rowMatch[1];
    
    // Extract all cells in this row
    const cellRegex = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Extract text from cell
      const textMatches = cellMatch[1].match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      const cellText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').trim();
      cells.push(cellText);
    }
    
    // Show all cells
    if (cells.length > 0) {
      console.log(`\nRow ${rowCount + 1} (${cells.length} cells):`);
      cells.forEach((cell, idx) => {
        const preview = cell ? cell.substring(0, 80) : '(empty)';
        console.log(`  [${idx}]: ${preview}`);
      });
    }
    
    rowCount++;
  }
}