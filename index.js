const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware
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
app.use(express.urlencoded({ extended: true }));

// MongoDB Client
const uri = `mongodb+srv://${process.env.nameOfUser}:${process.env.Password}@registrationfor100yearc.09glv.mongodb.net/?retryWrites=true&w=majority&appName=RegistrationFor100YearCelebration`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Helper to generate short ID
function generateShortId() {
  return crypto.randomBytes(4).toString("hex");
}

// Utility to wrap async functions
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

async function run() {
  try {
    const database = client.db("100_Year_Celebration");
    const userCollection = database.collection("user");
    const Registration = database.collection("participant");

    // CRUD operations
    app.post(
      "/user",
      asyncWrapper(async (req, res) => {
        const data = req.body;
        const user = await userCollection.findOne({ email: data.email });
        if (!user) {
          const result = await userCollection.insertOne(data);
          res.send(result);
        }
      })
    );

    app.get(
      "/user",
      asyncWrapper(async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      })
    );

    app.get(
      "/user/:email",
      asyncWrapper(async (req, res) => {
        const userEmail = req.params.email;
        const result = await userCollection.findOne({ email: userEmail });
        res.send(result);
      })
    );

    app.put(
      "/user/:email",
      asyncWrapper(async (req, res) => {
        const email = req.params.email;
        const data = req.body;
        const result = await userCollection.updateOne(
          { email },
          { $set: data },
          { upsert: false }
        );
        res.send(result);
      })
    );

    app.delete(
      "/user/:id",
      asyncWrapper(async (req, res) => {
        const id = req.params.id;
        const result = await userCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      })
    );
    app.post(
      "/participant",
      asyncWrapper(async (req, res) => {
        const data = req.body;
        const participant = await Registration.findOne({ phone: data.phone });

        data.participantId = generateShortId();
        if (!participant) {
          // Create a new participant
          const result = await Registration.insertOne(data);
          res.send({ ...result, participantId: data.participantId });
        } else {
          res.json({
            status: 500,
            success: false,
            message: `Participant already exists. Search your Registration form using Your name or contact with us`,
          });
        }
      })
    );

    // Get Statistic Data
    app.get("/status-summary", async (req, res) => {
      try {
        const participants = await Registration.find().toArray();

        const summary = {
          totalGuests: participants?.length,
          totalFamilyMembers: participants?.reduce(
            (sum, p) => sum + (p?.family_members || 0),
            0
          ),
          totalChildren: participants.reduce(
            (sum, p) => sum + (p?.children ? Number(p.children) : 0),
            0
          ),
          driversOneDay: participants.filter(
            (p) => p?.driver === "Driver for 1 day"
          ).length,
          driversTwoDays: participants.filter(
            (p) => p?.driver === "Driver for 2 days"
          ).length,
          tshirtSizes: participants.reduce((sizes, p) => {
            sizes[p?.tshirt_size] = (sizes[p?.tshirt_size] || 0) + 1;
            return sizes;
          }, {}),
        };

        res.json(summary);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch status summary" });
      }
    });

    app.get(
      "/participant/:id",
      asyncWrapper(async (req, res) => {
        const id = req.params.id;
        const result = await Registration.findOne({ participantId: id });
        res.send(result);
      })
    );

    app.get(
      "/totalParticipant",
      asyncWrapper(async (req, res) => {
        const count = await Registration.countDocuments();
        res.send({ total: count });
      })
    );

    app.get(
      "/allParticipant",
      asyncWrapper(async (req, res) => {
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 10;
        const result = await Registration.find()
          .sort({ _id: -1 })
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send(result);
      })
    );

    app.put(
      "/participant/:id",
      asyncWrapper(async (req, res) => {
        const participantId = req.params.id;
        const data = req.body;

        try {
          const result = await Registration.updateOne(
            { participantId },
            { $set: data },
            { upsert: false }
          );

          if (result.matchedCount === 0) {
            return res
              .status(404)
              .json({ success: false, message: "Participant not found." });
          }

          if (result.modifiedCount === 0) {
            // Document found but no changes were made
            return res.json({
              success: true,
              message: "Participant data is already up to date.",
            });
          }

          // Data was successfully updated
          res.send(result);
        } catch (error) {
          console.error("Error updating participant:", error);
          res.status(500).json({
            success: false,
            message: "An error occurred while updating the participant.",
          });
        }
      })
    );

    // Get the search from the database
    app.get("/participants/search", async (req, res) => {
      const name_english = req.query.query;
      const results = await Registration.find({
        name_english: { $regex: name_english, $options: "i" },
      }).toArray();
      res.send(results);
    });

    // Get the Data by PaymentID
    app.get("/payment/:paymentID", async (req, res) => {
      const paymentID = req.params.paymentID;
      const result = await Registration.findOne({ paymentID });
      res.send(result);
    });

    // Payment
    app.post("/create-payment", async (req, res) => {
      const data = req.body;
      const initialData = {
        merchantbillno: data?.merchantbillno,
        customername: data?.customername,
        customernumber: data?.customernumber,
        // amount: data?.children
        //   ? 2000 + data?.driverFee + data?.familyFee - data.children * 500
        //   : 2000 + data?.driverFee + data?.familyFee,
        amount: 1,
        invoicedescription: "Participant Registration",
        successURL: "http://localhost:3000/success-payment",
        failureURL: "http://localhost:5173/payment-failed",
        sendsms: "1",
      };

      //
      const result = await Registration.findOne({
        participantId: data?.merchantbillno,
      });
      try {
        const payload = new URLSearchParams(initialData).toString();

        const response = await fetch(
          "https://agamipay.com/merchant/api/invoice/create_invoice.php",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              APIKEY: `${process.env.paymentAPI}`,
            },
            body: payload,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const responseData = await response.json();

        if (responseData.error) {
          res.status(400).send({ message: responseData.message });
        } else {
          const participantData = {
            ...result,
            paymentID: responseData?.paymentID,
            paidAmount: responseData?.data.amount,
          };
          const updateResult = await Registration.updateOne(
            { participantId: data?.merchantbillno },
            { $set: participantData },
            { upsert: false }
          );
          console.log(responseData);

          if (updateResult.modifiedCount > 0)
            res.send({ pay_url: responseData?.pay_url });
        }
      } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Success URL
    app.get("/success-payment", async (req, res) => {
      const query = { paymentID: req?.query?.paymentID };
      const update = { $set: { status: "Paid" } };
      const result = await Registration.updateOne(query, update);
      console.log(result);
      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:5173/payment-success/${req.query.paymentID}`
        );
      }
    });

    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
}
run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Please try again later.",
  });
});

// Handle Uncaught Exceptions and Unhandled Rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
