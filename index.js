require('dotenv').config();
const express = require('express')

const cors = require('cors');
const mongo = require('mongoose');
const { User } = require("./schema")
const { logger, checkPost } = require("./middleware")

const app = express()
const port = process.env.PORT || 5111
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`
mongo.connect(uri)



async function run() {
    try {
        /**
         * url: "/user"
         * method: POST
         * create user in mongodb database. 
         * req.body:
         * {
         *  name:user name, - required
         *  email: user email, - required
         *  img_profile: profile picture of user - optional
         * }
         * res:
         * user data if the user exist otherwise create the user then send the data.
         * status 201 means created user. 200 means user already exist
         * if error occur then 'msg' key contains error message
         */
        app.post("/user", logger, checkPost(['name', 'email']), async (req, res) => {
            let t_user = await User.isUserExist(req.body.email)
            if (t_user == null) {
                const user = new User(req.body)
                try {
                    let result = await user.save()
                    res.status(201).send(result)
                } catch (e) {
                    res.status(500).send({ msg: e.message })
                }
            } else {
                res.status(200).send(t_user)
            }
        })
        /**
         * Update user information
         * url:/user/:id - :id = user id from database
         * method:patch
         * req.body:
         * {
         *  name: user name 
         *  email: user email 
         *  img_cover: cover photo url 
         *  country : country  
         *  timeZone : timeZone 
         *  img_profile: profile photo url 
         * }
         * res:
         * 500 - if anything goes wrong
         * 304 - update failed hole
         * 202 - update Successful. return the updated element
         */
        app.patch("/user/:id", logger, async (req, res) => {
            User.findOneAndUpdate({ _id: req.params.id }, req.body,{new:true}).then(result => {
                if (result!=null) {
                    res.status(202).send(result)
                }else{
                    res.status(304).send({msg:"Update failed."})
                }
            }).catch(e => {
                console.log(e);
                res.status(500).send({ msg: e.message })
            })
        })

    } catch (e) {
        console.log(`22:The Error is:${e.message}`);
        return
    }
}

run().catch(console.dir);

app.get('/', (req, res) => { res.send("Backend Running") });
app.listen(port, () => { console.log(`Server Started at ${port}`) });