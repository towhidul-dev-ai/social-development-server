// import express from 'express';
// import { MongoClient } from 'mongodb';
// import 'dotenv/config'

// const app = express()
// const PORT = 8000

// const client = new MongoClient(process.env.MONGODB_URL);

// export async function connectToMongoDB() {
//   try {
//     await client.connect();
//     console.log("You successfully connected to MongoDB!");
//     return client;
//   } catch (err) {
//     console.dir(err);
//   }
// }

// connectToMongoDB();
// // http:// localhost:8000

// app.get('/', (req, res)=>{
//     res.send({message: 'server is running fine.'})
// })



// app.listen(PORT,()=>{
//     console.log(`Server is running at ${PORT}`)
// })


import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 8000;

const client = new MongoClient(process.env.MONGODB_URL);

let db;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
}));

app.use(express.json());

// MongoDB connection
export async function connectToMongoDB() {
  try {
    await client.connect();

    db = client.db("social");

    console.log("You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

// Home API
app.get("/", (req, res) => {
  res.send({
    message: "Server is running fine.",
  });
});

// GET ALL EVENTS API
app.get("/api/events", async (req, res) => {
  try {
    const events = await db
      .collection("events")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).send({
      success: true,
      total: events.length,
      events,
    });

  } catch (error) {
    console.error("Get events error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to retrieve events.",
    });
  }
});

// Start server after MongoDB connection
async function startServer() {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    process.exit(1);
  }
}

startServer();
