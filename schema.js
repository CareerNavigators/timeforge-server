const mongo = require("mongoose");
const humanizeErrors = require("mongoose-error-humanizer");
const mongoosePaginate = require("mongoose-paginate-v2");
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
      let timelineResult=await newTimeline.save();
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
    await Timeline.findOneAndDelete({ event: doc._id, createdBy: doc.createdBy });
    await Attendee.deleteMany({ meeting: doc._id });
    console.log("findOneAndDelete");
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
      default: {}
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
attendeeSchema.post("findOneAndDelete", async function (doc) {
  try {
    const meeting = await Meeting.findById(doc.event);
    meeting.attendee = (await Attendee.where("event").equals(doc.event)).length;
    await meeting.save();
  } catch (e) {
    console.log(`attendeeSchema:post:findOneAndDelete:${e.message}`);
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
const timeLineSchema = new mongo.Schema(
  {
    event: {
      type: mongo.Schema.Types.ObjectId,
      ref:"Meeting",
      required: true,
    },
    createdBy: {
      type: mongo.Schema.Types.ObjectId,
      ref: "User",
    },
    guest: {
      type: [mongo.Schema.Types.ObjectId],
      ref:"User",
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
module.exports = { User, Meeting, Attendee, Note, Timeline };
