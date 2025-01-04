const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const crypto = require("crypto");

function generateShortId() {
  return crypto.randomBytes(4).toString("hex");
}
// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      "https://registration.exstudentsforum-brghs.com",
      "https://www.registration.exstudentsforum-brghs.com",
      "https://api.registration.exstudentsforum-brghs.com",
      "https://www.api.registration.exstudentsforum-brghs.com",
    ],
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.nameOfUser}:${process.env.Password}@registrationfor100yearc.09glv.mongodb.net/?retryWrites=true&w=majority&appName=RegistrationFor100YearCelebration`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const database = client.db("100_Year_Celebration");
    const userCollection = database.collection("user");
    const Registration = database.collection("participant");

    // CRUD
    const findUser = (email) => {
      return userCollection.findOne({ email: email });
    };

    app.post("/user", async (req, res) => {
      const data = req.body;
      const user = await findUser(data.email);
      if (!user) {
        const result = await userCollection.insertOne(data);
        res.send(result);
      }
    });

    // get User information
    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get single User information
    app.get("/user/:email", async (req, res) => {
      const userEmail = req.params.email;
      const quary = { email: userEmail };
      const result = await userCollection.findOne(quary);
      res.send(result);
    });

    // update User information
    app.put("/user/:email", async (req, res) => {
      const Uemail = req.params.email;
      const data = req.body;
      const filter = { email: Uemail };
      const options = { upsert: true };
      const updateTeam = {
        $set: {
          name: data.name,
          photoURL: data.photoURL,
          role: data.role,
          batch: data.batch,
          phone: data.phone,
        },
      };
      try {
        const result = await userCollection.updateOne(
          filter,
          updateTeam,
          options
        );
        res.send(result);
      } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).send("Error updating user");
      }
    });

    // Delete User information
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // CRUD for participantData
    const findParticipant = (data) => {
      return Registration.findOne({ phone: data.phone });
    };
    app.post("/participant", async (req, res) => {
      const data = req.body;
      data.participantId = generateShortId();
      const participant = await findParticipant(data);
      if (!participant) {
        const result = await Registration.insertOne(data);
        res.send({ ...result, participantId: data.participantId });
      } else {
        res.json({
          success: false,
          message: "Participant already exists, Try another phone number",
          status: 500,
        });
      }
    });
    // get single participantData
    app.get("/participant/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { participantId: id };
      const result = await Registration.findOne(quary);
      res.send(result);
    });

    // get the total number of participantData
    app.get("/totalPC", async (req, res) => {
      const count = await Registration.find().toArray();
      res.send(count);
    });

    // Get Contest data from the database for common users
    app.get("/allParticipant", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);

      const result = await Registration.find()
        .sort({ _id: -1 })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    //
    //
    //
    //
    //
    //

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
