const mongo = require("mongoose");
const humanizeErrors = require("mongoose-error-humanizer");
const calendar = require("googleapis").google.calendar("v3");
const mongoosePaginate = require("mongoose-paginate-v2");
const { oauth2Client } = require("./setup");
const userSchema = new mongo.Schema(
  {
    name: {
      type: String,
      trim: true,
      require: true,
    },
    email: {
      type: String,
      lowercase: true,
      require: true,
      unique: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
        "Invalid Email.",
      ],
    },
    img_cover: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
    timeZone: {
      type: String,
      default: null,
      trim: true,
    },
    img_profile: {
      type: String,
      default: null,
    },
    desc: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      maxLength: 20,
    },
    role: {
      type: String,
      enum: ["User", "Pro", "Admin", "admin"],
      default: "User",
    },
    totalMeeting: {
      type: Number,
      default: 0,
    },
    isRefreshToken: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);
userSchema.plugin(mongoosePaginate);
userSchema.post("save", humanizeErrors);
userSchema.post("update", humanizeErrors);
userSchema.statics.isUserExist = async function (email) {
  let user = await User.findOne({ email: email });
  return user;
};

const User = mongo.model("User", userSchema);
const meetingSchema = new mongo.Schema(
  {
    title: {
      type: String,
      require: true,
    },
    duration: {
      type: String,
      require: true,
    },
    desc: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongo.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    events: {
      type: mongo.Schema.Types.Mixed,
      require: true,
    },
    eventType: {
      type: String,
      require: true,
    },
    camera: {
      type: Boolean,
      default: false,
    },
    mic: {
      type: Boolean,
      default: false,
    },
    attendee: {
      type: Number,
      default: 0,
    },
    expDate: {
      type: String,
      default: "",
    },
    offline: {
      type: Boolean,
      default: true,
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      default: "",
    },
    endTime: {
      type: String,
      default: "",
    },
    meetLink:{
      type:{
        id:String,
        name:String,
        url:String,
      },
      default:{}
    }
  },
  {
    timestamps: true,
  }
);
meetingSchema.plugin(mongoosePaginate);
meetingSchema.post("save", humanizeErrors);
meetingSchema.post("update", humanizeErrors);
meetingSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      User.findById(this.createdBy).then(async (result) => {
        result.totalMeeting = (
          await Meeting.where("createdBy").equals(this.createdBy)
        ).length;
        await result.save();
      });
      const newNote = new Note({
        title: this.title,
        createdBy: this.createdBy,
        meeting: this._id,
      });
      await newNote.save();
      const newTimeline = new Timeline({
        event: this._id,
        createdBy: this.createdBy,
      });
      let timelineResult = await newTimeline.save();
    }
    next();
  } catch (e) {
    next();
    console.log(e.message);
  }
  next();
});
meetingSchema.post("findOneAndDelete", async function (doc, next) {
  try {
    const user = await User.findById(doc.createdBy);
    if (user) {
      user.totalMeeting = (
        await Meeting.where("createdBy").equals(doc.createdBy)
      ).length;
      await user.save();
    }
    await Note.findOneAndDelete({ meeting: doc._id, createdBy: doc.createdBy });
    await Timeline.findOneAndDelete({
      event: doc._id,
      createdBy: doc.createdBy,
    });
    await Attendee.deleteMany({ meeting: doc._id });
    await GoogleCalendarEvent.findOneAndDelete({
      event: new mongo.Types.ObjectId(doc._id),
    });
    next();
  } catch (e) {
    console.log(e.message);
    next();
  }
  next();
});

const Meeting = mongo.model("Meeting", meetingSchema);

