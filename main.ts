import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { PdfReader } from 'pdfreader';
import { Readable } from 'stream';
import { format, isValid } from 'date-fns';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


const serverState = {
    isDataLoaded: false,
    restaurantInfo: '',
    catalog: [] as { item_name: string; price: number; available_quantity: number }[],
    schedule: {} as Record<string, { OpenTime: string; CloseTime: string }>,
    cart: [] as { itemName: string; quantity: number; price: number }[],
};



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


function parseCsvBuffer(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const results: any[] = [];
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        stream
            .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}


function parsePdfBuffer(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const textItems: string[] = [];
        new PdfReader().parseBuffer(buffer, (err, item) => {
            if (err) {
                reject(err);
            } else if (!item) {
                resolve(textItems.join(' ').trim());
            } else if (item.text) {
                textItems.push(item.text);
            }
        });
    });
}


const server = new McpServer({
    name: "MCP Restaurant Server",
    version: "1.0.0"
});




server.registerTool(
    'loadRestaurantData',
    {
        title: 'Load Restaurant Data',
        description: 'Initializes the system by loading all necessary restaurant data from local files (menu, schedule, and general info). This MUST be the first tool called in any new conversation.',
        inputSchema: {}
    },

    async () => {
        try {
            const pdfPath = path.join(__dirname, '_Restaurant_.pdf');
            const pdfBuffer = fs.readFileSync(pdfPath);
            serverState.restaurantInfo = await parsePdfBuffer(pdfBuffer);

            const catalogPath = path.join(__dirname, 'sample_catalog.csv');
            const catalogBuffer = fs.readFileSync(catalogPath);
            const rawCatalog = await parseCsvBuffer(catalogBuffer);
            serverState.catalog = rawCatalog.map(row => ({
                item_name: row.item_name,
                price: parseFloat(row.price),
                available_quantity: parseInt(row.available_quantity, 10)
            }));

            const schedulePath = path.join(__dirname, '_restaurant_schedule.csv');
            const scheduleBuffer = fs.readFileSync(schedulePath);
            const rawSchedule = await parseCsvBuffer(scheduleBuffer);
            serverState.schedule = {};
            rawSchedule.forEach(row => {
                if (row.DayOfWeek) {
                    serverState.schedule[row.DayOfWeek.toLowerCase().trim()] = {
                        OpenTime: row.OpenTime.trim(),
                        CloseTime: row.CloseTime.trim()
                    };
                }
            });

            serverState.isDataLoaded = true;
            return {
                content: [{
                    type: "text",
                    text: "Success: All restaurant data has been successfully loaded. The system is ready."
                }]
            };

        } catch (error: any) {
            console.error("[loadRestaurantData Error]", error);
            return {
                content: [{
                    type: "text",
                    text: `Error: Failed to load restaurant data. Details: ${error.message}`
                }]
            };
        }
    }
);





server.registerTool(
    'answerGeneralQuestion',


    {
        title: 'Answer General Question',
        description: 'Answers general questions about the restaurant, such as its story, hours, or policies. Use this for non-ordering queries.',
        inputSchema: {
            question: z.string().describe("The user's question about the restaurant.")
        }
    },


    async ({ question }) => {
        if (!serverState.isDataLoaded) {

            return {
                content: [{
                    type: "text",
                    text: "Error: Data is not loaded. Please run the 'loadRestaurantData' tool first."
                }]
            };
        }

        const prompt = `You are a helpful restaurant assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I'm sorry, I don't have that information."

    Context: "${serverState.restaurantInfo}"

    Question: "${question}"

    Answer:`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
        });

        const answerText = completion.choices[0]?.message?.content || "I couldn't generate an answer.";



        return {
            content: [{
                type: "text",
                text: answerText
            }]
        };
    }
);




server.registerTool(

    'listMenuItems',


    {
        title: 'List Menu Items',
        description: 'Displays a list of all available food and drink items from the menu, including their prices.',
        inputSchema: {}
    },


    async () => {
        if (!serverState.isDataLoaded) {
            return {
                content: [{
                    type: "text",
                    text: "Error: Data is not loaded. Please run the 'loadRestaurantData' tool first."
                }]
            };
        }

        if (serverState.catalog.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "The menu is currently empty."
                }]
            };
        }

        const menuString = serverState.catalog.map(item => `• ${item.item_name} - $${item.price.toFixed(2)}`).join('\n');

        return {
            content: [{
                type: "text",
                text: `Here is our menu:\n${menuString}`
            }]
        };
    }
);




