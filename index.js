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
import { MongoClient, ObjectId } from "mongodb";
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


// GET SINGLE EVENT API
app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const event = await db.collection("events").findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    res.status(200).send({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Get single event error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to retrieve event.",
    });
  }
});


// PUT - Update Event API
app.put("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
    } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Validate required fields
    if (
      !title?.trim() ||
      !description?.trim() ||
      !eventType?.trim() ||
      !location?.trim() ||
      !eventDate
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    // Validate date
    const parsedDate = new Date(eventDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid event date.",
      });
    }

    // Update event
    const result = await db.collection("events").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title: title.trim(),
          description: description.trim(),
          eventType: eventType.trim(),
          thumbnail: thumbnail?.trim() || "",
          location: location.trim(),
          eventDate: parsedDate,
          updatedAt: new Date(),
        },
      }
    );

    // Check whether event exists
    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    res.status(200).send({
      success: true,
      message: "Event updated successfully!",
    });
  } catch (error) {
    console.error("Update event error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update event.",
    });
  }
});


// DELETE - Delete Event API
app.delete("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Delete event
    const result = await db.collection("events").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    res.status(200).send({
      success: true,
      message: "Event deleted successfully!",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to delete event.",
    });
  }
});


// POST - Create Event API
app.post("/api/events", async (req, res) => {
  try {
    const { title, description, eventType, thumbnail, location, eventDate } =
      req.body;

    if (!title || !description || !eventType || !location || !eventDate) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    const newEvent = {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate: new Date(eventDate),
      createdAt: new Date(),
    };

    const result = await db.collection("events").insertOne(newEvent);

    res.status(201).send({
      success: true,
      message: "Event created successfully!",
      eventId: result.insertedId,
    });
  } catch (error) {
    console.error("Create event error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create event.",
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
