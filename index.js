const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
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
          studentID: data.studentID,
          accountType: data.accountType,
          department: data.department,
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
      const participant = await findParticipant(data);
      if (!participant) {
        const result = await Registration.insertOne(data);
        res.send(result);
      } else {
        res?.send("500");
      }
    });

    // get voter
    app.get("/voter", async (req, res) => {
      const result = await voterCollection
        .find()
        .sort({ studentID: 1 })
        .toArray();
      res.send(result);
    });

    // get voter
    app.get("/voter/:department", async (req, res) => {
      const { department } = req.params;

      const result = await voterCollection
        .find({
          department: department,
        })
        .sort({ studentID: 1 })
        .toArray();
      res.send(result);
    });

    //
    //
    //
    //
    //
    //

    // Delete all voters whose department matches the parameter
    app.delete("/voters/:department/:batch", async (req, res) => {
      try {
        const { department, batch } = req.params;

        const result = await voterCollection.deleteMany({
          department: department,
          batch: batch, // Assuming batch is a field in your voter document
        });

        res.status(200).send({
          message: `All voters from ${department} department and ${batch} batch deleted successfully`,
          result,
        });
      } catch (error) {
        res.status(500).send({
          message: `Error deleting voters from ${department} department and ${batch} batch`,
          error,
        });
      }
    });

    await client.db("admin").command({ ping: 1 });
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
