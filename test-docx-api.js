const docx = require('docx');

// Test TableCell with margins and borders
try {
  const cell = new docx.TableCell({
    children: [new docx.Paragraph('test')],
    margins: { top: 100, left: 100, bottom: 100, right: 100 },
    borders: {
      top: { val: docx.BorderStyle.SINGLE, size: 8, color: 'D1D5DB' },
      left: { val: docx.BorderStyle.SINGLE, size: 8, color: 'D1D5DB' },
      bottom: { val: docx.BorderStyle.SINGLE, size: 8, color: 'D1D5DB' },
      right: { val: docx.BorderStyle.SINGLE, size: 8, color: 'D1D5DB' },
    },
    shading: { fill: 'F3F4F6', type: docx.ShadingType.CLEAR },
  });
  console.log('TableCell with margins/borders: OK');
} catch (e) {
  console.log('TableCell with margins/borders: ERROR -', e.message);
}

// Test Table with tableCellMar
try {
  const tbl = new docx.Table({
    rows: [new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph('test')] })] })],
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    tableCellMar: { top: 15, left: 15, bottom: 15, right: 15 },
  });
  console.log('Table with tableCellMar: OK');
} catch (e) {
  console.log('Table with tableCellMar: ERROR -', e.message);
}

// Test Table with borders
try {
  const tbl = new docx.Table({
    rows: [new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph('test')] })] })],
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    borders: {
      top: { val: docx.BorderStyle.SINGLE, size: 8, color: '4B5563' },
      left: { val: docx.BorderStyle.SINGLE, size: 8, color: '4B5563' },
      bottom: { val: docx.BorderStyle.SINGLE, size: 8, color: '4B5563' },
      right: { val: docx.BorderStyle.SINGLE, size: 8, color: '4B5563' },
    },
  });
  console.log('Table with borders: OK');
} catch (e) {
  console.log('Table with borders: ERROR -', e.message);
}

// Test TextRun with font and size
try {
  const tr = new docx.TextRun({ text: 'test', font: 'Arial', size: 20, bold: true, color: '1B365D' });
  console.log('TextRun with font/size: OK');
} catch (e) {
  console.log('TextRun with font/size: ERROR -', e.message);
}

// Test Paragraph with alignment
try {
  const p = new docx.Paragraph({ text: 'test', alignment: docx.AlignmentType.CENTER });
  console.log('Paragraph with alignment: OK');
} catch (e) {
  console.log('Paragraph with alignment: ERROR -', e.message);
}

// Test Document with margins
try {
  const doc = new docx.Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 18720, height: 12240 },
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
          orientation: docx.PageOrientation.LANDSCAPE,
        },
      },
      children: [new docx.Paragraph('test')],
    }],
  });
  console.log('Document with margins: OK');
} catch (e) {
  console.log('Document with margins: ERROR -', e.message);
}
