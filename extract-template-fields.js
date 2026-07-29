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
    
    // Extract the three specific fields from first column
    const results = extractFieldsFromFirstColumn(xml);
    
    console.log('\n=== Extracted Fields from First Column ===');
    console.log('File: ' + file);
    console.log('='.repeat(60));
    console.log('Learning Area: ' + results.learningArea);
    console.log('Name of Teachers: ' + results.teacherName);
    console.log('Grade level & Section: ' + results.gradeLevelSection);
    console.log('='.repeat(60));
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function extractFieldsFromFirstColumn(xml) {
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
    
    // Check first column (index 0) for our target fields
    if (cells.length > 0 && cells[0]) {
      const firstCol = cells[0].trim();
      const lowerText = firstCol.toLowerCase();
      
      // Learning Area - must be exactly "Learning Area" or "Learning Area :"
      if ((lowerText === 'learning area' || lowerText === 'learning area :' || 
           lowerText.startsWith('learning area :') || lowerText.startsWith('learning area\n')) 
           && !lowerText.includes('competency')) {
        results.learningArea = firstCol;
      }
      // Name of Teachers - must start with "Name of Teachers"
      else if (lowerText.startsWith('name of teachers')) {
        results.teacherName = firstCol;
      }
      // Grade level & Section - must start with "Grade level"
      else if (lowerText.startsWith('grade level')) {
        results.gradeLevelSection = firstCol;
      }
    }
  }
  
  return results;
}