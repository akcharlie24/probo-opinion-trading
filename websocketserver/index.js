import { createClient } from "redis";
import WebSocket, { WebSocketServer } from "ws";

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
        const orderbook = JSON.parse(order.element);
        if (order) {
          console.log(orderbook);
          const arrStocks = Object.keys(orderbook);
          const stockToNotify = arrStocks[0];
          const usersToPing = subscribedUsers[stockToNotify];

          if (usersToPing) {
            // TODO: logic to break loop if the subscribedUsers are changed
            for (let webSocket of usersToPing) {
              console.log(webSocket.readyState);

              if (webSocket.readyState === WebSocket.OPEN)
                webSocket.send(JSON.stringify(orderbook));
            }
          }

          // wss.clients.forEach(function each(client) {
          //   console.log(client);
          //   if (client.readyState === WebSocket.OPEN) {
          //     client.send("hi");
          //   }
          // });

          // TODO: logic to notify all rooms with orders
          // TODO: add debouncing
          // TODO: One problem -> as we are popping orderbooks -> how will new users get the same orderbook when he subscribes coz its aleardy popped ?
        }
      } catch (error) {
        console.error("Error processing submission:", error);
      }
    }
  } catch (error) {
    console.error("Failed to connect to Redis", error);
  }
}

wss.on("connection", async function connection(ws) {
  pullOrders();
  ws.on("message", function message(data) {
    pullOrders();
    const message = JSON.parse(data.toString());

    const stockSymbol = message.stockSymbol;
    const action = message.action;

    // // TODO: this we'll need to impolement as a continous sending function to those who are sub
    // // and we need to refresh the order queue too

    // wss.clients.forEach(function each(client) {
    //   if (
    //     client.readyState === WebSocket.OPEN &&
    //     message.action === "SUBSCRIBE" // logic comes from our orderroom not this
    //   ) {
    //     client.send("hi");
    //   }
    // });

    if (action === "SUBSCRIBE") {
      // TODO: add basic sanitization in code everywhere -> check symbol and user exists
      // if(!userId) throw Error  //not needed now as ws
      // TODO: sanitization check user might alerady be SUBSCRIBED

      if (!subscribedUsers[stockSymbol]) {
        const newSub = [ws];
        subscribedUsers[stockSymbol] = newSub;
      } else {
        let arr = [...subscribedUsers[stockSymbol]];
        arr.push(ws);
        subscribedUsers[stockSymbol] = [...arr];
      }

      ws.send("SUBSCRIBED successfully");
    }

    if (action === "UNSUBSCRIBE") {
      // TODO: sanitization -> false UNSUBSCRIBE

      const subbedArr = [...subscribedUsers[stockSymbol]];
      console.log(subbedArr.length);
      const arr = subbedArr.filter((order) => {
        JSON.stringify(order) !== JSON.stringify(ws);
      });
      subscribedUsers[stockSymbol] = arr;

      if (Object.keys(subscribedUsers[stockSymbol]).length === 0) {
        delete subscribedUsers[stockSymbol];
      }
      ws.send("UNSUBSCRIBED successfully");
      console.log(subscribedUsers);
    }
  });

  // console.log(await client.lPop("orderbook"));
  ws.send("something");
});
