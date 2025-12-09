#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

class HttpClientServer {
  constructor() {
    this.server = new Server({
      name: "http-client",
      version: "1.0.0"
    }, {
      capabilities: { tools: {} }
    });
    
    // TODO: Initialize API client here
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
  {
    "name": "http_get",
    "description": "GET request",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "http_post",
    "description": "POST request",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "http_put",
    "description": "PUT request",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  {
    "name": "http_delete",
    "description": "DELETE request",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  }
]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case "http_get":
            return await this.handleHttp_get(args);
          case "http_post":
            return await this.handleHttp_post(args);
          case "http_put":
            return await this.handleHttp_put(args);
          case "http_delete":
            return await this.handleHttp_delete(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  async handleHttp_get(args) {
    // TODO: Implement http_get
    return {
      content: [{ type: "text", text: "TODO: Implement http_get" }]
    };
  }

  async handleHttp_post(args) {
    // TODO: Implement http_post
    return {
      content: [{ type: "text", text: "TODO: Implement http_post" }]
    };
  }

  async handleHttp_put(args) {
    // TODO: Implement http_put
    return {
      content: [{ type: "text", text: "TODO: Implement http_put" }]
    };
  }

  async handleHttp_delete(args) {
    // TODO: Implement http_delete
    return {
      content: [{ type: "text", text: "TODO: Implement http_delete" }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("HttpClient MCP Server running");
  }
}

const server = new HttpClientServer();
server.run().catch(console.error);