server.registerTool(

    'addItemToCart',


    {
        title: 'Add Item to Cart',
        description: "Adds a specified quantity of a menu item to the user's shopping cart.",
        inputSchema: {
            itemName: z.string().describe("The exact name of the item to add from the menu."),
            quantity: z.number().int().positive().describe("The number of items to add.")
        }
    },


    async ({ itemName, quantity }) => {
        if (!serverState.isDataLoaded) {
            return {
                content: [{
                    type: "text",
                    text: "Error: Data is not loaded. Please run the 'loadRestaurantData' tool first."
                }]
            };
        }

        const catalogItem = serverState.catalog.find(item => item.item_name.toLowerCase() === itemName.toLowerCase());

        if (!catalogItem) {
            return {
                content: [{
                    type: "text",
                    text: `Error: Item "${itemName}" was not found on the menu.`
                }]
            };
        }

        if (catalogItem.available_quantity < quantity) {
            return {
                content: [{
                    type: "text",
                    text: `Error: Not enough stock for "${itemName}". Only ${catalogItem.available_quantity} are available.`
                }]
            };
        }


        const existingCartItem = serverState.cart.find(item => item.itemName.toLowerCase() === itemName.toLowerCase());
        if (existingCartItem) {
            existingCartItem.quantity += quantity;
        } else {
            serverState.cart.push({ itemName: catalogItem.item_name, quantity, price: catalogItem.price });
        }

        return {
            content: [{
                type: "text",
                text: `Success: Added ${quantity} x ${catalogItem.item_name} to your cart.`
            }]
        };
    }
);




server.registerTool(

    'viewCart',


    {
        title: 'View Shopping Cart',
        description: 'Shows the current items in the shopping cart, their quantities, and the total price.',
        inputSchema: {}
    },


    async () => {
        if (serverState.cart.length === 0) {
            return {
                content: [{
                    type: "text",
                    text: "Your cart is currently empty."
                }]
            };
        }

        const cartSummary = serverState.cart.map(item => `• ${item.quantity} x ${item.itemName} ($${item.price.toFixed(2)} each)`).join('\n');
        const totalPrice = serverState.cart.reduce((total, item) => total + (item.quantity * item.price), 0);

        return {
            content: [{
                type: "text",
                text: `Your current cart:\n${cartSummary}\n\n**Total Price: $${totalPrice.toFixed(2)}**`
            }]
        };
    }
);




server.registerTool(

    'placeOrder',


    {
        title: 'Place Final Order',
        description: 'Finalizes and submits the order. Requires a delivery date and time. This is the last step of the ordering process.',
        inputSchema: {
            deliveryDate: z.string().describe("The desired delivery date in YYYY-MM-DD format."),
            deliveryTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format").describe("The desired delivery time in HH:MM (24-hour) format.")
        }
    },


    async ({ deliveryDate, deliveryTime }) => {

        if (!serverState.isDataLoaded) {
            return { content: [{ type: "text", text: "Error: Data is not loaded. Please run the 'loadRestaurantData' tool first." }] };
        }
        if (serverState.cart.length === 0) {
            return { content: [{ type: "text", text: "Error: Cannot place an order with an empty cart." }] };
        }


        let targetDate;
        try {
            targetDate = new Date(deliveryDate);
            if (!isValid(targetDate)) throw new Error();
        } catch (e) {
            return { content: [{ type: "text", text: "Error: Invalid date format. Please use YYYY-MM-DD." }] };
        }

        const dayOfWeek = format(targetDate, 'EEEE').toLowerCase();
        const daySchedule = serverState.schedule[dayOfWeek];

        if (!daySchedule || daySchedule.OpenTime === 'closed') {
            return { content: [{ type: "text", text: `Error: Sorry, we are closed on ${dayOfWeek}s.` }] };
        }
        if (deliveryTime < daySchedule.OpenTime || deliveryTime > daySchedule.CloseTime) {
            return { content: [{ type: "text", text: `Error: Sorry, on ${dayOfWeek}s our hours are from ${daySchedule.OpenTime} to ${daySchedule.CloseTime}.` }] };
        }


        const orderId = `ORD-${Date.now()}`;
        const totalPrice = serverState.cart.reduce((total, item) => total + (item.quantity * item.price), 0);


        console.error("--- New Order Received ---");
        console.error(`Order ID: ${orderId}`);
        console.error(`Total Price: $${totalPrice.toFixed(2)}`);
        console.error(`Delivery: ${deliveryDate} at ${deliveryTime}`);
        console.error("Items:", JSON.stringify(serverState.cart, null, 2));


        serverState.cart.forEach(cartItem => {
            const catalogItem = serverState.catalog.find(item => item.item_name === cartItem.itemName);
            if (catalogItem) {
                catalogItem.available_quantity -= cartItem.quantity;
            }
        });


        serverState.cart = [];

        return {
            content: [{
                type: "text",
                text: `Success! Your order has been placed. Your order ID is ${orderId}. Thank you!`
            }]
        };
    }
);





console.error("MCP Restaurant Server is starting...");
console.error("Ready to connect with MCP Inspector.");


const transport = new StdioServerTransport();
server.connect(transport).then(() => {
    console.error("MCP Restaurant Server is now connected and listening for requests.");
}).catch(err => {
    console.error("Failed to connect MCP Restaurant Server:", err);
});