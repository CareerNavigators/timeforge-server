const mongo =require("mongoose")
const humanizeErrors = require('mongoose-error-humanizer')
const userSchema=new mongo.Schema({
    name:{
        type:String,
        default:null,
        trim:true,
    },
    email:{
        type:String,
        default:null,
        lowercase:true,
        unique:true,
        trim:true,
        match: [/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,"Invalid Email."],
    },
    img_cover:{
        type:String,
        default:null,
    },
    country:{
        type:String,
        default:null,
        trim:true,
    },
    timeZone:{
        type:String,
        default:null,
        trim:true,
    },
    img_profile:{
        type:String,
        default:null,
    },
    gender:{
        type:String,
        default:null,
        enum:['Male','Female','male','female']
    }
},{
    timestamps:true,
})
userSchema.post("save",humanizeErrors)
userSchema.post("update",humanizeErrors)
userSchema.statics.isUserExist= async function (email) {
    let user= await User.findOne({email:email})
    return user
}

// const taskSchema=new mongo.Model({
//     duration:{
//         type:Number,
//     },

// })

const User=mongo.model("User",userSchema)
module.exports={User}