import { createClient } from "redis";
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const client = createClient();

client.on("error", (err) => console.log("Redis Error", err)).connect();

const subscribedUsers = {};

async function pullOrders() {
  try {
    console.log("Started Pulling from queue");

    while (true) {
      try {
        const order = await client.brPop("orderbook", 0);
        if (order) {
          console.log(order);
          // TODO:logic to notify all rooms with orders
          // TODO: add debouncing
          // TODO: logic to break loop if the subscribedUsers are changed
        }
      } catch (error) {
        console.error("Error processing submission:", error);
      }
    }
  } catch (error) {
    console.error("Failed to connect to Redis", error);
  }
}

const symbolRooms = {};

wss.on("connection", async function connection(ws) {
  pullOrders();
  ws.on("message", function message(data) {
    console.log(JSON.parse(data.toString()));
    // TODO: write logic to subscribe and unsubscribe to room
  });

  console.log(await client.lPop("orderbook"));
  ws.send("something");
});
