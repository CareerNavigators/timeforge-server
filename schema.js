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
        default:"https://i.pinimg.com/736x/ba/f1/10/baf110546432bcbe2b3c6581299087bf.jpg",
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
        default:"https://static.vecteezy.com/system/resources/previews/020/765/399/non_2x/default-profile-account-unknown-icon-black-silhouette-free-vector.jpg",
    }
},{
    timestamps:true,
})
userSchema.post("save",humanizeErrors)
userSchema.post("update",humanizeErrors)

/** 
 * @param {String} email - Email of the user
 * @returns {Boolean}
*/
userSchema.statics.isUserExist= async function (email) {
    let user= await User.findOne({email:email})
    return user
}



const User=mongo.model("User",userSchema)
module.exports={User}