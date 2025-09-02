import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline";

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'tsx', 'main.ts'],
    cwd: process.cwd(),
  });

  const client = new Client({
    name: "Restaurant MCP Client",
    version: "1.0.0"
  });

  await client.connect(transport);

  // 1. Load restaurant data
  let response = await client.callTool({ name: 'loadRestaurantData', arguments: {} });
  console.log(response?.content?.[0]?.text ?? JSON.stringify(response));

  // 2. List menu items
  response = await client.callTool({ name: 'listMenuItems', arguments: {} });
  console.log(response?.content?.[0]?.text ?? JSON.stringify(response));

  // 3. Add item(s) to cart interactively
  while (true) {
    const addMore = (await prompt("Add item to cart? (yes/no): ")).trim().toLowerCase();
    if (addMore !== "yes") break;
    const itemName = await prompt("Enter item name: ");
    const quantity = parseInt(await prompt("Enter quantity: "), 10);
    const addResp = await client.callTool({
      name: 'addItemToCart',
      arguments: { itemName, quantity }
    });
    console.log(addResp?.content?.[0]?.text ?? JSON.stringify(addResp));
  }

  // 4. View cart
  response = await client.callTool({ name: 'viewCart', arguments: {} });
  console.log(response?.content?.[0]?.text ?? JSON.stringify(response));

  // 5. Place order interactively
  const deliveryDate = await prompt("Enter delivery date (YYYY-MM-DD): ");
  const deliveryTime = await prompt("Enter delivery time (HH:MM, 24-hour): ");
  response = await client.callTool({
    name: 'placeOrder',
    arguments: { deliveryDate, deliveryTime }
  });
  console.log(response?.content?.[0]?.text ?? JSON.stringify(response));

  await transport.close();
}

main().catch(console.error);