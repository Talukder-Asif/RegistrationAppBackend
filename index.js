const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
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

    // create a new Registration
    // Create a new Registration
    app.post(
      "/participant",
      asyncWrapper(async (req, res) => {
        const data = req.body;

        // Sanitize the phone number
        const cleanPhone = data?.phone?.replace(/[\s\-()]/g, "");
        data.phone = cleanPhone;

        // Check for existing participant by phone
        const participant = await Registration.findOne({ phone: cleanPhone });
        if (participant) {
          return res.json({
            status: 500,
            success: false,
            message: `Participant already exists. Here is your <a href="https://registration.exstudentsforum-brghs.com/preview/${participant.participantId}">Registration</a>`,
          });
        }

        // Generate a unique participantId
        let newID;
        while (true) {
          newID = generateShortId(); // Generate a new ID
          const isIdAvailable = await Registration.findOne({
            participantId: newID,
          });
          if (!isIdAvailable) break; // Exit loop if ID is unique
        }

        // Assign the unique participantId
        data.participantId = newID;

        // Insert the participant into the database
        const result = await Registration.insertOne(data);
        res.send({ ...result, participantId: data.participantId });
      })
    );

    app.put(
      "/update/participant/:participantId",
      asyncWrapper(async (req, res) => {
        const participantId = req.params.participantId;
        const data = { ...req.body };
        const result = await Registration.updateOne(
          { participantId },
          { $set: data },
          { upsert: false }
        );
        res.send(result);
      })
    );

    // Get Statistic Data
    app.get("/status-summary", async (req, res) => {
      try {
        const formFillUp = await Registration.countDocuments();
        const participants = await Registration.find({
          status: "Paid",
        }).toArray();

        const summary = {
          formFillUp,
          totalPaidGuests: participants?.length,
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
            const sizeKey = p?.tshirt_size?.replace(/^(\d)/, "_$1");
            sizes[sizeKey] = (sizes[sizeKey] || 0) + 1;
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

    app.delete(
      "/delete-participant/:id",
      asyncWrapper(async (req, res) => {
        const id = req.params.id;
        const result = await Registration.deleteOne({
          _id: new ObjectId(id),
        });
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

    // Get All SSC Years
    app.get("/allSscYears", async (req, res) => {
      try {
        const sscYears = await Registration.find(
          {},
          { projection: { ssc_year: 1, _id: 0 } }
        ).toArray();
        const uniqueYears = [
          ...new Set(sscYears.map((entry) => entry.ssc_year)),
        ].sort(); // Sort in ascending order
        res.send(uniqueYears);
      } catch (error) {
        console.error("Error retrieving SSC years:", error);
        res.status(500).send({ error: "Failed to retrieve SSC years" });
      }
    });
    // Get Paid SSC Years
    app.get("/allSscYears/paid", async (req, res) => {
      try {
        const sscYears = await Registration.aggregate([
          { $match: { status: "Paid" } },
          { $group: { _id: "$ssc_year", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]).toArray();

        res.send(sscYears);
      } catch (error) {
        console.error("Error retrieving SSC years:", error);
        res.status(500).send({ error: "Failed to retrieve SSC years" });
      }
    });
    // Get unpaid SSC Years
    app.get("/allSscYears/unpaid", async (req, res) => {
      try {
        const sscYears = await Registration.aggregate([
          { $match: { status: "Unpaid" } },
          { $group: { _id: "$ssc_year", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]).toArray();

        res.send(sscYears);
      } catch (error) {
        console.error("Error retrieving SSC years:", error);
        res.status(500).send({ error: "Failed to retrieve SSC years" });
      }
    });

    // Get Filtered Participant
    app.get("/filtered/registration", async (req, res) => {
      const status = req?.query?.status;
      const sscYear = req?.query?.targetBatch;
      const result = await Registration.find({
        status: status,
        ssc_year: sscYear,
      }).toArray();
      const summary = {
        result,
        tshirtSizes: result.reduce((sizes, p) => {
          const sizeKey = p?.tshirt_size?.replace(/^(\d)/, "_$1");
          sizes[sizeKey] = (sizes[sizeKey] || 0) + 1;
          return sizes;
        }, {}),
      };

      res.send(summary);
    });

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
        successURL:
          "https://api.registration.exstudentsforum-brghs.com/success-payment",
        failureURL:
          "https://registration.exstudentsforum-brghs.com/payment-failed",
        sendsms: "1",
      };

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

        if (!response?.ok) {
          throw new Error(`HTTP error! Status: ${response?.status}`);
        }

        const responseData = await response?.json();

        if (responseData?.error) {
          res.status(400).send({ message: responseData.message });
        } else {
          const updateResult = await Registration.updateOne(
            { participantId: data?.merchantbillno },
            {
              $set: {
                paymentID: responseData?.paymentID,
                paidAmount: responseData?.data.amount,
              },
            },
            { upsert: false }
          );

          if (updateResult?.modifiedCount > 0)
            res.send({ pay_url: responseData?.pay_url });
        }
      } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Success URL
    app.get("/success-payment", async (req, res) => {
      console.log(req);
      const query = { paymentID: req?.query?.paymentID };
      const update = { $set: { status: "Paid" } };
      const result = await Registration.updateOne(query, update);
      console.log(result);
      if (result.modifiedCount > 0) {
        res.redirect(
          `https://registration.exstudentsforum-brghs.com/payment-success/${req?.query?.paymentID}`
        );
      }
    });

    // ImageUpload
    const uploadDir = path.join(__dirname, "public/Images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create folder if it doesn't exist
    }

    // Serve static files from the 'public' directory
    app.use("/public", express.static(path.join(__dirname, "public")));

    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, uploadDir); // Save files to 'public/Images'
      },
      filename: function (req, file, cb) {
        cb(null, `${Date.now()}_${file.originalname}`); // Unique filename
      },
    });

    const upload = multer({ storage });

    app.post("/upload", upload.single("file"), (req, res) => {
      const fileUrl = `${req.protocol}://${req.get("host")}/public/Images/${
        req.file.filename
      }`;
      console.log("Body:", req.body);
      console.log("File:", req.file);
      res.send({
        message: "File uploaded successfully",
        file: req.file,
        url: fileUrl, // Return the file URL
      });
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
