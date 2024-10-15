const express = require("express");
const app = express();

app.use(express.json());

const INR_BALANCES = {
  user1: {
    balance: 10,
    locked: 0,
  },
  user2: {
    balance: 200,
    locked: 10,
  },
};

const ORDERBOOK = {
  BTC_USDT_10_Oct_2024_9_30: {
    yes: {
      9.5: {
        total: 12,
        orders: {
          user1: 2,
          user2: 10,
        },
      },
      8.5: {
        total: 12,
        orders: {
          user1: 3,
          user2: 3,
          user3: 6,
        },
      },
    },
    no: {},
  },
};

const STOCK_BALANCES = {
  user1: {
    BTC_USDT_10_Oct_2024_9_30: {
      yes: {
        quantity: 2,
        locked: 0,
      },
    },
  },
  user2: {
    BTC_USDT_10_Oct_2024_9_30: {
      no: {
        quantity: 3,
        locked: 4,
      },
    },
  },
};

app.post("/user/create/:userId", (req, res) => {
  console.log("hello");
  const userId = req.params.userId;

  if (!userId) {
    res.status(404).send({ messsage: "Please enter the userId" });
    return;
  }

  INR_BALANCES[userId] = {
    balance: 0,
    locked: 0,
  };

  res.status(201).json({ message: `User ${userId} created` });
});

app.post("/symbol/create/:stockSymbol", (req, res) => {
  const stockSymbol = req.params.stockSymbol;

  if (!stockSymbol) {
    res.status(404).send({ messsage: "Please enter the stockSymbol" });
    return;
  }

  const users = Object.keys(STOCK_BALANCES);

  for (const user of users) {
    STOCK_BALANCES[user][stockSymbol] = {
      yes: {
        quantity: 0,
        locked: 0,
      },
      no: {
        quantity: 0,
        locked: 0,
      },
    };
  }

  res.status(200).json({ message: `Symbol ${stockSymbol} created` });
});

app.get("/orderbook", (req, res) => {
  res.status(200).send(ORDERBOOK);
});

app.get("/balances/inr", (req, res) => {
  res.status(200).send(INR_BALANCES);
});

app.get("/balances/stock", (req, res) => {
  res.status(200).send(STOCK_BALANCES);
});

app.get("/balance/inr/:userId", (req, res) => {
  const userId = req.params.userId;

  res.status(200).json({ balance: INR_BALANCES[userId].balance });
});

app.post("/onramp/inr", (req, res) => {
  const { userId, amount } = req.body;

  INR_BALANCES[userId].balance =
    INR_BALANCES[userId].balance + parseInt(amount);

  res.status(200).json({ message: `Onramped ${userId} with amount 50000` });
});

app.get("/balance/stock/:userId", (req, res) => {
  const userId = req.params.userId;

  res.status(200).send(STOCK_BALANCES[userId]);
});

app.post("/order/buy/yes", (req, res) => {});

app.post("/trade/mint", (req, res) => {
  let { userId, stockSymbol, quantity } = req.body;

  quantity = parseInt(quantity);
  const price = quantity * 100;
  const balance = INR_BALANCES[userId].balance;

  if (price > balance) {
    res.status(404).json({ message: "Insufficient Balance" });
    return;
  }

  INR_BALANCES[userId].balance -= price;

  const userStocks = STOCK_BALANCES[userId];

  if (stockSymbol in userStocks) {
    STOCK_BALANCES[userId][stockSymbol] = {
      yes: {
        quantity:
          "yes" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].yes.quantity + quantity
            : quantity,
        locked:
          "yes" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].yes.quantity
            : 0,
      },
      no: {
        quantity:
          "no" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].no.quantity + quantity
            : quantity,
        locked:
          "no" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].no.quantity
            : 0,
      },
    };
  }

  const remainingBalance = balance - price;

  res.status(200).json({
    message: `Minted ${quantity} 'yes' and 'no' tokens for user ${userId}, remaining balance is ${remainingBalance}`,
  });
});

app.post("/order/sell/yes", (req, res) => {
  let { userId, stockSymbol, quantity, price } = req.body;

  quantity = parseInt(quantity);

  const priceToSell = price / 100;

  const userQuantity = STOCK_BALANCES[userId][stockSymbol]?.yes?.quantity;

  if (!userQuantity) {
    res.status(404).json({ message: "No stocks to sell" });
    return;
  }

  if (userQuantity < quantity) {
    res.status(404).json({ message: "Not enough stocks" });
    return;
  }

  STOCK_BALANCES[userId][stockSymbol].yes.quantity -= quantity;
  STOCK_BALANCES[userId][stockSymbol].yes.locked += quantity;

  const priceString = priceToSell.toString();

  if (priceToSell in ORDERBOOK[stockSymbol].yes) {
    ORDERBOOK[stockSymbol].yes[priceString].total += quantity;
    if (userId in ORDERBOOK[stockSymbol].yes[priceString].orders) {
      ORDERBOOK[stockSymbol].yes[priceString].orders[userId] += quantity;
    } else ORDERBOOK[stockSymbol].yes[priceString].orders[userId] = quantity;
  } else {
    ORDERBOOK[stockSymbol].yes[priceString] = {
      total: quantity,
      orders: {
        [userId]: quantity,
      },
    };
  }

  res.status(200).json({ message: "Sell order placed and pending" });
});

app.post("/order/sell/no", (req, res) => {
  let { userId, stockSymbol, quantity, price } = req.body;

  quantity = parseInt(quantity);

  const priceToSell = price / 100;

  const userQuantity = STOCK_BALANCES[userId][stockSymbol]?.no?.quantity;
  if (!userQuantity) {
    res.status(404).json({ message: "No stocks to sell" });
    return;
  }

  if (userQuantity < quantity) {
    res.status(404).json({ message: "Not enough stocks" });
    return;
  }

  STOCK_BALANCES[userId][stockSymbol].no.quantity -= quantity;
  STOCK_BALANCES[userId][stockSymbol].no.locked += quantity;

  const priceString = priceToSell.toString();

  if (priceToSell in ORDERBOOK[stockSymbol].no) {
    ORDERBOOK[stockSymbol].no[priceString].total += quantity;
    if (userId in ORDERBOOK[stockSymbol].no[priceString].orders) {
      ORDERBOOK[stockSymbol].no[priceString].orders[userId] += quantity;
    } else ORDERBOOK[stockSymbol].no[priceString].orders[userId] = quantity;
  } else {
    ORDERBOOK[stockSymbol].no[priceString] = {
      total: quantity,
      orders: {
        [userId]: quantity,
      },
    };
  }

  res.status(200).json({ message: "Sell order placed and pending" });
});

app.listen(3000, () => {
  console.log("listening on 3000");
});
