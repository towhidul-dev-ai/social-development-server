import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;
const CLIENT_URL = process.env.CLIENT_URL;

const client = new MongoClient(process.env.MONGODB_URL);


let db;

// const allowedOrigins = [
//   "http://localhost:3000",
//   "https://social-development-events-platform-nine.vercel.app",
// ];

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin || allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }

//       return callback(new Error("Not allowed by CORS"));
//     },
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// Middleware
app.use(cors());

app.use(express.json());

// MongoDB connection
export async function connectToMongoDB() {
  try {
    // await client.connect();

    db = client.db("social");

    console.log("You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", CLIENT_URL)
);
const verifyApi = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    const token = authHeader.slice(7).trim();

    const { payload } = await jwtVerify(token, JWKS);

    // Check the JWT subject and email
    const userId = payload.sub;
    const userEmail =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

    if (!userId || !userEmail) {
      console.error("JWT payload is missing user information:", {
        sub: payload.sub,
        hasEmail: Boolean(payload.email),
      });

      return res.status(401).json({
        success: false,
        message: "Authenticated user information is missing from the token.",
      });
    }

    req.user = {
      id: userId,
      email: userEmail,
      name: typeof payload.name === "string" ? payload.name : "",
    };

    next();
  } catch (error) {
    console.error("JWT verification error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};
// const verifyApi = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).send({
//         success: false,
//         message: "Authorization token is missing.",
//       });
//     }

//     const token = authHeader.slice(7).trim();

//     if (!token) {
//       return res.status(401).send({
//         success: false,
//         message: "Authorization token is empty.",
//       });
//     }

//     const { payload } = await jwtVerify(token, JWKS);

//     if (!payload.sub || !payload.email) {
//       return res.status(401).send({
//         success: false,
//         message: "Invalid token: user information is missing.",
//       });
//     }

//     req.user = {
//       id: payload.sub,
//       email: payload.email,
//       name: payload.name || "",
//     };

//     next();
//   } catch (error) {
//     console.error("JWT verification failed:", {
//       name: error.name,
//       message: error.message,
//       code: error.code,
//     });

//     return res.status(401).send({
//       success: false,
//       message: "Invalid or expired token.",
//     });
//   }
// };

// export default verifyApi;

// Home API
app.get("/", (req, res) => {
  res.send({
    message: "Server is running fine.",
  });
});


// Start server after MongoDB connection
async function startServer() {
  try {
    await connectToMongoDB();
    
// GET MY EVENTS API (JWT Protected)
app.get("/api/events", verifyApi, async (req, res) => {
  try {
    // Get email from the verified JWT, not from the URL
    const userEmail = req.user?.email?.trim().toLowerCase();

    if (!userEmail) {
      return res.status(401).send({
        success: false,
        message: "Authenticated user information is missing.",
      });
    }

    // Only retrieve events created by the authenticated user
    const events = await db
      .collection("events")
      .find({
        creatorEmail: userEmail,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).send({
      success: true,
      total: events.length,
      events,
    });
  } catch (error) {
    console.error("Get my events error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to retrieve your events.",
    });
  }
});


// GET: All upcoming events
app.get("/api/events/upcoming", async (req, res) => {
  try {
    const events = await db
      .collection("events")
      .find({
        eventDate: { $gt: new Date() },
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).send({
      success: true,
      total: events.length,
      events,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to retrieve upcoming events.",
    });
  }
});


// GET: Event join status and volunteer list
app.get("/api/events/:id/join-status",
  verifyApi,
  async (req, res) => {
 
  try {
    const { id } = req.params;
    const email = req.user.email;
    // const { email } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const eventId = new ObjectId(id);

    // Check whether the event exists
    const event = await db.collection("events").findOne({
      _id: eventId,
    });

    if (!event) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    // Get all volunteers for this event
    const joinedRecords = await db
      .collection("joinedEvents")
      .find({ eventId })
      .sort({ joinedAt: -1 })
      .toArray();

    // Check whether the current user joined
    const isJoined = email
      ? joinedRecords.some(
          (record) => record.userEmail === email
        )
      : false;

    const volunteers = joinedRecords.map((record) => ({
      name: record.userName || record.userEmail,
      image: record.userImage || "",
    }));

    res.status(200).send({
      success: true,
      isJoined,
      volunteerCount: joinedRecords.length,
      volunteers,
    });
  } catch (error) {
    console.error("Get join status error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to retrieve event join status.",
    });
  }
});


// GET: All events joined by the authenticated user
app.get("/api/joined-events", verifyApi, async (req, res) => {
  try {
    // Get email from the verified JWT
    const email = req.user?.email;

    if (!email || typeof email !== "string") {
      return res.status(401).send({
        success: false,
        message: "Authenticated user email not found.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find all joining records for this user
    const joinedRecords = await db
      .collection("joinedEvents")
      .find({ userEmail: normalizedEmail })
      .sort({ joinedAt: -1 })
      .toArray();

    if (joinedRecords.length === 0) {
      return res.status(200).send({
        success: true,
        total: 0,
        events: [],
      });
    }

    // Get event IDs from joining records
    const eventIds = joinedRecords.map((record) => record.eventId);

    // Find corresponding events
    const events = await db
      .collection("events")
      .find({
        _id: { $in: eventIds },
      })
      .toArray();

    // Attach joined date to each event
    const eventsWithJoinDate = events.map((event) => {
      const joinedRecord = joinedRecords.find(
        (record) =>
          record.eventId.toString() === event._id.toString()
      );

      return {
        ...event,
        joinedAt: joinedRecord?.joinedAt || null,
      };
    });

    // Sort by event date: earliest first
    eventsWithJoinDate.sort((a, b) => {
      const dateA = new Date(a.eventDate).getTime();
      const dateB = new Date(b.eventDate).getTime();

      const validA = Number.isNaN(dateA)
        ? Number.POSITIVE_INFINITY
        : dateA;

      const validB = Number.isNaN(dateB)
        ? Number.POSITIVE_INFINITY
        : dateB;

      return validA - validB;
    });

    return res.status(200).send({
      success: true,
      total: eventsWithJoinDate.length,
      events: eventsWithJoinDate,
    });
  } catch (error) {
    console.error("Get joined events error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to retrieve joined events.",
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
// PUT - UPDATE EVENT API
app.put("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.query.email?.toString().trim().toLowerCase();

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

    // Validate user email
    if (!email) {
      return res.status(401).send({
        success: false,
        message: "User email is required.",
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

    // Validate event date
    const parsedDate = new Date(eventDate);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate <= new Date()
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid future event date.",
      });
    }

    // Update only if the event belongs to this user
    const result = await db.collection("events").updateOne(
      {
        _id: new ObjectId(id),
        creatorEmail: email,
      },
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

    // Check whether the user's event exists
    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Event not found or you are not authorized to update it.",
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
// DELETE - Delete Event API
app.delete("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.query.email?.toString().trim().toLowerCase();

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Validate user email
    if (!email) {
      return res.status(401).send({
        success: false,
        message: "User email is required.",
      });
    }

    const eventId = new ObjectId(id);

    // Delete only if the event belongs to this user
    const result = await db.collection("events").deleteOne({
      _id: eventId,
      creatorEmail: email,
    });

    // Check whether the event belongs to this user
    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message:
          "Event not found or you are not authorized to delete it.",
      });
    }

    // Delete related joined event records
    await db.collection("joinedEvents").deleteMany({
      eventId,
    });

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
    const {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
      creatorName,
      creatorEmail,
      creatorImage,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !description?.trim() ||
      !eventType?.trim() ||
      !thumbnail?.trim() ||
      !location?.trim() ||
      !eventDate
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required event fields.",
      });
    }

    // Validate organizer information
    if (
      !creatorName?.trim() ||
      !creatorEmail?.trim()
    ) {
      return res.status(400).send({
        success: false,
        message: "Organizer information is missing.",
      });
    }

    // Validate thumbnail URL
    let thumbnailUrl;

    try {
      thumbnailUrl = new URL(thumbnail.trim());

      if (!["http:", "https:"].includes(thumbnailUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid thumbnail image URL.",
      });
    }

    // Validate event date
    const parsedDate = new Date(eventDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid event date.",
      });
    }

    if (parsedDate.getTime() <= Date.now()) {
      return res.status(400).send({
        success: false,
        message: "Event date must be in the future.",
      });
    }

    // Create event document
    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnailUrl.toString(),
      location: location.trim(),

      eventDate: parsedDate,
      creatorName: creatorName.trim(),
      creatorEmail: creatorEmail.trim(),
      creatorImage: creatorImage || "",

      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db
      .collection("events")
      .insertOne(newEvent);

    return res.status(201).send({
      success: true,
      message: "Event created successfully!",
      eventId: result.insertedId,
      event: {
        ...newEvent,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to create event.",
    });
  }
});


// POST: Join an event

// POST: Join an event
app.post("/api/events/:id/join", verifyApi, async (req, res) => {
  try {
    const { id } = req.params;

    // Get authenticated user from JWT
    const userEmail = req.user.email?.trim().toLowerCase();
    const userName = req.user.name || userEmail;

    if (!userEmail) {
      return res.status(401).send({
        success: false,
        message: "Authenticated user information is missing.",
      });
    }

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const eventId = new ObjectId(id);

    // Check whether event exists
    const event = await db.collection("events").findOne({
      _id: eventId,
    });

    if (!event) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    // Check event date
    if (new Date(event.eventDate) <= new Date()) {
      return res.status(400).send({
        success: false,
        message: "This event has already started or passed.",
      });
    }

    // Check existing registration
    const existingJoin = await db.collection("joinedEvents").findOne({
      eventId,
      userEmail,
    });

    if (existingJoin) {
      return res.status(409).send({
        success: false,
        message: "You have already joined this event.",
      });
    }

    // Save joining information
    const joinData = {
      eventId,
      userEmail,
      userName,
      userImage: "",
      joinedAt: new Date(),
    };

    await db.collection("joinedEvents").insertOne(joinData);

    return res.status(201).send({
      success: true,
      message: "Successfully joined the event.",
    });

  } catch (error) {
    console.error("Join event error:", error);

    return res.status(500).send({
      success: false,
      message: "Failed to join event.",
    });
  }
});

// POST - Create Event API (JWT Protected)
app.post("/api/events", verifyApi, async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate,
      creatorName,
      creatorImage,
    } = req.body;

    // Organizer identity comes from verified JWT
    const creatorId = req.user.id;
    const creatorEmail = req.user.email;

    if (!creatorId || !creatorEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user information is missing.",
      });
    }

    if (
      !title?.trim() ||
      !description?.trim() ||
      !eventType?.trim() ||
      !thumbnail?.trim() ||
      !location?.trim() ||
      !eventDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required event fields.",
      });
    }

    let thumbnailUrl;

    try {
      thumbnailUrl = new URL(thumbnail.trim());

      if (!["http:", "https:"].includes(thumbnailUrl.protocol)) {
        throw new Error("Invalid URL protocol");
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid thumbnail URL.",
      });
    }

    const parsedDate = new Date(eventDate);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future.",
      });
    }

    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnailUrl.toString(),
      location: location.trim(),
      eventDate: parsedDate,

      creatorId,
      creatorName:
        creatorName?.trim() || req.user.name || "Community Member",
      creatorEmail,
      creatorImage: creatorImage || "",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("events").insertOne(newEvent);

    return res.status(201).json({
      success: true,
      message: "Event created successfully!",
      eventId: result.insertedId,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create event.",
    });
  }
});

