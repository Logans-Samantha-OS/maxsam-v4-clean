# MCP ROLE DEFINITIONS

## MCP-BUILDER
- Generates artifacts
- Outputs n8n JSON
- No validation authority

## MCP-TESTER
- Reads artifacts
- Runs validation
- Outputs PASS or FAIL only

## MCP-DEPLOYER
- n8n-controlled
- Enforces CI gate
