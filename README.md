# Restaurant_MCP

## Overview

**Restaurant_MCP** is a Node.js/TypeScript server that simulates a restaurant ordering system, designed to interact with the Model Context Protocol (MCP) ecosystem. It loads restaurant data (menu, schedule, info), answers questions, manages a shopping cart, and processes orders. The server exposes a set of tools (API endpoints) for conversational agents or clients to interact with the restaurant.

---

## Project Structure

- **main.ts**: Main server implementation and tool registration.
- **_Restaurant_.pdf**: PDF containing general restaurant information.
- **sample_catalog.csv**: CSV file listing menu items, prices, and available quantities.
- **_restaurant_schedule.csv**: CSV file with opening and closing times for each day.
- **orders.json**: Stores all placed orders.
- **.env**: Environment variables (API keys, etc).
- **package.json**: Project dependencies and scripts.
- **.vscode/mcp.json**: VSCode MCP Inspector configuration.

---

## Setup Instructions

### 1. Prerequisites

- Node.js (v18+ recommended)
- npm

### 2. Install Dependencies

```sh
npm install
```

### 3. Environment Variables

Create a `.env` file in the project root with your API keys:

```
GROQ_API_KEY=your_groq_api_key
```

### 4. Running the Server

#### Development (with TypeScript)

```sh
npm start
```

#### Build (compile TypeScript)

```sh
npm run build
```

---

## Usage

The server is designed to be used with the MCP Inspector or any MCP-compatible client. It communicates over stdio and exposes several tools (API endpoints) for interaction.

### Connecting with MCP Inspector

The `.vscode/mcp.json` configures the MCP Inspector to launch the server using:

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "tsx", "main.ts"]
}
```

---

## Data Files

- **_Restaurant_.pdf**: Contains the restaurant's story, policies, and general info.
- **sample_catalog.csv**: Menu items, prices, and stock.
- **_restaurant_schedule.csv**: Opening/closing times for each day.
- **orders.json**: All placed orders are appended here.

---

## Tools (API Endpoints)

### 1. `loadRestaurantData`

**Purpose:**  
Loads all restaurant data (info, menu, schedule) from local files.  
**Usage:**  
Must be called first in any new session.

**Input:**  
_None_

**Behavior:**  
- Reads `_Restaurant_.pdf` for general info.
- Loads `sample_catalog.csv` for menu items.
- Loads `_restaurant_schedule.csv` for opening hours.
- Populates in-memory state.

**Response:**  
Success or error message.

---

### 2. `answerGeneralQuestion`

**Purpose:**  
Answers general questions about the restaurant (story, hours, policies).

**Input:**  
- `question` (string): The user's question.

**Behavior:**  
- Uses the loaded restaurant info as context.
- Calls the Groq LLM to generate an answer.
- If the answer is not in the context, responds accordingly.

**Response:**  
Text answer.

---

### 3. `listMenuItems`

**Purpose:**  
Lists all available menu items with prices.

**Input:**  
_None_

**Behavior:**  
- Reads the loaded menu catalog.
- Formats and returns the menu.

**Response:**  
Formatted menu list.

---

### 4. `addItemToCart`

**Purpose:**  
Adds a specified menu item and quantity to the user's cart.

**Input:**  
- `itemName` (string): Exact menu item name.
- `quantity` (integer): Number of items to add.

**Behavior:**  
- Checks if the item exists and is in stock.
- Adds or updates the item in the cart.

**Response:**  
Success or error message.

---

### 5. `viewCart`

**Purpose:**  
Displays the current shopping cart and total price.

**Input:**  
_None_

**Behavior:**  
- Lists all items in the cart with quantities and prices.
- Calculates the total.

**Response:**  
Cart summary and total price.

---

### 6. `placeOrder`

**Purpose:**  
Finalizes and submits the order.

**Input:**  
- `deliveryDate` (string, YYYY-MM-DD): Desired delivery date.
- `deliveryTime` (string, HH:MM): Desired delivery time (24-hour format).

**Behavior:**  
- Validates date and time against the restaurant's schedule.
- Checks cart is not empty.
- Generates a unique order ID.
- Saves the order to `orders.json`.
- Deducts ordered quantities from the catalog.
- Empties the cart.

**Response:**  
Order confirmation with order ID, or error.

---

## How to Create a New Tool

1. Use `server.registerTool` in `main.ts`.
2. Provide:
   - Tool name (string)
   - Metadata (title, description, input schema)
   - Async handler function

Example:
```ts
server.registerTool(
  'toolName',
  {
    title: 'Tool Title',
    description: 'What this tool does.',
    inputSchema: { /* zod schema */ }
  },
  async (input) => {
    // Tool logic
    return { content: [{ type: "text", text: "Result" }] };
  }
);
```

---

## How to Use the Server

1. Start the server (`npm start`).
2. Connect via MCP Inspector or compatible client.
3. Call `loadRestaurantData` first.
4. Use other tools as needed:
   - Ask questions (`answerGeneralQuestion`)
   - Browse menu (`listMenuItems`)
   - Add items (`addItemToCart`)
   - View cart (`viewCart`)
   - Place order (`placeOrder`)

---

## Error Handling

- All tools check if data is loaded before proceeding.
- Input validation is enforced via [zod](https://github.com/colinhacks/zod).
- Errors are returned as text responses.

---

## Dependencies

- `@modelcontextprotocol/sdk`: MCP server framework.
- `csv-parser`: CSV file parsing.
- `pdfreader`: PDF text extraction.
- `groq-sdk`: LLM API for answering questions.
- `date-fns`: Date/time utilities.
- `dotenv`: Environment variable loading.
- `zod`: Input validation.

---

## File Reference

- [main.ts](main.ts): Main server logic and tool definitions.
- [sample_catalog.csv](sample_catalog.csv): Menu data.
- [_restaurant_schedule.csv](_restaurant_schedule.csv): Schedule data.
- [_Restaurant_.pdf](_Restaurant_.pdf): Restaurant info.
- [orders.json](orders.json): Order storage.
- [.env](.env): API keys and environment variables.
- [package.json](package.json): Project metadata and dependencies.
- [.vscode/mcp.json](.vscode/mcp.json): MCP Inspector configuration.