// DELETE: Leave an event
// app.delete("/api/events/:id/join", verifyApi, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userEmail = req.user.email?.trim().toLowerCase();

//     if (!ObjectId.isValid(id)) {
//       return res.status(400).send({
//         success: false,
//         message: "Invalid event ID.",
//       });
//     }

//     if (!userEmail) {
//       return res.status(401).send({
//         success: false,
//         message: "Authenticated user email is missing.",
//       });
//     }

//     const eventId = new ObjectId(id);

//     const result = await db.collection("joinedEvents").deleteOne({
//       eventId,
//       userEmail,
//     });

//     if (result.deletedCount === 0) {
//       return res.status(404).send({
//         success: false,
//         message: "You have not joined this event.",
//       });
//     }

//     return res.status(200).send({
//       success: true,
//       message: "You have left the event successfully.",
//     });
//   } catch (error) {
//     console.error("Leave event error:", error);

//     return res.status(500).send({
//       success: false,
//       message: "Failed to leave event.",
//     });
//   }
// });


// POST: Join an event
app.post("/api/events/:id/join", verifyApi, async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, userName, userImage } = req.body;

    // Validate event ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Validate user information
    if (!userEmail) {
      return res.status(400).send({
        success: false,
        message: "User email is required.",
      });
    }

    const eventId = new ObjectId(id);

    // Check whether event exists
    const event = await db.collection("events").findOne({
      _id: eventId,
    });

    if (!event) {
      return res.status(404).send({
        success: false,
        message: "Event not found.",
      });
    }

    // Prevent joining an event that has already passed
    if (new Date(event.eventDate) <= new Date()) {
      return res.status(400).send({
        success: false,
        message: "This event has already started or passed.",
      });
    }

    // Check whether user already joined
    const existingJoin = await db.collection("joinedEvents").findOne({
      eventId,
      userEmail,
    });

    if (existingJoin) {
      return res.status(409).send({
        success: false,
        message: "You have already joined this event.",
      });
    }

    // Save joining information
    const joinData = {
      eventId,
      userEmail,
      userName: userName || userEmail,
      userImage: userImage || "",
      joinedAt: new Date(),
    };

    await db.collection("joinedEvents").insertOne(joinData);

    return res.status(201).send({
      success: true,
      message: "Successfully joined the event.",
    });
  } catch (error) {
    console.error("Join event error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to join event.",
    });
  }
});

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    process.exit(1);
  }
}

