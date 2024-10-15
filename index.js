const express = require("express");
const app = express();

app.use(express.json());

const INR_BALANCES = {
  user1: {
    balance: 10,
    locked: 0,
  },
  user2: {
    balance: 2000,
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
        quantity: 5,
        locked: 5,
      },
      no: {
        quantity: 0,
        locked: 0,
      },
    },
  },
  user2: {
    BTC_USDT_10_Oct_2024_9_30: {
      no: {
        quantity: 0,
        locked: 0,
      },
      yes: {
        quantity: 2,
        locked: 1,
      },
    },
  },
};

app.post("/user/create/:userId", (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    res.status(404).send({ messsage: "Please enter the userId" });
    return;
  }

  if (userId in INR_BALANCES) {
    res.status(400).json({ message: "User already exists" });
    return;
  }

  INR_BALANCES[userId] = {
    balance: 0,
    locked: 0,
  };

  STOCK_BALANCES[userId] = {};

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

  res.status(201).json({ message: `Symbol ${stockSymbol} created` });
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
  if (!(userId in INR_BALANCES)) {
    res.status(404).json({ message: "User doesnt exist" });
  }
  res.status(200).json({ balance: INR_BALANCES[userId].balance });
});

app.post("/onramp/inr", (req, res) => {
  const { userId, amount } = req.body;

  if (!(userId in INR_BALANCES)) {
    res.status(404).json({ message: "User doesnt exist" });
  }

  INR_BALANCES[userId].balance =
    INR_BALANCES[userId].balance + parseInt(amount);

  res.status(200).json({ message: `Onramped ${userId} with amount 50000` });
});

app.get("/balance/stock/:userId", (req, res) => {
  const userId = req.params.userId;

  res.status(200).send(STOCK_BALANCES[userId]);
});

app.post("/trade/mint", (req, res) => {
  let { userId, stockSymbol, quantity, price } = req.body;

  if (!(userId in INR_BALANCES)) {
    res.status(404).json({ message: "User doesnt exist" });
  }

  quantity = parseInt(quantity);
  const priceOfTokens = quantity * 2 * price;
  const balance = INR_BALANCES[userId].balance;

  if (priceOfTokens > balance) {
    res.status(401).json({ message: "Insufficient Balance" });
    return;
  }

  INR_BALANCES[userId].balance -= priceOfTokens;

  const userStocks = Object.keys(STOCK_BALANCES[userId]);

  if (stockSymbol in userStocks) {
    STOCK_BALANCES[userId][stockSymbol] = {
      yes: {
        quantity:
          "yes" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].yes.quantity + quantity
            : quantity,
        locked:
          "yes" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].yes.locked
            : 0,
      },
      no: {
        quantity:
          "no" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].no.quantity + quantity
            : quantity,
        locked:
          "no" in STOCK_BALANCES[userId][stockSymbol]
            ? STOCK_BALANCES[userId][stockSymbol].no.locked
            : 0,
      },
    };
  } else {
    STOCK_BALANCES[userId][stockSymbol] = {
      yes: {
        quantity: quantity,
        locked: 0,
      },
      no: {
        quantity: quantity,
        locked: 0,
      },
    };
  }

  const remainingBalance = balance - priceOfTokens;

  res.status(200).json({
    message: `Minted ${quantity} 'yes' and 'no' tokens for user ${userId}, remaining balance is ${remainingBalance}`,
  });
});

app.post("/order/sell", (req, res) => {
  let { userId, stockSymbol, quantity, price, stockType } = req.body;

  quantity = parseInt(quantity);

  const priceToSell = price / 100;

  const userQuantity =
    STOCK_BALANCES[userId][stockSymbol]?.[stockType]?.quantity;

  if (!userQuantity) {
    res.status(404).json({ message: "No stocks to sell" });
    return;
  }

  if (userQuantity < quantity) {
    res.status(404).json({ message: "Not enough stocks" });
    return;
  }

  STOCK_BALANCES[userId][stockSymbol][stockType].quantity -= quantity;
  STOCK_BALANCES[userId][stockSymbol][stockType].locked += quantity;

  const priceString = priceToSell.toString();

  if (!(stockSymbol in ORDERBOOK)) ORDERBOOK[stockSymbol] = {};
  if (!(stockType in ORDERBOOK[stockSymbol]))
    ORDERBOOK[stockSymbol][stockType] = {};

  if (priceString in ORDERBOOK[stockSymbol][stockType]) {
    ORDERBOOK[stockSymbol][stockType][priceString].total += quantity;
    if (userId in ORDERBOOK[stockSymbol][stockType][priceString].orders) {
      ORDERBOOK[stockSymbol][stockType][priceString].orders[userId] += quantity;
    } else
      ORDERBOOK[stockSymbol][stockType][priceString].orders[userId] = quantity;
  } else {
    ORDERBOOK[stockSymbol][stockType][priceString] = {
      total: quantity,
      orders: {
        [userId]: quantity,
      },
    };
  }

  res.status(200).json({ message: "Sell order placed and pending" });
});

