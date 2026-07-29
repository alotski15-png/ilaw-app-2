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
    
    // Find rows with our target fields and show ALL cells
    console.log('\n=== Detailed Row Analysis ===');
    findTargetRows(xml);
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function findTargetRows(xml) {
  // Find all table rows
  const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  let rowCount = 0;
  
  while ((rowMatch = rowRegex.exec(xml)) !== null && rowCount < 100) {
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
    
    // Check if this row contains any of our target fields
    if (cells.length > 0 && cells[0]) {
      const firstCol = cells[0].toLowerCase();
      
      if (firstCol.includes('learning area') || 
          firstCol.includes('name of teacher') || 
          firstCol.includes('grade level')) {
        
        console.log('\n--- Row ' + (rowCount + 1) + ' ---');
        console.log('First cell: "' + cells[0] + '"');
        console.log('Total cells in row: ' + cells.length);
        
        // Show all cells
        cells.forEach((cell, idx) => {
          if (cell) {
            console.log(`  Cell ${idx + 1}: "${cell.substring(0, 100)}"`);
          }
        });
      }
    }
    
    rowCount++;
  }
}