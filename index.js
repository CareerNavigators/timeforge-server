require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongo = require("mongoose");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);
const {
  User,
  Meeting,
  Attendee,
  Note,
  Ecommerce,
  Cart,
  Order,
} = require("./schema");
const {
  logger,
  checkBody,
  emptyBodyChecker,
  emptyQueryChecker,
} = require("./middleware");
const {
  erroResponse,
  UpdateHelper,
  DeleteUser,
  ProfileImageSizeCutter,
} = require("./util");
const app = express();
const port = process.env.PORT || 5111;
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`;
mongo.connect(uri);
const config = {
  service: "gmail",
  auth: {
    user: process.env.MAIL,
    pass: process.env.PASS,
  },
};
const mailTransporter = nodemailer.createTransport(config);
// firebase admin keys
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
async function run() {
  try {
    /**
     * To create a new user, send a POST request to "/user" endpoint.
     * This will add the user to the database.
     *
     * Request Body (JSON):
     * {
     *     "name": "user name", // required
     *     "email": "user email", // required
     *     "img_profile": "profile picture of user" // optional
     * }
     *
     * Response:
     * If the user already exists, it will return user data with status code 200.
     * If the user is created successfully, it will return user data with status code 201.
     * If an error occurs, the response will contain an error message in the 'msg' key.
     */
    app.post(
      "/user",
      logger,
      emptyBodyChecker,
      checkBody(["name", "email"]),
      async (req, res) => {
        let t_user = await User.isUserExist(req.body.email);
        if (req.body?.img_profile) {
          req.body.img_profile = ProfileImageSizeCutter(req.body.img_profile);
        }
        if (t_user == null) {
          const user = new User(req.body);
          try {
            let result = await user.save();
            res.status(201).send(result);
          } catch (e) {
            erroResponse(res, e);
          }
        } else {
          res.status(200).send(t_user);
        }
      }
    );
    /**
     * To update user information, send a PATCH request to "/user/:id" endpoint.
     * ":id" should be replaced with the user id from the database.
     *
     * Request Body (JSON):
     * {
     *     "name": "user name",
     *     "email": "user email",
     *     "img_cover": "cover photo url",
     *     "country": "country",
     *     "timeZone": "timeZone",
     *     "img_profile": "profile photo url"
     * }
     *
     * Response:
     * 500 - Internal Server Error
     * 400 - Update failed
     * 202 - Update Successful. Returns the updated element.
     */

    app.patch("/user/:id", logger, emptyBodyChecker, async (req, res) => {
      try {
        let user = await User.findById(req.params.id);
        if (user != null) {
          UpdateHelper(user, req.body, res);
        } else {
          res.status(404).send({ msg: "User not found" });
        }
      } catch (e) {
        erroResponse(res, e);
      }
    });
    /**
     * Get single user by email or id.
     * req.query:
     * {
     *  email: user email
     * }
     * or
     * {
     *  id: user id
     * }
     * res:
     * 200 - user data.
     * 404 - notfound
     * 400 - if query does not contain email or id
     */
    app.get("/user", logger, emptyQueryChecker, async (req, res) => {
      let query = req.query;
      if (query?.email) {
        User.findOne({ email: query.email })
          .then((result) => {
            if (result != null) {
              res.status(200).send(result);
            } else {
              res.status(404).send({ msg: "User not found" });
            }
          })
          .catch((e) => {
            erroResponse(res, e);
          });
      } else if (query?.id) {
        User.findOne({ _id: query.id })
          .then((result) => {
            if (result != null) {
              res.status(200).send(result);
            } else {
              res.status(404).send({ msg: "User not found" });
            }
          })
          .catch((e) => {
            erroResponse(res, e);
          });
      } else {
        res.status(400).send({ msg: "Query invalid" });
      }
    });
    /**
     * Delete user
     *
     * req.params:
     *   email: Email address of the user to be deleted
     *
     * res.send:
     * *  200 - User deleted successfully
     * !  400 - Invalid email address
     * ?  404 - User not found
     * !  500 - Internal server error
     */
    app.delete("/user/:email", async (req, res) => {
      const userEmail = req.params.email;
      try {
        const userDataDB = await User.findOne({ email: userEmail }).lean();
        const id = userDataDB?._id?.toString();
        const userData = await admin.auth().getUserByEmail(userEmail);
        if (!userData || !userData.uid || !id) {
          return res.status(404).send("User data not found.");
        }
        const result = await DeleteUser(id);
        if (!result?.error) {
          await admin.auth().deleteUser(userData.uid);
          console.log(`deleted user with email: ${userEmail}`);
          res
            .status(200)
            .send(
              `User with email ${userEmail} has been successfully deleted.`
            );
        } else {
          res.status(400).send(result);
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        if (error.code === "auth/invalid-email") {
          res.status(400).send({ error: "Invalid email address." });
        } else if (error.code === "auth/user-not-found") {
          res.status(404).send({ error: "User not found." });
        } else if (error.code === "auth/invalid-uid") {
          res.status(400).send({ error: "Invalid user ID." });
        } else {
          res.status(500).send({ error: "Error deleting user." });
        }
      }
    });

    /**
     * create event
     * req.body sample:
     * {
     *  "title":"Event 2",
     * "duration":"1h",
     * "createdBy":"65afa0d20cd675ad26b7669a",
     * "events":{"200524":["9:30PM","9:00AM"],"210524":["10:00AM","11:00PM","11:30PM"]},
     *  "eventType":"Meeting",
     * "desc":"Hi how are you everyone?" - optional
     * }
     * res.send:
     * 201 - event created. and return created event
     * 400 - failed to create
     */
    app.post(
      "/meeting",
      logger,
      emptyBodyChecker,
      checkBody([
        "title",
        "duration",
        "createdBy",
        "events",
        "eventType",
        "camera",
        "mic",
        "offline",
        "startTime",
        "endTime",
        ,
      ]),
      async (req, res) => {
        let expTime;
        if (Object.keys(req.body.events).length != 0) {
          let dateKeys = Object.keys(req.body.events);
          expTime = dayjs(dateKeys[0], "DDMMYY");
          if (Object.keys(req.body.events).length != 0) {
            let dateKeys = Object.keys(req.body.events);
            expTime = dayjs(dateKeys[0], "DDMMYY");
            for (const event of dateKeys) {
              let t_expTime = dayjs(event, "DDMMYY");
              if (t_expTime.isAfter(expTime)) {
                expTime = t_expTime;
              }
            }
            req.body["expDate"] = expTime.format("DD-MM-YYYY");
          }
          const meeting = new Meeting(req.body);
          meeting
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              res
                .status(400)
                .send({ msg: `Meeting Creation Failed.${e.message}` });
            });
        }
      }
    );
    /**
     * get all meeting or single meeting
     * req.query:{id:user id,type:all},{id:meeting id,type:single}
     * res.send:
     * 200 - meetings or meeting
     * 404 - not found event
     */

    app.get("/meeting", logger, emptyQueryChecker, async (req, res) => {
      try {
        if (req.query.type == "all") {
          Meeting.where("createdBy")
            .equals(req.query.id)
            .select("-createdBy -desc -events -__v   ")
            .then((result) => {
              if (result.length != 0) {
                res.status(200).send(result);
              } else {
                res.send({ msg: "No meetings found." });
              }
            });
        } else if ((req.query.type = "single")) {
          Meeting.findById(req.query.id)
            .then((result) => {
              res.status(200).send(result);
            })
            .catch((e) => {
              res.status(404).send({ msg: "Meeting not found." });
            });
        } else {
          res.status(400).send({ msg: "Expected query failed." });
        }
      } catch (e) {
        erroResponse(res, e);
      }
    });

    app.patch("/meeting/:id", logger, emptyBodyChecker, async (req, res) => {
      try {
        let meeting = await Meeting.findById(req.params.id);
        if (meeting != null) {
          UpdateHelper(meeting, req.body, res);
        } else {
          res.status(400).send({ msg: "meeting not found" });
        }
      } catch (error) {
        erroResponse(res, error);
      }
    });

    app.delete("/meeting/:id", logger, async (req, res) => {
      try {
        Meeting.findByIdAndDelete(req.params.id)
          .then((result) => {
            res.status(200).send(result);
          })
          .catch((e) => {
            res.status(400).send({ msg: e.message });
          });
      } catch (error) {
        console.log(error);
        erroResponse(res, error);
      }
    });

    //timeline API
    app.get("/timeline", logger, emptyQueryChecker, async (req, res) => {
      try {
        if (req.query.type == "all") {
          Timeline.where("createdBy")
            .equals(req.query.id)
            .populate("event", "title desc events")
            .then((result) => {
              if (result.length != 0) {
                res.status(200).send(result);
              } else {
                res.send({ msg: "No timeline found." });
              }
            });
        } else if ((req.query.type = "single")) {
          Timeline.findById(req.query.id)
            .select("event createdBy timeline")
            .populate("event", "startTime endTime")
            .then((result) => {
              res.status(200).send(result);
            })
            .catch((e) => {
              console.log(e.message);
              res.status(404).send({ msg: "Timeline not found." });
            });
        } else {
          res.status(400).send({ msg: "Expected query failed." });
        }
      } catch (e) {
        erroResponse(res, e);
      }
    });

    app.post(
      "/timeline",
      logger,
      emptyBodyChecker,
      checkBody(["meeting", "createdBy", "title"]),
      async (req, res) => {
        try {
          const newTimeline = new Timeline(req.body);
          newTimeline
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              erroResponse(res, e);
            });
        } catch (e) {
          erroResponse(res, e);
        }
      }
    );

    app.patch(
      "/timeline/:id",
      logger,
      emptyQueryChecker,
      emptyBodyChecker,
      async (req, res) => {
        try {
          const singleTimeline = await Timeline.findById(req.params.id);
          if (req.query?.type == "add") {
            singleTimeline.timeline.push(req.body);
            const result = await singleTimeline.save();
            res.status(201).send({ result });
          } else if (req.query?.type == "content") {
            const timelineItem = singleTimeline.timeline.find(
              (item) => item._id.toString() === req.body.id
            );
            if (timelineItem) {
              timelineItem.content = req.body.content;
              await singleTimeline.save(); // Save the parent document after updating the embedded document
              res.status(200).send({ msg: "Content updated." });
            } else {
              res.status(404).send({ msg: "Timeline item not found." });
            }
          } else {
            res.status(400).send({ msg: "Something gone south" });
          }
        } catch (error) {
          erroResponse(res, error);
        }
      }
    );

    app.delete("/timeline/:id", logger, async (req, res) => {
      try {
        const singleTimeline = await Timeline.findById(req.params.id);
        singleTimeline.guest = [];
        singleTimeline.timeline = [];
        await singleTimeline.save();
        res.status(200).send({ msg: "Reset all timeline" });
      } catch (error) {
        erroResponse(res, error);
      }
    });

    app.post(
      "/attendee",
      logger,
      emptyBodyChecker,
      checkBody(["name", "email", "event", "slot"]),
      async (req, res) => {
        try {
          const attendee = new Attendee(req.body);
          attendee
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              if (e.code == 11000) {
                res.status(400).send({
                  msg: `${req.body.email} already in attendee list for this event.`,
                });
              } else {
                res.status(400).send({ msg: e.message });
              }
            });
        } catch (e) {
          erroResponse(res, e);
        }
      }
    );

    app.get("/attendee", logger, emptyQueryChecker, async (req, res) => {
      try {
        Attendee.where("event")
          .equals(req.query.id)
          .then((result) => {
            if (result.length != 0) {
              res.status(200).send(result);
            } else {
              res.status(400).send({ msg: "No attendee found." });
            }
          });
      } catch (error) {
        erroResponse(res, error);
      }
    });

    app.delete("/attendee/:id", logger, async (req, res) => {
      Attendee.findByIdAndDelete(req.params.id)
        .then((result) => {
          res.status(200).send({ msg: `${result.name} deleted successfully` });
        })
        .catch((e) => {
          res.status(400).send({ msg: e.message });
        });
    });

    app.patch("/attendee/:id", logger, async (req, res) => {
      try {
        const attendee = await Attendee.findById(req.params.id);
        if (attendee != null) {
          UpdateHelper(attendee, req.body, res);
        } else {
          res.status(400).send({ msg: "Attendee information update failed!!" });
        }
      } catch (error) {
        erroResponse(res, error);
      }
    });

    app.post(
      "/note",
      logger,
      emptyBodyChecker,
      checkBody(["meeting", "createdBy", "title"]),
      async (req, res) => {
        try {
          const newNote = new Note(req.body);
          newNote
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              erroResponse(res, e);
            });
        } catch (e) {
          erroResponse(res, e);
        }
      }
    );

    app.get("/note", logger, emptyQueryChecker, async (req, res) => {
      if (req.query?.userid) {
        // all the notes for a user
        Note.where("createdBy")
          .equals(req.query?.userid)
          .then((result) => {
            if (result.length != 0) {
              res.status(200).send(result);
            } else {
              res.status(404).send({ msg: "Notes not found" });
            }
          })
          .catch((e) => {
            erroResponse(res, e);
          });
      } else if (req.query?.noteid) {
        // single note
        Note.findById(noteid)
          .then((result) => {
            res.status(200).send(result);
          })
          .catch((e) => {
            erroResponse(res, e);
          });
      } else if (req.query?.meetingid) {
        Note.where("meeting")
          .equals(req.query?.meetingid)
          .then((result) => {
            if (result.length != 0) {
              res.status(200).send(result[0]);
            } else {
              res.status(404).send({ msg: "Notes not found" });
            }
          });
      }
    });

    app.patch("/note/:id", logger, emptyBodyChecker, async (req, res) => {
      const id = req.params.id;
      let note = await Note.findById(id);
      if (note != null) {
        UpdateHelper(note, req.body, res);
      } else {
        res.status(400).send({ msg: "Note not found" });
      }
    });

    // ecommerce
    app.post(
      "/ecommerce",
      logger,
      emptyBodyChecker,
      checkBody(["title", "price", "img"]),
      async (req, res) => {
        //  const product = req.body;
        //  const result = await Ecommerce.save(product);
        //  res.send(result);
        try {
          const product = new Ecommerce(req.body);
          product
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              erroResponse(res, e);
            });
        } catch (e) {
          erroResponse(response, e);
        }
      }
    );

    app.get("/ecommerce", logger, async (req, res) => {
      try {
        const ecommerceItems = await Ecommerce.find();
        // res.status(200).json(ecommerceItems);
        // console.log(ecommerceItems);
        res.send(ecommerceItems);
      } catch (error) {
        res.status(500).json({ message: "Error fetching ecommerce items" });
      }
    });

    // cart
    app.post(
      "/cart",
      emptyBodyChecker,
      checkBody(["title", "isSold", "price", "productId", "userId", "img"]),
      async (req, res) => {
        try {
          const cart = new Cart(req.body);
          cart
            .save()
            .then((result) => {
              res.status(201).send(result);
            })
            .catch((e) => {
              erroResponse(res, e);
            });
        } catch (e) {
          erroResponse(response, e);
        }
      }
    );

    app.get("/cart", logger, async (req, res) => {
      try {
        const cartItems = await Cart.find();
        console.log(cartItems);
        res.send(cartItems);
      } catch (error) {
        res.status(404).send({ message: "cart items not found" });
      }
    });

    // payment
    app.post("/create-checkout-session", logger, async (req, res) => {
      const { products, email } = req.body;
      // console.log(products);

      let productId = [];
      const lineItems = products.map((product) => {
        productId.push(product?.id);
        const quantity =
          product?.quantity && product.quantity > 0 ? product.quantity : 1;
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: product?.title,
              images: [product?.img],
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: quantity,
        };
      });
      const order = new Order({
        productId: productId,
        email: email,
        // sessionId: sessionId,
        // address: address,
      });
      try {
        await order.save();
        console.log("Order saved:", order);
        // res.status(200).send("Order saved successfully");
      } catch (error) {
        console.error("Error saving order:", error);
        // res.status(500).send("Error saving order");
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        shipping_address_collection: {
          allowed_countries: ["US", "CA", "BD"],
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: 0,
                currency: "usd",
              },
              display_name: "Free shipping",
              // Delivers between 5-7 business days
              delivery_estimate: {
                minimum: {
                  unit: "business_day",
                  value: 5,
                },
                maximum: {
                  unit: "business_day",
                  value: 7,
                },
              },
            },
          },
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: 1500,
                currency: "usd",
              },
              display_name: "Next day air",
              // Delivers in exactly 1 business day
              delivery_estimate: {
                minimum: {
                  unit: "business_day",
                  value: 1,
                },
                maximum: {
                  unit: "business_day",
                  value: 1,
                },
              },
            },
          },
        ],
        phone_number_collection: {
          enabled: true,
        },
        customer_email: email,
        // customer: customer.id,
        line_items: lineItems,
        // email: email,
        mode: "payment",
        success_url: `${req.headers.origin}/success?id=${order._id}`,
        cancel_url: `${req.headers.origin}/cancel?id=${order._id}`,
      });
      //  console.log(session.id);
      // console.log(session);
      order.sessionId = session.id;
      await order.save();

      // Assuming you want to do something with lineItems, like sending it back as a response
      res.json({ id: session.id });
    });

    // let endpointSecret;
    // "whsec_ceb1fa9b3e1cbb1c499c40ca28c4db87389eeda4e2495d67e3e54bef5cd4e0d5";
    app.post("/paymentConfirm", logger, async (req, res) => {
      try{
        const id  = req.body;
        console.log("Order ID from frontend:", id);
        const order = await Order.findById(req.body.id);
        console.log(order);
      }catch(err){
        console.log(err.message);
      }
      res.send("")
    });

    app.get("/usercharts", logger, emptyQueryChecker, async (req, res) => {
      let id = req.query.id;
      let meeting = new Array();
      let attendee = new Array();
      let eventType = new Array();
      let eventNumber = new Array();
      Meeting.where("createdBy")
        .equals(id)
        .select("-_id title attendee")
        .then(async (result) => {
          if (result.length != 0) {
            for (const item of result) {
              meeting.push(item.title);
              attendee.push(item.attendee);
            }
          }
          Meeting.aggregate([
            {
              $match: {
                createdBy: new mongo.Types.ObjectId(id),
              },
            },
            {
              $group: {
                _id: "$eventType",
                count: { $sum: 1 },
              },
            },
          ]).then((results) => {
            for (const item of results) {
              eventType.push(item._id);
              eventNumber.push(item.count);
            }
            res.status(200).send({ meeting, attendee, eventType, eventNumber });
          });
        })
        .catch((e) => {
          res.status(200).send({
            meeting,
            attendee,
            eventType,
            eventNumber,
            error: e.message,
          });
        });
    });

    app.get("/admin/users", logger, emptyQueryChecker, async (req, res) => {
      try {
        const { page = 1, limit = 15 } = req.query;
        const options = {
          select: "name email createdAt role totalMeeting",
          page: parseInt(page),
          limit: parseInt(limit),
        };

        const users = await User.paginate({}, options);

        res.status(200).send(users);
      } catch (e) {
        res.status(500).send({ msg: e.message });
      }
    });

    app.get("/admin/meetings", logger, emptyQueryChecker, async (req, res) => {
      try {
        const { page = 1, limit = 15 } = req.query;
        const options = {
          select: "title duration eventType camera mic attendee createdAt",
          populate: { path: "createdBy", select: "name" },
          page: parseInt(page),
          limit: parseInt(limit),
        };
        const meetingsData = await Meeting.paginate({}, options);

        res.status(200).send(meetingsData);
      } catch (e) {
        res.status(500).send({ msg: e.message });
      }
    });

    app.get("/admin/attendee", logger, emptyQueryChecker, async (req, res) => {
      try {
        const { page = 1, limit = 15 } = req.query;
        const options = {
          select: "name email createdAt",
          populate: { path: "event", select: "title" },
          page: parseInt(page),
          limit: parseInt(limit),
        };
        const attendeeData = await Attendee.paginate({}, options);
        res.status(200).send(attendeeData);
      } catch (e) {
        res.status(500).send({ msg: e.message });
      }
    });
    app.get("/admin/timeline", logger, emptyQueryChecker, async (req, res) => {
      try {
        const { page = 1, limit = 15 } = req.query;
        const options = {
          select: "event createdAt",
          populate: { path: "event", select: "title" },
          page: parseInt(page),
          limit: parseInt(limit),
        };
        const timelineData = await Timeline.paginate({}, options);
        res.status(200).send(timelineData);
      } catch (e) {
        erroResponse(res, e);
      }
    });

    app.post(
      "/sendmail",
      logger,
      emptyBodyChecker,
      checkBody(["attendeeEmail", "subject", "html"]),
      async (req, res) => {
        let message = {
          from: process.env.MAIL,
          to: req.body.attendeeEmail,
          subject: req.body.subject,
          html: req.body.html,
        };
        mailTransporter
          .sendMail(message)
          .then((result) => {
            console.log(result);
            res.status(200).send({ msg: "Mail Sent" });
          })
          .catch((e) => {
            console.log(e);
            res.status(400).send({ msg: "Mail Sent Failed" });
          });
      }
    );

    app.get("/testhuzaifa", logger, async (req, res) => {
      User.find().then((result) => {
        for (const user of result) {
          user.img_profile = ProfileImageSizeCutter(user.img_profile);
          user.save();
        }
      });
      res.send({ msg: "DONE" });
    });

    app.get("/home", logger, async (req, res) => {
      Meeting.find()
        .limit(4)
        .select("-_id title duration attendee createdAt")
        .then((meetings) => {
          res.status(200).send(meetings);
        })
        .catch((e) => {
          erroResponse(res, e);
        });
    });
    app.get("/guest", logger, emptyQueryChecker, async (req, res) => {
      try {
        const timeline = await Timeline.findById(req.query.timelineid)
          .select("guest")
          .populate("guest", "img_profile name email");
        if (timeline) {
          res.status(201).send(timeline);
        } else {
          res.status(404).send({ msg: "Timeline not found" });
        }
      } catch (e) {
        erroResponse(res, e);
      }
    });
    app.post(
      // its post but working as get
      "/guest",
      logger,
      emptyBodyChecker,
      checkBody(["text"]),
      async (req, res) => {
        try {
          const regex = new RegExp(req.body.text, "i"); // Case-insensitive regex
          const result = await User.find({
            $or: [{ name: regex }, { email: regex }],
          }).select("img_profile email name");
          res.status(200).send(result);
        } catch (e) {
          erroResponse(res, e); // Assuming erroResponse is a function you've defined to handle errors
        }
      }
    );
    /**
     * params id is the id of the timeline document. and body id is the user id from User collection as guest
     */
    app.patch(
      "/addguest/:id",
      logger,
      emptyBodyChecker,
      checkBody(["id"]),
      async (req, res) => {
        try {
          const timeline = await Timeline.findById(req.params.id);
          if (timeline) {
            timeline.guest.push(req.body.id);
            const result = await timeline.save();
            res.status(201).send(result);
          } else {
            res.status(400).send({ msg: "Add failed." });
          }
        } catch (e) {
          erroResponse(res, e);
        }
      }
    );
    app.delete("/guest/:id", logger, emptyQueryChecker, async (req, res) => {
      try {
        const timeline = await Timeline.findById(req.params.id);
        if (timeline) {
          const index = req.query.index;
          if (index >= 0 && index < timeline.guest.length) {
            timeline.guest.splice(index, 1);
            const result = await timeline.save();
            res.status(200).send(result);
          } else {
            res.status(400).send({ msg: "Invalid index." });
          }
        } else {
          res.status(400).send({ msg: "Delete failed." });
        }
      } catch (e) {
        erroResponse(res, e);
      }
    });
  } catch (e) {
    console.log(e);
    return;
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.listen(port, () => {
  console.log(`Server Started at ${port}`);
});