const attendeeSchema = new mongo.Schema(
  {
    name: {
      type: String,
      require: true,
    },
    email: {
      type: String,
      lowercase: true,
      require: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
        "Invalid Email.",
      ],
    },
    event: {
      type: mongo.Schema.Types.ObjectId,
      ref: "Meeting",
      require: true,
    },
    slot: {
      type: mongo.Schema.Types.Mixed,
      require: true,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);
attendeeSchema.plugin(mongoosePaginate);
attendeeSchema.index({ email: 1, event: 1 }, { unique: true });
attendeeSchema.post("save", humanizeErrors);
attendeeSchema.post("update", humanizeErrors);
attendeeSchema.post("save", async function (doc) {
  try {
    const meeting = await Meeting.findById(doc.event);
    meeting.attendee = (await Attendee.where("event").equals(doc.event)).length;
    await meeting.save();
  } catch (error) {
    console.log(error);
  }
});
attendeeSchema.post("findOneAndDelete", async function (doc, next) {
  try {
    const meeting = await Meeting.findById(doc.event);
    meeting.attendee = (await Attendee.where("event").equals(doc.event)).length;
    await meeting.save();
    const googleCal = await GoogleCalendarEvent.findOne({
      event: new mongo.Types.ObjectId(doc.event),
    }).select("googleEvents");
    const firstKey = Object.keys(doc.slot)[0];
    const schedule = `${firstKey}-${doc.slot[firstKey]}`;
    const eventGoogle = googleCal.googleEvents.find(
      (event) => event.schedule === schedule
    );
    const isCredentialSet = await require("./util").setCreadential(meeting.createdBy);
    if (isCredentialSet && googleCal && eventGoogle) {
      const calendarId = await require("./util").GetCalendarId();
      if (calendarId) {
        const googleEvent = await calendar.events.get({
          auth: oauth2Client,
          calendarId: calendarId,
          eventId: eventGoogle.id,
        });
        const existingAttendees = googleEvent.data.attendees || [];
        console.log("~ existingAttendees", existingAttendees);
        const updatedAttendees = existingAttendees.filter(
          (x) => x.email != doc.email
        );
        console.log("~ updatedAttendees", updatedAttendees);
        await calendar.events.patch({
          auth: oauth2Client,
          calendarId: calendarId,
          eventId: eventGoogle.id,
          requestBody: {
            attendees: updatedAttendees,
          },
        });
      }
    }
  } catch (e) {
    console.log(`attendeeSchema:post:findOneAndDelete:${e.message}`);
  } finally {
    next();
  }
});

const Attendee = mongo.model("Attendee", attendeeSchema);
const noteSchema = new mongo.Schema(
  {
    title: {
      type: String,
    },
    meeting: {
      type: mongo.Schema.Types.ObjectId,
      ref: "Meeting",
      require: true,
      unique: true,
    },
    createdBy: {
      type: mongo.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
noteSchema.post("save", humanizeErrors);
noteSchema.post("update", humanizeErrors);
const Note = mongo.model("Note", noteSchema);

const ecommerceSchema = new mongo.Schema({
  title: {
    type: String,
  },
  description: {
    type: String,
  },
  img: {
    type: String,
  },
  price: {
    type: Number,
  },
  quantity: {
    type: Number,
    default: 1,
  },
  isSoldOut: {
    type: Boolean,
    default: false,
  },
});
ecommerceSchema.plugin(mongoosePaginate);
const Ecommerce = mongo.model("ecommerce", ecommerceSchema);

const cartSchema = new mongo.Schema({
  userId: {
    type: String,
  },
  productId: {
    type: [mongo.Schema.Types.ObjectId],
  },
  isSold: {
    type: Boolean,
    default: false,
  },
  quantity: {
    type: Number,
    default: 1,
  },
});
const Cart = mongo.model("cart", cartSchema);

// order
const orderSchema = new mongo.Schema(
  {
    productId: {
      type: [mongo.Schema.Types.ObjectId],
      ref: "ecommerce",
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
        "Invalid Email.",
      ],
    },
    sessionId: {
      type: String,
      default: "",
      trim: true,
    },
    addresss: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

const Order = mongo.model("Order", orderSchema);
const timeLineSchema = new mongo.Schema(
  {
    event: {
      type: mongo.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    createdBy: {
      type: mongo.Schema.Types.ObjectId,
      ref: "User",
    },
    guest: {
      type: [mongo.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    timeline: {
      type: [
        {
          startTime: String,
          endTime: String,
          content: String,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);
timeLineSchema.plugin(mongoosePaginate);
timeLineSchema.post("save", humanizeErrors);
timeLineSchema.post("update", humanizeErrors);
const Timeline = mongo.model("Timeline", timeLineSchema);
const tokenSchema = new mongo.Schema(
  {
    user: {
      type: mongo.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    refreshToken: {
      type: String,
      trim: true,
      default: "",
    },
    registeredEmail: {
      type: String,
      lowercase: true,
      require: true,
      unique: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
        "Invalid Email.",
      ],
    },
  },
  {
    timestamps: true,
  }
);
tokenSchema.plugin(mongoosePaginate);
tokenSchema.post("save", humanizeErrors);
tokenSchema.post("update", humanizeErrors);
tokenSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      User.findById(this.user).then(async (result) => {
        if (result) {
          result.isRefreshToken = true;
          await result.save();
        }
      });
    }
    next();
  } catch (e) {
    console.log(e.message);
    next();
  }
  next();
});

const Token = mongo.model("Token", tokenSchema);

const googleCalendarSchema = new mongo.Schema(
  {
    event: {
      type: mongo.Schema.Types.ObjectId,
      ref: "Meeting",
    },
    googleEvents: {
      type: [
        {
          schedule: {
            type: String,
            default: "",
            trim: true,
          },
          htmlLink: {
            type: String,
            trim: true,
            default: "",
          },
          id: {
            type: String,
            trim: true,
            default: "",
          },
          meetLink: {
            type: String,
            trim: true,
            default: "",
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

googleCalendarSchema.post("findOneAndDelete", async function (doc, next) {
  if (doc == null) {
    next();
    return;
  }
  try {
    let calendarId = await require("./util").GetCalendarId();
    if (calendarId) {
      for (const item of doc.googleEvents) {
        await calendar.events.delete({
          auth: oauth2Client,
          eventId: item.id,
          calendarId: calendarId,
        });
      }
    }
    next();
  } catch (e) {
    console.log(e.message);
    next();
  } finally {
    next();
  }
});

const GoogleCalendarEvent = mongo.model(
  "GoogleCalendarEvent",
  googleCalendarSchema
);
module.exports = {
  User,
  Meeting,
  Attendee,
  Note,
  Timeline,
  Ecommerce,
  Cart,
  Token,
  GoogleCalendarEvent,
  Order,
};
