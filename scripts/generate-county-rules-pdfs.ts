/**
 * Generate PDF Summaries for Texas County Excess Funds Rules
 * Uses Gemini API to create summaries and saves them as PDFs
 *
 * Run with: npx tsx scripts/generate-county-rules-pdfs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// County data collected from web scraping
const COUNTY_DATA = {
  texas_general: {
    name: 'Texas State Law',
    content: `
## Texas Tax Code Section 34.04 - Claims for Excess Proceeds

### Overview
When a foreclosed property sells at auction for more than the outstanding debt, the excess constitutes "surplus" or "excess proceeds." These funds belong to the former property owner or lienholders.

### Key Legal Requirements

**Filing Deadline:**
- Tax Foreclosure: 2 years from sale date
- Mortgage Foreclosure: Generally 3 years from sale date

**Who Can Claim:**
1. Former property owners
2. Lienholders with recorded interests
3. Heirs of the former owner (with proof of relationship)

**Minimum Threshold:**
- Claims are valid for amounts exceeding $25

### Claim Process

1. **File a Petition** - Submit to the district court in the county where property was sold
2. **Provide Documentation** - Proof of ownership, deed, or lien documentation
3. **Pay Court Fees** - Filing fees vary by county
4. **Attend Hearing** - Required if multiple claims exist

### Distribution Priority (Texas Tax Code)
1. Tax sale purchaser if sale is voided
2. Taxing units for subsequent taxes
3. Lienholders for amounts due
4. Taxing units for unpaid amounts in judgment
5. Former owners as interests may appear

### Assignment Rules
- Must be in writing and signed by original claimant
- Assignee must pay at least 80% of claim amount at time of assignment
- Return capped at 125% of amount paid to claimant

### Important Restrictions
- Former owners who acquired interest AFTER judgment date cannot claim
- Interest or costs may not be allowed on claims
- Missing deadline = funds go to taxing units
    `
  },

  dallas: {
    name: 'Dallas County',
    content: `
## Dallas County Excess Funds Rules

### Contact Information
- **Location:** George L. Allen, Sr. Courts Building, 600 Commerce Street, Suite B20, Dallas, TX 75202
- **Trust Phone:** (214) 653-7161
- **Accounting Phone:** (214) 653-7260

### Overview
Dallas County handles excess funds from tax foreclosure sales through the District Clerk's Trust and Accounting Section.

### Claim Process

1. **Notification:** Former owners receive notice of excess funds
2. **Deadline:** File petition within 2 years of sale date
3. **Filing:** Submit petition to Dallas County District Court
4. **Documentation Required:**
   - Proof of ownership (deed)
   - Government-issued ID
   - Proof of relationship (if heir)

### Required Court Order Information
- Former owner's name
- Former owner's address
- Amount of excess proceeds to release

### Resources
- Dallas County Law Library available for self-help
- Downloadable trust forms available on county website

### How to Get Excess Funds List
Contact the Trust and Accounting Section at (214) 653-7161 or visit the District Clerk's office.
    `
  },

  harris: {
    name: 'Harris County',
    content: `
## Harris County Excess Funds Rules

### Contact Information
- **Address:** 201 Caroline, Suite 170, Houston, TX 77002
- **Phone:** (832) 927-5670
- **Email:** court.registry@hcdistrictclerk.com

### Overview
When property sells at a Harris County tax foreclosure sale with proceeds exceeding the tax obligation, the surplus is classified as "excess proceeds" and held by the Accounting Section.

### Notification Process
Upon receipt of excess proceeds greater than $25, a certified letter is sent to the former owner within 31 days.

### Claim Process

1. **Court Order Required:** To release excess proceeds, claimants must obtain a court order signed by the presiding judge
2. **Required Information in Order:**
   - Former owner's name
   - Former owner's address
   - Amount of excess proceeds to release

### How to Obtain Court Order
- Hire a private attorney, OR
- Visit the Harris County Law Library (1019 Congress, downtown Houston) for self-help resources

### Deadline
File petition within 2 years of sale date. If not claimed, funds go to taxing units.

### Request Excess Funds List
Email court.registry@hcdistrictclerk.com (fees may apply)
    `
  },

  tarrant: {
    name: 'Tarrant County',
    content: `
## Tarrant County Excess Funds Rules

### Contact Information
- **Tax Assessor-Collector:** 100 E Weatherford St, Fort Worth, TX 76196
- **Phone:** (817) 884-1186
- **General County:** (817) 884-1100
- **Open Records:** openrecords@tarrantcountytx.gov

### Tax Sale Information
- Monthly delinquent tax sales occur on the first Tuesday of each month
- Sales conducted by Constable for Precinct 3

### Claim Process

1. **File Motion to Distribute Excess Funds** with the court
2. **Petition Requirements:**
   - Must be filed before 2nd anniversary of sale date
   - Can be filed under original cause number
   - Serve copy on all parties at least 20 days before hearing

### Distribution Priority
1. Tax sale purchaser (if sale voided)
2. Taxing units for subsequent taxes
3. Lienholders for amounts due
4. Taxing units for unpaid judgment amounts
5. Former owners

### Get Tax Sale Results
Email openrecords@tarrantcountytx.gov with month/year of tax sale

### Resources
- Tarrant County Law Library has "Motion to Distribute Excess Funds" form
- Forms available at tarrantcountytx.gov
    `
  },

  travis: {
    name: 'Travis County',
    content: `
## Travis County Excess Funds Rules

### Contact Information
- **Email:** dcfinance@traviscountytx.gov
- **Phone:** (512) 854-9457, Option 8
- **Law Library:** Civil and Family Court Facility, 1700 Guadalupe Street, 2nd Floor, Austin, TX 78701

### Overview
When property is sold in a tax foreclosure sale in Travis County with proceeds exceeding the total tax obligation, the overpayment is called "excess proceeds" and is deposited with the Finance Division.

### Notification Process
Upon receipt of excess proceeds greater than $25, a certified letter is sent to the former owner within 31 days.

### Claim Deadline
Property owners have 2 years from the property sale date to establish entitlement. If no claimant comes forward, funds are distributed to taxing units.

### Required Documentation for Release
A signed court order must include:
- Recipient's name
- Recipient's address
- Exact amount of excess proceeds on deposit to be released

### How to Obtain Court Order
- Hire a private attorney, OR
- Visit the Travis County Law Library for self-help information

### Fees
- 5% of total withdrawn (not to exceed $50) on uninvested funds
- 10% of total interest earned in any interest bearing account
    `
  },

  bexar: {
    name: 'Bexar County',
    content: `
## Bexar County Excess Funds Rules

### Contact Information
- **Tax Assessor-Collector:** 210-335-6628
- **Location:** Vista Verde Plaza Building, 233 N. Pecos la Trinidad, San Antonio, TX 78207
- **Deed Records:** 101 W. Nueva, Suite B109, San Antonio, TX 78205

### Foreclosure Sale Information
- Sales occur on first Tuesday of each month (10 AM - 4 PM)
- Location: West side of Bexar County Courthouse, 100 Dolorosa, San Antonio
- Payment: Cash or certified funds only (no personal checks)

### Redemption Periods
- **Agricultural/Homestead Properties:** 2 years from deed recording
- **All Other Properties:** 6 months from deed recording

### Claim Process
1. File petition with Bexar County District Court
2. Provide proof of ownership or lienholder status
3. File within 2 years of sale date

### Resources
- GIS Foreclosure Map: maps.bexar.org/foreclosures (updates twice monthly)
- Title searches available through title companies

### Important Notes
- County does not guarantee clear title
- Consult legal counsel before purchasing or claiming
    `
  },

  collin: {
    name: 'Collin County',
    content: `
## Collin County Excess Funds Rules

### Contact Information
- **Courthouse:** 2100 Bloomdale Road, McKinney, TX 75071
- **Administration Building:** 2300 Bloomdale Road, McKinney, TX 75071

### Foreclosure Sale Information
- Sheriff sales held on first Tuesday of each month
- Time: 10:00 AM - 4:00 PM
- Location: Steps of Collin County Courthouse

### Sale Types
1. **Tax Sale:** Collection of back property taxes
2. **Sheriff Sale:** Satisfy judgment awarded to plaintiff

### Claim Process

1. **File Petition** - District court where property sold
2. **Required Documentation:**
   - Transfer or assignment document
   - Current deed
   - Deed from time of ownership
3. **Deadline:** 2 years (tax foreclosure) or 3 years (mortgage foreclosure)

### Assignment Rules
- Must be in writing and signed by original claimant
- Assignee must pay at least 80% of claim amount
- Return capped at 125% of investment

### Important Restrictions
- Former owners who acquired interest after judgment cannot claim
- Missing deadline = funds forfeit to taxing units
    `
  },

  denton: {
    name: 'Denton County',
    content: `
## Denton County Excess Funds Rules

### Contact Information
- **Tax Assessor/Collector:** Dawn Waye
- **Address:** P.O. Box 90223, Denton, TX 76202 (or 1505 E McKinney Street, Denton)
- **District Clerk:** Maintains excess tax funds list

### Tax Sale Information
- Sheriff's Sales held on first Tuesday of each month at 10 AM
- Location: Denton County Courts Building, 1450 E McKinney Street, Denton

### Excess Funds List
Available at: dentoncounty.gov/DocumentCenter/View/3044/Excess-Tax-Funds-PDF

### Claim Process

1. **File Petition** - Before 2nd anniversary of sale date
2. **Required Documentation:**
   - Proof of ownership, heirship, or lien
   - Deed or lien release
   - Probate records (if heir)
3. **Pay Filing Fees** - Varies

### Who Can Claim
- Former property owners
- Lienholders with recorded interest
- Heirs (with proof of relationship)

### Important Restrictions
- Former owners who acquired interest after judgment cannot claim
- Interest or costs not allowed on claims
    `
  },

  fort_bend: {
    name: 'Fort Bend County',
    content: `
## Fort Bend County Excess Funds Rules

### Contact Information
- **District Clerk's Office:** 301 Jackson St, Richmond, TX 77469
- **Phone:** 281-342-3411

### Resources
The Fort Bend County District Clerk's Office offers a downloadable "Excess Proceeds from Tax Sale" PDF document through their Research/Resource Information section.

### Claim Process

1. **File Petition** - Submit to Fort Bend County District Court
2. **Deadline:** 2 years from sale date
3. **Required Documentation:**
   - Proof of ownership
   - Government-issued ID
   - Relationship proof (if heir)

### How to Get Excess Funds List
Contact the District Clerk's office at 281-342-3411 or visit fortbendcountytx.gov for the current excess proceeds report.

### Distribution Priority (Per Texas Law)
1. Tax sale purchaser (if sale voided)
2. Taxing units for subsequent taxes
3. Lienholders
4. Taxing units for judgment amounts
5. Former owners
    `
  }
};

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  // Using gemini-pro which should be widely available
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error Response:', errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GeminiResponse;
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

async function generateSummary(countyName: string, content: string, apiKey: string): Promise<string> {
  const prompt = `You are an expert in Texas real estate law. Create a clear, professional PDF summary document for the following county's excess funds (foreclosure surplus) rules.

Format the output as a well-structured document suitable for a PDF with these sections:
1. OVERVIEW - Brief 2-3 sentence summary
2. KEY CONTACT INFORMATION - Phone, address, email, website
3. DEADLINE TO FILE CLAIM - Specific timeframe
4. STEP-BY-STEP CLAIM PROCESS - Numbered steps
5. REQUIRED DOCUMENTS - Bulleted list
6. IMPORTANT RESTRICTIONS - What disqualifies claims
7. TIPS FOR SUCCESS - Practical advice

Make it clear, actionable, and professional. Use plain language that property owners can understand.

County: ${countyName}

Source Information:
${content}

Generate the PDF-ready summary:`;

  return await callGemini(prompt, apiKey);
}

async function main() {
  // Load API key from .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const geminiKeyMatch = envContent.match(/GEMINI_API_KEY="([^"]+)"/);

  if (!geminiKeyMatch) {
    console.error('GEMINI_API_KEY not found in .env.local');
    process.exit(1);
  }

  const apiKey = geminiKeyMatch[1];
  const outputDir = path.join(process.cwd(), 'docs', 'county-rules');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating Texas County Excess Funds Rule Summaries...\n');

  for (const [key, county] of Object.entries(COUNTY_DATA)) {
    console.log(`Processing: ${county.name}...`);

    try {
      // Generate summary using Gemini
      const summary = await generateSummary(county.name, county.content, apiKey);

      // Create markdown file (can be converted to PDF)
      const mdFilename = `${key.replace(/_/g, '-')}-excess-funds-rules.md`;
      const mdPath = path.join(outputDir, mdFilename);

      const mdContent = `# ${county.name} - Excess Funds Recovery Guide

*Generated: ${new Date().toLocaleDateString()}*
*For MaxSam V4 - Automated Excess Funds Recovery System*

---

${summary}

---

## Legal Disclaimer

This document is for informational purposes only and does not constitute legal advice. Laws and procedures may change. Always verify current requirements with the county directly or consult a licensed attorney.

## Source

Information compiled from official Texas county websites, Texas Tax Code Section 34.04, and Texas State Law Library resources.
`;

      fs.writeFileSync(mdPath, mdContent);
      console.log(`  Created: ${mdFilename}`);

      // Create JSON data file for PDF generation
      const jsonFilename = `${key.replace(/_/g, '-')}-data.json`;
      const jsonPath = path.join(outputDir, jsonFilename);

      const jsonData = {
        county: county.name,
        generated: new Date().toISOString(),
        summary: summary,
        rawContent: county.content
      };

      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

      // Rate limiting - wait between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  Error processing ${county.name}:`, error);
    }
  }

  // Create index file
  const indexPath = path.join(outputDir, 'README.md');
  const indexContent = `# Texas County Excess Funds Rules

This directory contains excess funds (foreclosure surplus) recovery guides for major Texas counties.

## Available Counties

| County | File |
|--------|------|
${Object.entries(COUNTY_DATA).map(([key, county]) =>
  `| ${county.name} | [${key.replace(/_/g, '-')}-excess-funds-rules.md](./${key.replace(/_/g, '-')}-excess-funds-rules.md) |`
).join('\n')}

## Key Information

- **Deadline:** Generally 2 years from tax foreclosure sale date
- **Minimum Claim:** $25 or more
- **Process:** File petition with county district court
- **Required:** Court order signed by presiding judge

## Quick Reference

### Dallas County
- Phone: (214) 653-7161
- Location: 600 Commerce Street, Suite B20, Dallas, TX 75202

### Harris County
- Phone: (832) 927-5670
- Email: court.registry@hcdistrictclerk.com

### Tarrant County
- Phone: (817) 884-1186
- Email: openrecords@tarrantcountytx.gov

### Travis County
- Phone: (512) 854-9457, Option 8
- Email: dcfinance@traviscountytx.gov

---

*Generated by MaxSam V4 - ${new Date().toLocaleDateString()}*
`;

  fs.writeFileSync(indexPath, indexContent);
  console.log('\nCreated index: README.md');

  console.log('\n✓ All county rule summaries generated!');
  console.log(`  Output directory: ${outputDir}`);
}

main().catch(console.error);
