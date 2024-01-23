const mongo =require("mongoose")
const humanizeErrors = require('mongoose-error-humanizer')
const userSchema=new mongo.Schema({
    name:{
        type:String,
        default:null,
        
    },
    email:{
        type:String,
        default:null,
        lowercase:true,
        unique:true,
    },
    bio:{
        type:String,
        default:null,
    },
    country:{
        type:String,
        default:null,
    },
    timeZone:{
        type:String,
        default:null
    },
    image:{
        type:String,
        default:null,
    }
},{
    timestamps:true,
})
userSchema.post("save",humanizeErrors)
userSchema.post("update",humanizeErrors)
const User=mongo.model("User",userSchema)
module.exports={
User:User
}