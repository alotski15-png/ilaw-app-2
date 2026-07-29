const { execSync } = require('child_process');
const fs = require('fs');

const files = fs.readdirSync('public').filter(f => f.includes('Annex E-2'));

files.forEach(f => {
  try {
    const result = execSync('node extract-docx-format.js "public/' + f + '"', { 
      encoding: 'utf8', 
      cwd: '.',
      maxBuffer: 10 * 1024 * 1024 
    });
    const match = result.match(/School Year[:\s]+(\d{4}-\d{4})/i);
    console.log(f + ': ' + (match ? match[1] : 'No SY found'));
  } catch (e) {
    console.log(f + ': Error');
  }
});