startServer();

export default app;



// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { MongoClient, ObjectId } from "mongodb";
// import { createRemoteJWKSet, jwtVerify } from "jose";

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 8000;
// const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// // Middleware
// app.use(
//   cors({
//     origin: CLIENT_URL,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(express.json());

// // MongoDB
// const client = new MongoClient(process.env.MONGODB_URL);
// let db;
// let dbPromise;

// async function connectToMongoDB() {
//   if (db) return db;

//   if (!dbPromise) {
//     dbPromise = client
//       .connect()
//       .then(() => {
//         db = client.db("social");
//         console.log("MongoDB connected successfully");
//         return db;
//       })
//       .catch((error) => {
//         dbPromise = null;
//         console.error("MongoDB connection error:", error);
//         throw error;
//       });
//   }

//   return dbPromise;
// }

// // Connect to MongoDB before handling API requests
// app.use(async (req, res, next) => {
//   try {
//     await connectToMongoDB();
//     next();
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Database connection failed",
//     });
//   }
// });

// // Better Auth JWT verification
// const JWKS = createRemoteJWKSet(
//   new URL("/api/auth/jwks", CLIENT_URL)
// );

// async function verifyApi(req, res, next) {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader?.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization token missing",
//       });
//     }

//     const token = authHeader.split(" ")[1];
//     const { payload } = await jwtVerify(token, JWKS);

