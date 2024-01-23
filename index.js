const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

async function run() {
  const userCollections = client.db("airbnb-light").collection("users");
  const roomsCollections = client.db("airbnb-light").collection("rooms");
  try {
    // create token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("token User", user);
      const token = jwt.sign(user, "secret_key");
      console.log("token", token);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true, token });
    });
    // verifyToken
    const verifyToken = (req, res, next) => {
      const token = req.cookies.token;
      console.log("verify token", token);
      if (!token) {
        return res.status(401).send({ error: "You are not authenticated" });
      }
      // verify tokne
      jwt.sign(token, "secret_key", (err, user) => {
        if (err) {
          return res.status(403).send({ error: "Token is not valid" });
        }
        req.decoded = user;
        next();
      });
    };
    // save user and if already exists then modify
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const isExists = await userCollections.findOne(filter);
      if (isExists)
        return res.send({ message: "User already exists" }, isExists);
      const result = await userCollections.updateOne(
        filter,
        {
          $set: {
            ...user,
            timesTamp: Date.now(),
          },
        },
        options
      );
      res.send(result);
    });
    // user logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("logout");
      } catch (error) {
        console.log(error);
      }
    });
    // get all rooms
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollections.find().toArray();
      res.send(result);
    });
    // get single room
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollections.findOne(query);
      res.send(result);
    });
    // create a room
    app.post("/room", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await roomsCollections.insertOne(data);
      console.log(result);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Hello World!"));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
