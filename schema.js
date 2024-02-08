const mongo = require("mongoose")
const humanizeErrors = require('mongoose-error-humanizer')
const { erroResponse } = require("./util")
const userSchema = new mongo.Schema({
    name: {
        type: mongo.Schema.Types.String,
        trim: true,
        require: true,
    },
    email: {
        type: mongo.Schema.Types.String,
        lowercase: true,
        require: true,
        unique: true,
        trim: true,
        match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, "Invalid Email."],
    },
    img_cover: {
        type: mongo.Schema.Types.String,
        default: null,
    },
    location: {
        type: mongo.Schema.Types.String,
        default: null,
        trim: true,
    },
    timeZone: {
        type: mongo.Schema.Types.String,
        default: null,
        trim: true,
    },
    img_profile: {
        type: mongo.Schema.Types.String,
        default: null,
    },
    desc: {
        type: String,
        default: null
    },
    phone: {
        type: String,
        trim: true,
        maxLength: 20,
    },
    role: {
        type: String,
        enum: ["User", "Pro", "Admin"]
    },
    totalMeeting: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
})
userSchema.post("save", humanizeErrors)
userSchema.post("update", humanizeErrors)
userSchema.statics.isUserExist = async function (email) {
    let user = await User.findOne({ email: email })
    return user
}

const User = mongo.model("User", userSchema)
const meetingSchema = new mongo.Schema({
    title: {
        type: mongo.Schema.Types.String,
        require: true,
    },
    duration: {
        type: mongo.Schema.Types.String,
        require: true,
    },
    desc: {
        type: mongo.Schema.Types.String,
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
        type: mongo.Schema.Types.String,
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
    isNote: {
        type: Boolean,
        default: false,
    }
}, {
    timestamps: true,
})
meetingSchema.post("save", humanizeErrors)
meetingSchema.post("update", humanizeErrors)
meetingSchema.post("save", function (doc) {
    try {
        User.findById(doc.createdBy).then(async (result) => {
            result.totalMeeting += 1
            await result.save()
        })
    } catch (e) {
        console.log(e.message);
    }
})
  meetingSchema.post('findOneAndDelete', async function(doc) {
    try {
        User.findById(doc.createdBy).then(async (result) => {
            result.totalMeeting -= 1
            await result.save()
        })
    } catch (e) {
        console.log(e.message);
    }
    
  });


const Meeting = mongo.model("Meeting", meetingSchema)

const attendeeSchema = new mongo.Schema({
    name: {
        type: mongo.Schema.Types.String,
        require: true,
    },
    email: {
        type: mongo.Schema.Types.String,
        lowercase: true,
        require: true,
        trim: true,
        match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, "Invalid Email."],
    },
    event: {
        type: mongo.Schema.Types.ObjectId,
        ref: "Meeting",
        require: true,
    },
    slot: {
        type: mongo.Schema.Types.Mixed,
        require: true,
    }
})

attendeeSchema.index({ "email": 1, "event": 1 }, { "unique": true });
attendeeSchema.post("save", humanizeErrors)
attendeeSchema.post("update", humanizeErrors)
attendeeSchema.post("save", async function (doc) {
    try {
        Meeting.findById(doc.event).then(async result => {
            result.attendee += 1
            await result.save()
        })
    } catch (e) {
        console.log(`attendeeSchema:post:save:${e.message}`);
    }
})
attendeeSchema.post('findOneAndDelete', async function(doc) {
    try {
        Meeting.findById(doc.event).then(async result => {
            result.attendee -= 1
            await result.save()
        })
    } catch (e) {
        console.log(`attendeeSchema:post:findOneAndDelete:${e.message}`);
    }
    
  });

const Attendee = mongo.model("Attendee", attendeeSchema)
const noteSchema = new mongo.Schema({
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
        trim: true,
    }
})
noteSchema.post("save", async function (doc) {
    try {
        Meeting.findById(doc.event).then(async result => {
            result.isNote = true
            await result.save()
        }).catch(e => {
            console.log(`118:attendeeSchema:post:save:${e.message}`);
        })
    } catch (e) {
        console.log(`121:attendeeSchema:post:save:${e.message}`);
    }
})
noteSchema.post("save", humanizeErrors)
noteSchema.post("update", humanizeErrors)
const Note = mongo.model("Note", noteSchema)


module.exports = { User, Meeting, Event, Attendee, Note }