//     if (!payload.sub || !payload.email) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token: user information missing",
//       });
//     }

//     req.user = {
//       id: payload.sub,
//       email: payload.email,
//       name: payload.name || "",
//       image: payload.image || "",
//     };

//     next();
//   } catch (error) {
//     console.error("JWT verification error:", error);

//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired token",
//     });
//   }
// }

// // Health check
// app.get("/", (req, res) => {
//   res.send("GoodGather API is running");
// });

// // Get six upcoming events (public)
// app.get("/api/events/upcoming", async (req, res) => {
//   try {
//     const today = new Date().toISOString().split("T")[0];

//     const events = await db
//       .collection("events")
//       .find({ eventDate: { $gt: today } })
//       .sort({ eventDate: 1 })
//       .limit(6)
//       .toArray();

//     res.json({ success: true, events });
//   } catch (error) {
//     console.error("Upcoming events error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve upcoming events",
//     });
//   }
// });

// // Get events created by logged-in user
// app.get("/api/events", verifyApi, async (req, res) => {
//   try {
//     const events = await db
//       .collection("events")
//       .find({ creatorEmail: req.user.email })
//       .sort({ createdAt: -1 })
//       .toArray();

//     res.json({ success: true, events });
//   } catch (error) {
//     console.error("Get events error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve events",
//     });
//   }
// });

// // Get one event
// app.get("/api/events/:id", async (req, res) => {
//   try {
//     if (!ObjectId.isValid(req.params.id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid event ID",
//       });
//     }

//     const event = await db.collection("events").findOne({
//       _id: new ObjectId(req.params.id),
//     });

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found",
//       });
//     }

//     res.json({ success: true, event });
//   } catch (error) {
//     console.error("Get event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve event",
//     });
//   }
// });

// // Create event (authenticated)
// app.post("/api/events", verifyApi, async (req, res) => {
//   try {
//     const {
//       title,
//       description,
//       eventType,
//       thumbnail,
//       location,
//       eventDate,
//     } = req.body;

//     if (
//       !title ||
//       !description ||
//       !eventType ||
//       !thumbnail ||
//       !location ||
//       !eventDate
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide all required fields",
//       });
//     }

//     const parsedDate = new Date(eventDate);

//     if (
//       Number.isNaN(parsedDate.getTime()) ||
//       parsedDate <= new Date()
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Event date must be in the future",
//       });
//     }

//     const newEvent = {
//       title,
//       description,
//       eventType,
//       thumbnail,
//       location,
//       eventDate,
//       creatorId: req.user.id,
//       creatorEmail: req.user.email,
//       creatorName: req.user.name,
//       creatorImage: req.user.image,
//       createdAt: new Date(),
//     };

