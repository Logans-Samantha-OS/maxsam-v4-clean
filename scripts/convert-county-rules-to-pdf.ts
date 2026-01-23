/**
 * Convert County Rules Markdown to PDF
 * Uses @pdfme/generator to create professional PDF documents
 *
 * Run with: npx tsx scripts/convert-county-rules-to-pdf.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { generate } from '@pdfme/generator';
import { text, line, rectangle } from '@pdfme/schemas';

const COUNTY_RULES_DIR = path.join(process.cwd(), 'docs', 'county-rules');

interface PDFContent {
  title: string;
  subtitle: string;
  content: string[];
}

function parseMarkdown(content: string): PDFContent {
  const lines = content.split('\n');
  let title = '';
  let subtitle = '';
  const contentLines: string[] = [];

  let foundTitle = false;
  let foundSubtitle = false;

  for (const line of lines) {
    if (line.startsWith('# ') && !foundTitle) {
      title = line.replace('# ', '').trim();
      foundTitle = true;
    } else if (line.startsWith('*Generated:') && !foundSubtitle) {
      subtitle = line.replace(/\*/g, '').trim();
      foundSubtitle = true;
    } else if (line.trim() && !line.startsWith('---')) {
      // Clean up markdown formatting for plain text
      let cleanLine = line
        .replace(/^#{1,6}\s+/, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/^[-*]\s+/, '• ') // Convert bullets
        .replace(/^\d+\.\s+/, (match) => match) // Keep numbered lists
        .replace(/\|/g, ' | '); // Clean up tables

      if (cleanLine.trim()) {
        contentLines.push(cleanLine);
      }
    }
  }

  return { title, subtitle, content: contentLines };
}

async function generatePDF(markdownPath: string): Promise<void> {
  const content = fs.readFileSync(markdownPath, 'utf-8');
  const parsed = parseMarkdown(content);

  // Create a simple text-based PDF template
  const template = {
    basePdf: {
      width: 210,
      height: 297,
      padding: [20, 20, 20, 20],
    },
    schemas: [
      [
        {
          name: 'title',
          type: 'text',
          position: { x: 20, y: 20 },
          width: 170,
          height: 15,
          fontSize: 16,
          fontColor: '#1a1a1a',
        },
        {
          name: 'subtitle',
          type: 'text',
          position: { x: 20, y: 38 },
          width: 170,
          height: 10,
          fontSize: 9,
          fontColor: '#666666',
        },
        {
          name: 'content',
          type: 'text',
          position: { x: 20, y: 55 },
          width: 170,
          height: 220,
          fontSize: 9,
          fontColor: '#333333',
          lineHeight: 1.4,
        },
      ],
    ],
  };

  // Truncate content to fit on single page for now
  const truncatedContent = parsed.content.slice(0, 50).join('\n');

  const inputs = [
    {
      title: parsed.title,
      subtitle: parsed.subtitle || 'MaxSam V4 - Excess Funds Recovery',
      content: truncatedContent,
    },
  ];

  try {
    const pdf = await generate({
      template: template as any,
      inputs,
      plugins: { text },
    });

    const outputPath = markdownPath.replace('.md', '.pdf');
    fs.writeFileSync(outputPath, pdf);
    console.log(`  Created: ${path.basename(outputPath)}`);
  } catch (error) {
    console.error(`  Error creating PDF: ${error}`);
  }
}

async function main() {
  console.log('Converting County Rules Markdown to PDF...\n');

  const files = fs.readdirSync(COUNTY_RULES_DIR);
  const markdownFiles = files.filter(
    (f) => f.endsWith('.md') && f !== 'README.md'
  );

  for (const file of markdownFiles) {
    const filePath = path.join(COUNTY_RULES_DIR, file);
    console.log(`Processing: ${file}`);
    await generatePDF(filePath);
  }

  console.log('\n✓ PDF conversion complete!');
  console.log(`  Output directory: ${COUNTY_RULES_DIR}`);
}

main().catch(console.error);
