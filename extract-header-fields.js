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
    
    // Extract the three specific fields
    const results = extractHeaderFields(xml);
    
    console.log('\n=== Extracted Header Fields ===');
    console.log('File: ' + file);
    console.log('-'.repeat(60));
    console.log('Learning Area: ' + (results.learningArea || 'Not found'));
    console.log('Name of Teachers: ' + (results.teacherName || 'Not found'));
    console.log('Grade level & Section: ' + (results.gradeLevelSection || 'Not found'));
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function extractHeaderFields(xml) {
  const results = {
    learningArea: null,
    teacherName: null,
    gradeLevelSection: null
  };
  
  // Find all table rows
  const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(xml)) !== null) {
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
    
    // Check if first cell contains one of our target fields
    if (cells.length >= 2 && cells[0]) {
      const firstCol = cells[0].toLowerCase();
      const secondCol = cells[1].trim();
      
      // Learning Area
      if (firstCol.includes('learning area') && !firstCol.includes('competency')) {
        results.learningArea = secondCol;
      }
      // Name of Teachers
      else if (firstCol.includes('name of teacher')) {
        results.teacherName = secondCol;
      }
      // Grade level & Section
      else if (firstCol.includes('grade level')) {
        results.gradeLevelSection = secondCol;
      }
    }
  }
  
  return results;
}