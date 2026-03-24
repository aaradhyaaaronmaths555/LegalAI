/**
 * Generates dummy contract files for testing Legal AI upload flow.
 * Uses only Node.js built-in modules (no external deps).
 * Run: node scripts/generate-test-files.js
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "test-fixtures");
const NDA_TEXT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of the Effective Date.

PARTIES
Disclosing Party: Acme Corporation
Receiving Party: Beta Inc.

EFFECTIVE DATE
The effective date of this Agreement shall be the date of last signature below.

CONFIDENTIALITY
The Receiving Party agrees to hold all Confidential Information in strict confidence and not to disclose such information to any third parties without prior written consent of the Disclosing Party.

LIABILITY
Neither party shall be liable for any indirect, incidental, or consequential damages arising out of or relating to this Agreement.

TERMINATION
This Agreement shall remain in effect for a period of three (3) years from the Effective Date. Either party may terminate with 30 days written notice.

GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware.`;

const MSA_TEXT = `MASTER SERVICES AGREEMENT

This Master Services Agreement ("MSA") is entered into between the Client and the Service Provider.

PARTIES
Client: Acme Corporation
Service Provider: Beta Services LLC

EFFECTIVE DATE
Effective as of the date of execution by both parties.

SCOPE OF SERVICES
The Service Provider shall perform services as described in individual Statement of Work documents executed under this MSA.

LIABILITY
Liability shall be limited to the total fees paid under the applicable SOW in the twelve months preceding the claim.

TERMINATION
Either party may terminate this MSA with sixty (60) days written notice. Termination for cause requires 14 days cure period.

PAYMENT TERMS
Net 30 days from invoice date.`;

const EMPLOYMENT_TEXT = `EMPLOYMENT AGREEMENT

This Employment Agreement is entered into between the Employer and the Employee.

PARTIES
Employer: Acme Corporation
Employee: Jane Smith

EFFECTIVE DATE
Commencing on the Start Date as defined in Exhibit A.

POSITION AND DUTIES
The Employee shall serve in the capacity of Legal Counsel and perform such duties as assigned by the Employer.

CONFIDENTIALITY
The Employee agrees to maintain confidentiality of all proprietary information during and after employment.

TERMINATION
Employment may be terminated at will by either party with two (2) weeks notice, or immediately for cause.

LIABILITY
The Employer shall indemnify the Employee for acts performed within the scope of employment.`;

// Additional contract templates for 10 more test documents
const TEST_DOCS = [
  {
    name: "dummy-nda-2.pdf",
    type: "pdf",
    content: `NON-DISCLOSURE AGREEMENT

Between TechStart Inc. and Venture Partners LLC.

PARTIES
Disclosing Party: TechStart Inc.
Receiving Party: Venture Partners LLC

EFFECTIVE DATE
January 15, 2025

CONFIDENTIALITY
All proprietary information shall be kept confidential for five (5) years.

LIABILITY
Liability limited to direct damages only.`,
  },
  {
    name: "dummy-nda-3.pdf",
    type: "pdf",
    content: `NDA - Mutual Non-Disclosure

Between Global Pharma Ltd. and BioResearch Corp.

EFFECTIVE DATE
Upon execution by both parties.

TERMINATION
Either party may terminate with 60 days notice.

CONFIDENTIALITY
Mutual obligations to protect trade secrets.`,
  },
  {
    name: "dummy-msa-2.docx",
    type: "docx",
    content: `MASTER SERVICES AGREEMENT

Client: Delta Manufacturing Inc.
Provider: CloudTech Solutions

EFFECTIVE DATE
March 1, 2025

SCOPE
IT consulting and cloud migration services.

LIABILITY
Capped at annual contract value.

TERMINATION
90 days written notice required.`,
  },
  {
    name: "dummy-msa-3.docx",
    type: "docx",
    content: `MSA - Professional Services

Parties: Legal Firm XYZ and Outsourcing Co.

SCOPE OF WORK
Legal research and document review services.

PAYMENT
Net 45 days. Late fee 1.5% per month.

TERMINATION
For cause: 14 days cure. Otherwise 60 days notice.`,
  },
  {
    name: "dummy-employment-1.pdf",
    type: "pdf",
    content: `EMPLOYMENT AGREEMENT

Employer: Morgan & Associates
Employee: John Davis

EFFECTIVE DATE
April 1, 2025

POSITION
Senior Associate

CONFIDENTIALITY
Survives termination. Two-year non-compete.

TERMINATION
Four weeks notice required.`,
  },
  {
    name: "dummy-employment-2.pdf",
    type: "pdf",
    content: `EMPLOYMENT CONTRACT

Employer: Swift Logistics
Employee: Sarah Chen

START DATE
As per offer letter.

DUTIES
Operations Manager.

LIABILITY
Standard indemnification for scope of employment.`,
  },
  {
    name: "dummy-nda-4.docx",
    type: "docx",
    content: `Confidentiality Agreement

Between HealthData Systems and Medical Partners.

Effective: Upon signing.

Duration: Three years from disclosure.

Governing Law: New York.`,
  },
  {
    name: "dummy-msa-4.pdf",
    type: "pdf",
    content: `Services Agreement

Client: Retail Co. | Provider: Marketing Agency

Statement of Work governs individual projects.

Liability: Limited to fees paid.

Term: Annual with auto-renewal.`,
  },
  {
    name: "dummy-employment-3.docx",
    type: "docx",
    content: `Employment Agreement

Employer: Green Energy Corp
Employee: Michael Wong

Role: Sustainability Consultant

Notice: Three weeks for termination.`,
  },
  {
    name: "dummy-mixed.pdf",
    type: "pdf",
    content: `Consulting Agreement with NDA Provisions

Parties: Advisory Firm and Client Corp.

Effective Date: As of signing.

Confidentiality: Incorporated by reference.

Liability: Standard consulting terms.`,
  },
];

function createMinimalPdf(content, title) {
  const text = content.replace(/\n/g, " ").substring(0, 500);
  const lines = content.split("\n").slice(0, 30);

  let body = "";
  let objCount = 4;
  const offsets = [];

  const catalog = `1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
`;
  body += catalog;
  offsets.push(body.length - 6);

  const pages = `2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
`;
  body += pages;

  const pageRef = `3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
`;
  body += pageRef;

  const streamContent = lines
    .map((l, i) => `(${l.replace(/[()\\]/g, "\\$&")}) Tj T*`)
    .join("\n");
  const contentStream = `4 0 obj
<< /Length ${streamContent.length + 50} >>
stream
BT
/F1 12 Tf
72 720 Td
14 TL
${streamContent}
ET
endstream
endobj
`;
  body += contentStream;

  const font = `5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`;
  body += font;

  const head = "%PDF-1.4\n";
  const xrefOffset = head.length + body.length;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  let off = head.length;
  const parts = body.split(/endobj\n/);
  for (let i = 0; i < 5; i++) {
    const chunk = (parts.slice(0, i + 1).join("endobj\n") + "endobj\n").length;
    off = head.length + chunk - 6;
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer
<< /Size 6 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return Buffer.from(head + body + xref + trailer, "utf8");
}

function createLargePdf(basePdf, targetSizeBytes) {
  const paddingNeeded = targetSizeBytes - basePdf.length - 10;
  if (paddingNeeded <= 0) return basePdf;
  const line = "%" + "x".repeat(99) + "\n";
  const numLines = Math.ceil(paddingNeeded / line.length);
  const padding = Buffer.from(line.repeat(numLines), "utf8");
  return Buffer.concat([basePdf.slice(0, -5), padding.slice(0, paddingNeeded), Buffer.from("%%EOF", "utf8")]);
}

function createDocx(content) {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${content
  .split("\n")
  .map(
    (line) =>
      `<w:p><w:r><w:t>${line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`
  )
  .join("")}
</w:body>
</w:document>`;

  const [Content_Types] = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/word/document.xml" Id="rId1"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" Id="rId1"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>`;

  const zipParts = [
    { path: "[Content_Types].xml", data: [Content_Types] },
    { path: "_rels/.rels", data: rels },
    { path: "word/_rels/document.xml.rels", data: docRels },
    { path: "word/document.xml", data: docXml },
    { path: "word/styles.xml", data: styles },
  ];

  const CR = 0x0d;
  const LF = 0x0a;
  const localFileHeader = (name, compressedSize) => {
    const nameBuf = Buffer.from(name, "utf8");
    const len = 30 + nameBuf.length;
    const buf = Buffer.alloc(len);
    buf.writeUInt32LE(0x04034b50, 0);
    buf.writeUInt16LE(20, 4);
    buf.writeUInt16LE(0, 6);
    buf.writeUInt16LE(0, 8);
    buf.writeUInt16LE(0, 10);
    buf.writeUInt32LE(0, 12);
    buf.writeUInt32LE(0, 16);
    buf.writeUInt32LE(compressedSize, 20);
    buf.writeUInt32LE(compressedSize, 24);
    buf.writeUInt16LE(nameBuf.length, 28);
    nameBuf.copy(buf, 30);
    return buf;
  };

  const centralDirEntry = (name, offset, compressedSize) => {
    const nameBuf = Buffer.from(name, "utf8");
    const len = 46 + nameBuf.length;
    const buf = Buffer.alloc(len);
    buf.writeUInt32LE(0x02014b50, 0);
    buf.writeUInt16LE(20, 4);
    buf.writeUInt16LE(20, 6);
    buf.writeUInt16LE(0, 8);
    buf.writeUInt16LE(0, 10);
    buf.writeUInt16LE(0, 12);
    buf.writeUInt32LE(0, 14);
    buf.writeUInt32LE(compressedSize, 18);
    buf.writeUInt32LE(compressedSize, 22);
    buf.writeUInt32LE(offset, 42);
    buf.writeUInt16LE(nameBuf.length, 44);
    nameBuf.copy(buf, 46);
    return buf;
  };

  const deflateSync = require("zlib").deflateSync;
  const chunks = [];
  let offset = 0;
  const centralEntries = [];

  for (const part of zipParts) {
    const data = Buffer.from(part.data, "utf8");
    const compressed = deflateSync(data, { level: 9 });
    const header = localFileHeader(part.path, compressed.length);
    chunks.push(header, compressed);
    centralEntries.push({ path: part.path, offset, size: compressed.length });
    offset += header.length + compressed.length;
  }

  const centralStart = offset;
  const centralChunks = centralEntries.map((e) =>
    centralDirEntry(e.path, e.offset, e.size)
  );
  const centralLen = centralChunks.reduce((s, c) => s + c.length, 0);
  chunks.push(...centralChunks);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(zipParts.length, 8);
  eocd.writeUInt16LE(zipParts.length, 10);
  eocd.writeUInt32LE(centralLen, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);
  chunks.push(eocd);

  return Buffer.concat(chunks);
}

// Main
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log("Generating test fixtures in", OUTPUT_DIR);

const pdfNda = createMinimalPdf(NDA_TEXT, "NDA");
fs.writeFileSync(path.join(OUTPUT_DIR, "dummy-nda.pdf"), pdfNda);
console.log("  Created dummy-nda.pdf (" + (pdfNda.length / 1024).toFixed(1) + " KB)");

const docxMsa = createDocx(MSA_TEXT);
fs.writeFileSync(path.join(OUTPUT_DIR, "dummy-msa.docx"), docxMsa);
console.log("  Created dummy-msa.docx (" + (docxMsa.length / 1024).toFixed(1) + " KB)");

const pdfLarge = createMinimalPdf(
  EMPLOYMENT_TEXT + "\n\n" + "Additional paragraph for padding. ".repeat(200),
  "Large"
);
const targetSize = 11 * 1024 * 1024;
const largePdf = createLargePdf(pdfNda, targetSize);
if (largePdf.length < targetSize) {
  const padding = Buffer.alloc(targetSize - largePdf.length, "x");
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "dummy-large.pdf"),
    Buffer.concat([largePdf, padding])
  );
} else {
  fs.writeFileSync(path.join(OUTPUT_DIR, "dummy-large.pdf"), largePdf);
}
const largePath = path.join(OUTPUT_DIR, "dummy-large.pdf");
const largeSize = fs.statSync(largePath).size;
console.log(
  "  Created dummy-large.pdf (" + (largeSize / 1024 / 1024).toFixed(1) + " MB)"
);

// Generate 10 additional test documents (all under 10MB)
for (const doc of TEST_DOCS) {
  const outPath = path.join(OUTPUT_DIR, doc.name);
  let buf;
  if (doc.type === "pdf") {
    buf = createMinimalPdf(doc.content, doc.name);
  } else {
    buf = createDocx(doc.content);
  }
  fs.writeFileSync(outPath, buf);
  const sizeKb = (buf.length / 1024).toFixed(1);
  console.log("  Created " + doc.name + " (" + sizeKb + " KB)");
}

console.log("\nDone. Test files:");
console.log("  - dummy-nda.pdf, dummy-msa.docx: Original fixtures");
console.log("  - dummy-large.pdf: Over 10MB (size validation)");
console.log("  - 10 additional documents: dummy-nda-2.pdf through dummy-mixed.pdf");
