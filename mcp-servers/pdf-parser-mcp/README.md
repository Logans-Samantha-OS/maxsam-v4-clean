# PdfParser MCP Server

PDF extraction (tables, text)

## Installation

```bash
cd C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\pdf-parser-mcp
npm install
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "pdf-parser": {
    "command": "node",
    "args": ["C:\Users\MrTin\Downloads\MaxSam-V4\mcp-servers\pdf-parser-mcp\index.js"],
    "env": {
      
    }
  }
}
```

## Environment Variables



## Tools

### pdf_extract_text
Extract all text from PDF

### pdf_extract_tables
Extract structured tables

### pdf_parse_excess_funds
Parse Dallas County format