app.post("/order/buy", (req, res) => {
  let { userId, stockSymbol, quantity, price, stockType } = req.body;

  let balance = INR_BALANCES[userId].balance;
  const totalBuyPrice = quantity * price;

  if (balance < totalBuyPrice) {
    res.status(404).json({ message: "Not enough balance" });
    return;
  }
  if (!(stockSymbol in ORDERBOOK)) {
    res.status(404).json({ message: "No such stock exists" });
  }

  const priceToBuy = parseFloat(price) / 100;

  const pricesAvailable = Object.keys(ORDERBOOK[stockSymbol][stockType]).map(
    (price) => parseFloat(price),
  );
  const sortedPrices = pricesAvailable.sort((a, b) => b - a);

  function createReverseSellOrder(priceToMatch, remainingQuantity) {
    let quantity = remainingQuantity;

    const priceToSell = 10 - priceToMatch;

    const userQuantity =
      STOCK_BALANCES[userId][stockSymbol]?.[stockType]?.quantity;

    if (!userQuantity) {
      res.status(404).json({ message: "No stocks to sell" });
      return;
    }

    if (userQuantity < quantity) {
      res.status(404).json({ message: "Not enough stocks" });
      return;
    }

    STOCK_BALANCES[userId][stockSymbol][stockType].quantity -= quantity;
    STOCK_BALANCES[userId][stockSymbol][stockType].locked += quantity;

    const priceString = priceToSell.toString();

    if (!(stockSymbol in ORDERBOOK)) ORDERBOOK[stockSymbol] = {};
    if (!(stockType in ORDERBOOK[stockSymbol]))
      ORDERBOOK[stockSymbol][stockType] = {};

    if (priceString in ORDERBOOK[stockSymbol][stockType]) {
      ORDERBOOK[stockSymbol][stockType][priceString].total += quantity;
      if (userId in ORDERBOOK[stockSymbol][stockType][priceString].orders) {
        ORDERBOOK[stockSymbol][stockType][priceString].orders[userId] +=
          quantity;
      } else
        ORDERBOOK[stockSymbol][stockType][priceString].orders[userId] =
          quantity;
    } else {
      ORDERBOOK[stockSymbol][stockType][priceString] = {
        total: quantity,
        orders: {
          [userId]: quantity,
        },
      };
    }
  }

  function matchTrade(priceToMatch) {
    const orders = Object.keys(
      ORDERBOOK[stockSymbol][stockType][priceToMatch].orders,
    );
    let remainingQuantity = parseFloat(quantity);
    let priceToMatchString = priceToMatch.toString();
    for (let order of orders) {
      if (
        ORDERBOOK[stockSymbol][stockType][priceToMatchString].orders[order] <=
        remainingQuantity
      ) {
        let balanceTraded =
          ORDERBOOK[stockSymbol][stockType][priceToMatchString].orders[order] *
          priceToMatch *
          100;
        let stocksTraded =
          ORDERBOOK[stockSymbol][stockType][priceToMatchString].orders[order];

        INR_BALANCES[order].balance += balanceTraded;
        INR_BALANCES[userId].balance -= balanceTraded;
        STOCK_BALANCES[order][stockSymbol][stockType].locked -= stocksTraded;
        STOCK_BALANCES[userId][stockSymbol][stockType].quantity += stocksTraded;

        remainingQuantity -= stocksTraded;
        if (remainingQuantity === 0) break;
      } else {
        let balanceTraded = remainingQuantity * priceToMatch * 100;
        let stocksTraded = remainingQuantity;

        INR_BALANCES[order].balance += balanceTraded;
        INR_BALANCES[userId].balance -= balanceTraded;
        STOCK_BALANCES[order][stockSymbol][stockType].locked -= stocksTraded;
        STOCK_BALANCES[userId][stockSymbol][stockType].quantity += stocksTraded;

        // TODO: its obvios that it will be 0 here
        remainingQuantity -= stocksTraded;
        if (remainingQuantity === 0) break;
      }
    }

    if (remainingQuantity === 0) return;
    else {
      createReverseSellOrder(priceToMatch, remainingQuantity);
      return;
    }
  }

  //lowest match
  if (priceToBuy > sortedPrices[0]) {
    try {
      matchTrade(sortedPrices[0]);
      // TODO: Add message as per cases
      res.status(200).json({ message: "Trade executed" });
    } catch (error) {
      console.log(error);
      res.status(404).json({ message: "Transaction Failed" });
      return;
    }
  }
});

app.listen(3000, () => {
  console.log("listening on 3000");
});

// module.exports = app;
