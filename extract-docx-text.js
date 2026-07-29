const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const files = fs.readdirSync('public').filter(f => f.includes('Annex E-2'));

files.forEach(f => {
  try {
    // Extract docx (it's just a zip file)
    const extractDir = 'temp-docx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    execSync('mkdir ' + extractDir, { cwd: '.' });
    execSync('tar -xf "public/' + f + '" -C ' + extractDir, { cwd: '.' });
    
    // Read document.xml
    const xmlPath = path.join(extractDir, 'word', 'document.xml');
    if (fs.existsSync(xmlPath)) {
      const xml = fs.readFileSync(xmlPath, 'utf8');
      // Extract text content
      const textMatches = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      const fullText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      
      // Look for school year
      const match = fullText.match(/School Year[:\s]+(\d{4}-\d{4})/i);
      console.log(f + ': ' + (match ? match[1] : 'No SY found'));
      
      // Also show first 200 chars to see what's there
      console.log('  Preview: ' + fullText.substring(0, 200));
    } else {
      console.log(f + ': No document.xml found');
    }
    
    // Cleanup
    execSync('rmdir /s /q ' + extractDir, { cwd: '.' });
  } catch (e) {
    console.log(f + ': Error - ' + e.message.substring(0, 50));
  }
});