require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongo = require("mongoose");
const admin = require("firebase-admin");
const calendar = require("googleapis").google.calendar("v3");
const { google } = require("googleapis");
const { default: axios } = require("axios");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
dayjs.extend(customParseFormat);
const { oauth2Client, mailTransporter } = require("./setup");
const {
  User,
  Meeting,
  Attendee,
  Note,
  Ecommerce,
  Cart,
  Timeline,
  Token,
  GoogleCalendarEvent,
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
  setCreadential,
  GetCalendarId,
} = require("./util");

const app = express();
const port = process.env.PORT || 5111;
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`;
mongo.connect(uri);

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
            .populate("createdBy", "name email img_profile")
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
      console.log(req.query);
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
        } else if (req.query.type == "single") {
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
        } else if (req.query.type == "event") {
          console.log("query event");
          Timeline.findOne({ event: new mongo.Types.ObjectId(req.query.id) })
            .select("event createdBy timeline")
            .populate("event", "startTime endTime")
            .then((result) => {
              console.log("~ result", result);
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
      "/checkattendee",
      logger,
      emptyBodyChecker,
      checkBody(["email", "eventid"]),
      async (req, res) => {
        const result = await Attendee.where("event")
          .equals(req.body.eventid)
          .where("email")
          .equals(req.body.email);
        if (result.length != 0) {
          return res.status(200).send({ msg: "Valid Attendee" });
        } else {
          const result2 = await Meeting.findById(req.body.eventid).populate(
            "createdBy",
            "email"
          );
          if (result2) {
            if (result2?.createdBy?.email == req.body.email) {
              return res.status(200).send({ msg: "Valid Attendee" });
            }
          }
          return res.status(400).send({ msg: "Invalid Attendee" });
        }
      }
    );
    app.post(
      "/attendee",
      logger,
      emptyBodyChecker,
      checkBody(["name", "email", "event", "slot"]),
      async (req, res) => {
        try {
          let googleCalResult = null;
          const meeting = await Meeting.findById(req.body.event).select(
            "createdBy events -_id"
          );
          if (!meeting) {
            return res.status(404).send({ msg: "Meeting not found." });
          }
          const googleCal = await GoogleCalendarEvent.findOne({
            event: new mongo.Types.ObjectId(req.body.event),
          }).select("googleEvents");

          if (googleCal) {
            const firstKey = Object.keys(req.body.slot)[0];
            const schedule = `${firstKey}-${req.body.slot[firstKey]}`;
            const eventGoogle = googleCal.googleEvents.find(
              (event) => event.schedule === schedule
            );
            if (eventGoogle) {
              const isCredentialSet = await setCreadential(meeting.createdBy);
              if (isCredentialSet) {
                const calendarId = await GetCalendarId();
                if (calendarId) {
                  const googleEvent = await calendar.events.get({
                    auth: oauth2Client,
                    calendarId: calendarId,
                    eventId: eventGoogle.id,
                  });
                  const existingAttendees = googleEvent.data.attendees || [];
                  const newAttendee = {
                    email: req.body.email,
                    displayName: req.body.name,
                  };
                  const updatedAttendees = [...existingAttendees, newAttendee];
                  googleCalResult = await calendar.events.patch({
                    auth: oauth2Client,
                    calendarId: calendarId,
                    eventId: eventGoogle.id,
                    requestBody: {
                      attendees: updatedAttendees,
                    },
                  });
                }
              }
            }
          }
          const attendee = new Attendee(req.body);
          attendee
            .save()
            .then((result) => {
              if (googleCalResult) {
                res.status(201).send({
                  result: result,
                  htmlLink: googleCalResult.data.htmlLink,
                });
              } else {
                res.status(201).send({ result: result });
              }
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
          console.log(e);
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
    app.patch("/ecommerce/:id", logger, emptyBodyChecker, async (req, res) => {
      try {
        const item = await Ecommerce.findById(req.params.id);
        UpdateHelper(item, req.body, res);
      } catch (e) {
        erroResponse(res, e);
      }
    });
    app.delete("/ecommerce/:id", logger, async (req, res) => {
      try {
        await Ecommerce.findByIdAndDelete(req.params.id);
        res.status(200).send({ msg: "Delete Successful!" });
      } catch (e) {
        erroResponse(res, e);
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
      try {
        const id = req.body.id;
        console.log("Order ID from frontend:", id);
        const order = await Order.findById(id);
        // console.log(order);
        const sessionId = order.sessionId;
        const newAddress = await stripe.checkout.sessions.retrieve(sessionId);
        // const address= newAddress.cutomer_datails;
        // console.log(address);
        // console.log(newAddress);
        const addressData = newAddress.customer_details.address.city;
        console.log(addressData);
        order.addresss = addressData;

        // Save the updated order document
        await order.save();
        res.send("Order updated successfully.");
      } catch (err) {
        console.log(err.message);
      }
      // res.send("")
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

    app.get("/admin/ecommerce", logger, emptyQueryChecker, async (req, res) => {
      try {
        const { page = 1, limit = 15 } = req.query;
        const options = {
          select: "title img price isSoldOut",
          page: parseInt(page),
          limit: parseInt(limit),
        };
        const ecommerceData = await Ecommerce.paginate({}, options);
        res.status(200).send(ecommerceData);
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
            res.status(200).send({ msg: "Mail Sent" });
          })
          .catch((e) => {
            console.log(e);
            res.status(400).send({ msg: "Mail Sent Failed" });
          });
      }
    );

    app.get("/testhuzaifa", logger, async (req, res) => {
      Meeting.find().then(async (result) => {
        for (const item of result) {
          item.meetLink = {};
          await item.save();
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
      // its post but working as search get
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
    app.post(
      "/insertToken",
      logger,
      emptyBodyChecker,
      checkBody(["code", "id"]),
      async (req, res) => {
        try {
          const isToken = await Token.where("user").equals(req.body.id);
          if (isToken.length == 0) {
            const result = await oauth2Client.getToken(req.body.code);
            if (result?.tokens?.access_token && result?.tokens?.refresh_token) {
              await oauth2Client.setCredentials({
                access_token: result?.tokens?.access_token,
                refresh_token: result?.tokens?.refresh_token,
              });
              const oauth2 = await google.oauth2({
                auth: oauth2Client,
                version: "v2",
              });
              const userInfo = await oauth2.userinfo.get();
              if (userInfo) {
                const newToken = new Token({
                  user: req.body.id,
                  refreshToken: result.tokens.refresh_token,
                  registeredEmail: userInfo.data.email,
                });
                await newToken.save();
              } else {
                const newToken = new Token({
                  user: req.body.id,
                  refreshToken: result.tokens.refresh_token,
                  registeredEmail: "",
                });
                await newToken.save();
              }
              res.status(201).send({ msg: "Successfully created" });
            } else {
              res.status(400).send({ msg: "Token Failed to get" });
            }
          } else {
            res.status(400).send({ msg: "Token already exist for this user" });
          }
        } catch (error) {
          console.log(error);
          erroResponse(res, error);
        }
      }
    );
    app.post(
      "/getToken",
      logger,
      emptyBodyChecker,
      checkBody(["code"]),
      async (req, res) => {
        try {
          const result = await oauth2Client.getToken(req.body.code);
          res.send({
            token: result.tokens.access_token,
            exptime: result.tokens.expiry_date,
          });
        } catch (error) {
          erroResponse(res, error);
        }
      }
    );
    app.get("/authorization", logger, emptyQueryChecker, async (req, res) => {
      try {
        const scopes = ["https://www.googleapis.com/auth/calendar"];
        if (req.query.access_type == "online") {
          const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: req.query.access_type,
            scope: scopes,
            include_granted_scopes: true,
            state: JSON.stringify({
              route: req.query.route,
              access_type: req.query.access_type,
            }),
          });
          res.send(authorizationUrl);
        } else {
          const isToken = await Token.where("user").equals(req.query.id);
          if (isToken && isToken.length == 0) {
            const authorizationUrl = oauth2Client.generateAuthUrl({
              access_type: req.query.access_type,
              scope: scopes,
              include_granted_scopes: true,
              state: JSON.stringify({
                id: req.query.id,
                route: req.query.route,
                access_type: req.query.access_type,
              }),
            });
            res.send(authorizationUrl);
          } else {
            res.status(400).send({ msg: "Token already exist for this user" });
          }
        }
      } catch (error) {
        erroResponse(res, error);
      }
    });

    app.post(
      "/insertcalendar",
      logger,
      emptyBodyChecker,
      checkBody(["userId", "eventId"]),
      async (req, res) => {
        try {
          const userToken = await Token.findOne({
            user: new mongo.Types.ObjectId(req.body.userId),
          });
          if (!userToken) {
            return res.status(400).send({ msg: "Authorize First" });
          }

          let googleEvent = await GoogleCalendarEvent.findOne({
            event: new mongo.Types.ObjectId(req.body.eventId),
          });

          if (googleEvent) {
            return res
              .status(200)
              .send({ msg: "Event already Exist on google Calendar" });
          }

          googleEvent = new GoogleCalendarEvent({
            event: req.body.eventId,
          });

          const result = await Meeting.findById(req.body.eventId);
          if (!result) {
            return res.status(400).send({ msg: "No schedule found." });
          }
          oauth2Client.setCredentials({
            refresh_token: userToken.refreshToken,
          });

          const calendarName = "TimeForge";
          const response = await calendar.calendarList.list({
            auth: oauth2Client,
          });

          const calendars = response.data.items;
          let isCalendarExist = false;
          let calendarId;

          for (const calendar of calendars) {
            if (calendar.summary === calendarName) {
              isCalendarExist = true;
              calendarId = calendar.id;
              break;
            }
          }

          if (!isCalendarExist) {
            const newCalendar = {
              summary: calendarName,
              description:
                "This Calendar contains all the events from TimeForge",
              timeZone: "Asia/Dhaka",
            };
            const result = await calendar.calendars.insert({
              auth: oauth2Client,
              resource: newCalendar,
            });
            calendarId = result.data.id;
          }
          let googleEvents = [];
          const attendees = await Attendee.where("event").equals(
            req.body.eventId
          );
          for (const key in result.events) {
            if (Object.hasOwnProperty.call(result.events, key)) {
              const element = result.events[key];
              for (const item of element) {
                const startDateTime = dayjs(
                  `${key} ${item}`,
                  "DDMMYY hh:mm A"
                ).format();
                const existAttendee = new Array();
                for (const item2 of attendees) {
                  const t_firstKey = Object.keys(item2.slot)[0];
                  const t_firstItem = item2.slot[t_firstKey][0];
                  if (t_firstKey == key && t_firstItem == item) {
                    existAttendee.push({
                      email: item2.email,
                      displayName: item2.name,
                    });
                  }
                }

                const endDateTime = dayjs(`${key} ${item}`, "DDMMYY hh:mm A")
                  .add(parseInt(result.duration), "m")
                  .format();
                let resource = {
                  summary: result.title,
                  description: result.desc,
                  start: {
                    dateTime: startDateTime,
                    timeZone: "Asia/Dhaka",
                  },
                  end: {
                    dateTime: endDateTime,
                    timeZone: "Asia/Dhaka",
                  },
                  reminders: {
                    useDefault: false,
                    overrides: [
                      {
                        method: "popup",
                        minutes: 10,
                      },
                    ],
                  },
                };
                if (existAttendee.length != 0) {
                  resource["attendees"] = existAttendee;
                }
                console.log("~ resource", resource);
                const calResult = await calendar.events.insert({
                  auth: oauth2Client,
                  calendarId: calendarId,
                  resource: resource,
                });
                googleEvents.push({
                  id: calResult.data.id,
                  htmlLink: calResult.data.htmlLink,
                  schedule: `${key}-${item}`,
                });
              }
            }
          }
          googleEvent.googleEvents = googleEvents;
          await googleEvent.save();
          res.status(201).send({
            msg: "Event Successfully Created",
          });
        } catch (error) {
          res.status(400).send({ msg: error.message });
        }
      }
    );
    app.get("/calevents", logger, emptyQueryChecker, async (req, res) => {
      try {
        const result = await GoogleCalendarEvent.findOne({
          event: new mongo.Types.ObjectId(req.query.eventid),
        }).select("googleEvents");
        res.status(200).send(result);
      } catch (error) {
        erroResponse(res, error);
      }
    });
    app.delete(
      "/calevents/:id",
      logger,
      emptyQueryChecker,
      async (req, res) => {
        try {
          await setCreadential(req.query.userId);
          let result = null;
          if (req.query.type == "all") {
            result = await GoogleCalendarEvent.findOneAndDelete({
              _id: new mongo.Types.ObjectId(req.params.id),
            });
          } else if (req.query.type == "single") {
            const calendarId = await GetCalendarId();
            const googleCal = await GoogleCalendarEvent.findOne({
              event: new mongo.Types.ObjectId(req.query.eventid),
            });
            if (googleCal) {
              if (googleCal.googleEvents.length == 1) {
                result = await GoogleCalendarEvent.findOneAndDelete({
                  event: new mongo.Types.ObjectId(req.query.eventid),
                });
              } else {
                googleCal.googleEvents.pull({ id: req.params.id });
                await googleCal.save();
                if (calendarId) {
                  result = await calendar.events.delete({
                    auth: oauth2Client,
                    eventId: req.params.id,
                    calendarId: calendarId,
                  });
                }
              }
            }
          }
          if (result) {
            res.status(200).send({ msg: "Delete Successful." });
          } else {
            res.status(400).send({ msg: "GoogleCalendar not found." });
          }
        } catch (error) {
          erroResponse(res, error);
        }
      }
    );
    app.post(
      "/createmeet",
      logger,
      emptyBodyChecker,
      checkBody(["roomName", "eventid"]),
      async (req, res) => {
        try {
          const meeting = await Meeting.findById(req.body.eventid);
          if (meeting) {
            const response = await axios.post(
              "https://api.daily.co/v1/rooms/",
              {
                name: req.body.roomeName,
                properties: {
                  enable_people_ui: true,
                  enable_pip_ui: true,
                  enable_emoji_reactions: true,
                  enable_hand_raising: true,
                  enable_prejoin_ui: true,
                  enable_chat: true,
                  enable_advanced_chat: true,
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${process.env.DAILY_TOKEN}`,
                },
              }
            );
            if (response?.data) {
              let newMeetLink = {
                id: response.data.id,
                name: response.data.name,
                url: response.data.url,
              };
              meeting.meetLink = newMeetLink;
              await meeting.save();

              const attendees = await Attendee.where("event").equals(
                meeting._id
              );
              let message = {
                from: process.env.MAIL,
                subject: `Meetlink for ${meeting.title}`,
                html: `
                <h4>Meeting Title: ${meeting.title} </h4>
                <p>Meeting Link: <a href=${req.body.origin}/meet/${meeting._id}> ${req.body.origin}/meet/${meeting._id} </a> </p>
                `,
              };
              for (const attendee of attendees) {
                message["to"] = attendee.email;
                mailTransporter.sendMail(message);
              }
              return res.status(201).send({ msg: "Link Created" });
            } else {
              return res.status(400).send({ msg: "Link Creation Failed" });
            }
          }
        } catch (e) {
          erroResponse(res, e);
        }
      }
    );
    app.delete("/deletemeeting/:id", logger, async (req, res) => {
      try {
        const meeting = await Meeting.findById(req.params.id);
        if (meeting.meetLink?.name != "") {
          const result = await axios.delete(
            `https://api.daily.co/v1/rooms/${meeting.meetLink?.name}`,
            {
              headers: {
                Authorization: `Bearer ${process.env.DAILY_TOKEN}`,
              },
            }
          );
          meeting.meetLink = {};
          await meeting.save();
          res.send({ msg: "Delete Successfully" });
        } else {
          res.status(200).send({ msg: "Nothing to delete" });
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