//     const result = await db.collection("events").insertOne(newEvent);

//     res.status(201).json({
//       success: true,
//       message: "Event created successfully",
//       eventId: result.insertedId,
//     });
//   } catch (error) {
//     console.error("Create event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create event",
//     });
//   }
// });

// // Join event
// app.post("/api/events/:id/join", verifyApi, async (req, res) => {
//   try {
//     const eventId = req.params.id;

//     if (!ObjectId.isValid(eventId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid event ID",
//       });
//     }

//     const event = await db.collection("events").findOne({
//       _id: new ObjectId(eventId),
//     });

//     if (!event) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found",
//       });
//     }

//     const joinedEvents = db.collection("joinedEvents");

//     const existing = await joinedEvents.findOne({
//       eventId,
//       userId: req.user.id,
//     });

//     if (existing) {
//       return res.status(409).json({
//         success: false,
//         message: "You already joined this event",
//       });
//     }

//     await joinedEvents.insertOne({
//       eventId,
//       userId: req.user.id,
//       userEmail: req.user.email,
//       userName: req.user.name,
//       userImage: req.user.image,
//       eventTitle: event.title,
//       eventDate: event.eventDate,
//       joinedAt: new Date(),
//     });

//     res.status(201).json({
//       success: true,
//       message: "Joined event successfully",
//     });
//   } catch (error) {
//     console.error("Join event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to join event",
//     });
//   }
// });

// // Leave event
// app.delete("/api/events/:id/join", verifyApi, async (req, res) => {
//   try {
//     const result = await db.collection("joinedEvents").deleteOne({
//       eventId: req.params.id,
//       userId: req.user.id,
//     });

//     if (!result.deletedCount) {
//       return res.status(404).json({
//         success: false,
//         message: "You have not joined this event",
//       });
//     }

//     res.json({
//       success: true,
//       message: "You left the event successfully",
//     });
//   } catch (error) {
//     console.error("Leave event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to leave event",
//     });
//   }
// });

// // Check whether user joined event
// app.get("/api/events/:id/join-status", verifyApi, async (req, res) => {
//   try {
//     const joined = await db.collection("joinedEvents").findOne({
//       eventId: req.params.id,
//       userId: req.user.id,
//     });

//     res.json({
//       success: true,
//       isJoined: Boolean(joined),
//     });
//   } catch (error) {
//     console.error("Join status error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to check join status",
//     });
//   }
// });

// // Get logged-in user's joined events
// app.get("/api/joined-events", verifyApi, async (req, res) => {
//   try {
//     const events = await db
//       .collection("joinedEvents")
//       .find({ userId: req.user.id })
//       .sort({ eventDate: 1 })
//       .toArray();

//     res.json({ success: true, events });
//   } catch (error) {
//     console.error("Joined events error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve joined events",
//     });
//   }
// });

// // Update event (owner only)
// app.put("/api/events/:id", verifyApi, async (req, res) => {
//   try {
//     if (!ObjectId.isValid(req.params.id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid event ID",
//       });
//     }

//     const {
//       title,
//       description,
//       eventType,
//       thumbnail,
//       location,
//       eventDate,
//     } = req.body;

//     const result = await db.collection("events").updateOne(
//       {
//         _id: new ObjectId(req.params.id),
//         creatorEmail: req.user.email,
//       },
//       {
//         $set: {
//           title,
//           description,
//           eventType,
//           thumbnail,
//           location,
//           eventDate,
//           updatedAt: new Date(),
//         },
//       }
//     );

//     if (!result.matchedCount) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found or you are not the owner",
//       });
//     }

//     res.json({
//       success: true,
//       message: "Event updated successfully",
//     });
//   } catch (error) {
//     console.error("Update event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to update event",
//     });
//   }
// });

// // Delete event (owner only)
// app.delete("/api/events/:id", verifyApi, async (req, res) => {
//   try {
//     if (!ObjectId.isValid(req.params.id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid event ID",
//       });
//     }

//     const result = await db.collection("events").deleteOne({
//       _id: new ObjectId(req.params.id),
//       creatorEmail: req.user.email,
//     });

//     if (!result.deletedCount) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found or you are not the owner",
//       });
//     }

//     await db.collection("joinedEvents").deleteMany({
//       eventId: req.params.id,
//     });

//     res.json({
//       success: true,
//       message: "Event deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete event error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete event",
//     });
//   }
// });

// // Start local Express server
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

