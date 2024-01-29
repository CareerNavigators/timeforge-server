const mongo =require("mongoose")
const humanizeErrors = require('mongoose-error-humanizer')
const userSchema=new mongo.Schema({
    name:{
        type:mongo.Schema.Types.String,
        trim:true,
        require:true,
    },
    email:{
        type:mongo.Schema.Types.String,
        lowercase:true,
        require:true,
        unique:true,
        trim:true,
        match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,"Invalid Email."],
    },
    img_cover:{
        type:mongo.Schema.Types.String,
        default:null,
    },
    country:{
        type:mongo.Schema.Types.String,
        default:null,
        trim:true,
    },
    timeZone:{
        type:mongo.Schema.Types.String,
        default:null,
        trim:true,
    },
    img_profile:{
        type:mongo.Schema.Types.String,
        default:null,
    },
},{
    timestamps:true,
})
userSchema.post("save",humanizeErrors)
userSchema.post("update",humanizeErrors)
userSchema.statics.isUserExist= async function (email) {
    let user= await User.findOne({email:email})
    return user
}
const User=mongo.model("User",userSchema)
const meetingSchema=new mongo.Schema({
    title:{
        type:mongo.Schema.Types.String,
        require:true,
    },
    duration:{
        type:mongo.Schema.Types.String,
        require:true,
    },
    desc:{
        type:mongo.Schema.Types.String,
        default:null,
    },
    createdBy:{
        type:mongo.Schema.Types.ObjectId,
        ref:"User",
        require:true,
    },
    events:{
        type:mongo.Schema.Types.Mixed,
        require:true,
    },
    eventType:{
        type:mongo.Schema.Types.String,
        require:true,
    }
},{
    timestamps:true,
})
const Meeting=mongo.model("Meeting",meetingSchema)

const attendeeSchema=new mongo.Schema({
    name:{
        type:mongo.Schema.Types.String,
        require:true,
    },
    email:{
        type:mongo.Schema.Types.String,
        lowercase:true,
        require:true,
        trim:true,
        match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,"Invalid Email."],
    },
    event:{
        type:mongo.Schema.Types.ObjectId,
        ref:"Meeting",
        require:true,
    },
    slot:{
        type:mongo.Schema.Types.Mixed,
        require:true,
    }
})
attendeeSchema.index({ "email": 1, "event": 1}, { "unique": true });

const Attendee=mongo.model("Attendee",attendeeSchema)

module.exports={User,Meeting,Event,Attendee}