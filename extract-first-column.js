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
    
    // Parse tables and extract first column content
    const firstColumnData = extractFirstColumnFromTables(xml);
    
    console.log('\n=== ' + file + ' ===');
    console.log('First Column Data:');
    firstColumnData.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item}`);
    });
    
    // Also extract all table rows to see the structure
    console.log('\n\n=== ALL TABLE ROWS (First 2 cells) ===');
    extractAllTableRows(xml);
  } else {
    console.log(file + ': No document.xml found');
  }
  
  // Cleanup
  execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
} catch (e) {
  console.log(file + ': Error - ' + e.message.substring(0, 100));
}

function extractFirstColumnFromTables(xml) {
  const firstColumnItems = [];
  
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
    
    // Get first column (index 0)
    if (cells.length > 0 && cells[0]) {
      const firstColText = cells[0].trim();
      // Only add if it's meaningful (not empty, not just whitespace)
      if (firstColText && firstColText.length > 0) {
        // Check if it's one of the target fields or related content
        if (isRelevantField(firstColText)) {
          firstColumnItems.push(firstColText);
        }
      }
    }
  }
  
  return firstColumnItems;
}

function extractAllTableRows(xml) {
  // Find all table rows
  const rowRegex = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  let rowCount = 0;
  
  while ((rowMatch = rowRegex.exec(xml)) !== null && rowCount < 50) {
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
    
    // Show first 2 cells of each row
    if (cells.length > 0) {
      const preview = cells.slice(0, 2).map(c => c.substring(0, 50)).join(' | ');
      console.log(`Row ${rowCount + 1}: ${preview}`);
      rowCount++;
    }
  }
}

function isRelevantField(text) {
  const lowerText = text.toLowerCase();
  
  // Check if it's one of the main header fields
  const relevantPatterns = [
    'learning area',
    'name of teacher',
    'grade level',
    'grade level and section',
    'no. of sessions',
    'no of sessions',
    'number of sessions',
    'references',
    'declaration of ai',
    'learning competency',
    'learner context',
    'learning objectives',
    'pre-lesson',
    'flow:',
    'learning resources',
    'opportunities for',
    'formative assessment',
    'extended learning',
    'reflections'
  ];
  
  return relevantPatterns.some(pattern => lowerText.includes(pattern));
}