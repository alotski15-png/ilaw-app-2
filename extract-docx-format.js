const fs = require('fs');
const PizZip = require('pizzip');
const docxPath = 'e:/OneDrive/OneDrive - Department of Education/2026-2027/LP/Term 1/Math 10/ILAW clumnar blank.docx';

try {
  const data = fs.readFileSync(docxPath, 'binary');
  const zip = new PizZip(data);
  const docXml = zip.files['word/document.xml'].asText();

  // Find all tables and their properties
  const tableMatches = docXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g);
  if (tableMatches) {
    console.log('Number of tables:', tableMatches.length);
    tableMatches.forEach((tbl, i) => {
      console.log(`\n=== Table ${i + 1} ===`);
      // Extract table properties
      const tblPrMatch = tbl.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/);
      if (tblPrMatch) {
        console.log('Table Properties:', tblPrMatch[0]);
      }
      // Extract table grid
      const tblGridMatch = tbl.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/);
      if (tblGridMatch) {
        console.log('Table Grid:', tblGridMatch[0]);
      }
      // Count rows and columns
      const rowMatches = tbl.match(/<w:tr/g);
      const cellMatches = tbl.match(/<w:tc/g);
      console.log('Rows:', rowMatches ? rowMatches.length : 0);
      console.log('Cells:', cellMatches ? cellMatches.length : 0);

      // Extract cell properties (first few cells)
      const tcMatches = tbl.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
      if (tcMatches) {
        tcMatches.slice(0, 3).forEach((tc, j) => {
          const tcPrMatch = tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
          if (tcPrMatch) {
            console.log(`  Cell ${j + 1} Properties:`, tcPrMatch[0].substring(0, 500));
          }
        });
      }
    });
  }

  // Extract all unique cell fills
  const fillMatches = docXml.match(/w:fill="([A-F0-9]+)"/g);
  if (fillMatches) {
    const uniqueFills = [...new Set(fillMatches)];
    console.log('\n=== Unique Cell Fills ===');
    uniqueFills.forEach(f => console.log('  ' + f));
  }

  // Extract all unique border colors
  const borderColorMatches = docXml.match(/w:color="([A-F0-9]+)"/g);
  if (borderColorMatches) {
    const uniqueColors = [...new Set(borderColorMatches)];
    console.log('\n=== Unique Border/Text Colors ===');
    uniqueColors.forEach(c => console.log('  ' + c));
  }

  // Extract all unique font sizes
  const szMatches = docXml.match(/w:sz w:val="(\d+)"/g);
  if (szMatches) {
    const uniqueSizes = [...new Set(szMatches)];
    console.log('\n=== Unique Font Sizes ===');
    uniqueSizes.forEach(s => console.log('  ' + s));
  }

  // Extract all unique fonts
  const fontMatches = docXml.match(/w:ascii="([^"]+)"/g);
  if (fontMatches) {
    const uniqueFonts = [...new Set(fontMatches)];
    console.log('\n=== Unique Fonts ===');
    uniqueFonts.forEach(f => console.log('  ' + f));
  }

  // Extract all unique alignments
  const jcMatches = docXml.match(/<w:jc w:val="([^"]+)"/g);
  if (jcMatches) {
    const uniqueJc = [...new Set(jcMatches)];
    console.log('\n=== Unique Alignments ===');
    uniqueJc.forEach(j => console.log('  ' + j));
  }

  // Extract all unique border styles
  const borderMatches = docXml.match(/<w:(top|left|bottom|right) w:val="([^"]+)" w:sz="(\d+)" w:space="(\d+)" w:color="([^"]+)"/g);
  if (borderMatches) {
    const uniqueBorders = [...new Set(borderMatches)];
    console.log('\n=== Unique Border Styles ===');
    uniqueBorders.forEach(b => console.log('  ' + b));
  }

  // Extract all unique cell margins
  const tcMarMatches = docXml.match(/<w:tcMar>[\s\S]*?<\/w:tcMar>/g);
  if (tcMarMatches) {
    const uniqueTcMar = [...new Set(tcMarMatches)];
    console.log('\n=== Unique Cell Margins (tcMar) ===');
    uniqueTcMar.forEach(m => console.log('  ' + m));
  }

  // Extract all unique table cell margins
  const tblCellMarMatches = docXml.match(/<w:tblCellMar>[\s\S]*?<\/w:tblCellMar>/g);
  if (tblCellMarMatches) {
    const uniqueTblCellMar = [...new Set(tblCellMarMatches)];
    console.log('\n=== Unique Table Cell Margins (tblCellMar) ===');
    uniqueTblCellMar.forEach(m => console.log('  ' + m));
  }

} catch(e) {
  console.error('Error:', e.message);
}
