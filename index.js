require('dotenv').config();
const express = require('express')

const cors = require('cors');
const mongo = require('mongoose');
const { User, Meeting, Event } = require("./schema")
const { logger, checkBody, emptyBodyChecker, emptyQueryChecker } = require("./middleware")

const app = express()
const port = process.env.PORT || 5111
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`
mongo.connect(uri)

/**
 * sends 500 error with error server side any other un handel error.
 * 
 * @param {express.res} res 
 * @param {Error} err 
 * 
 */
function erroResponse(res, err) {
    res.status(500).send({ msg: err.message })
}


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
        app.post("/user", logger, emptyBodyChecker, checkBody(['name', 'email']), async (req, res) => {
            let t_user = await User.isUserExist(req.body.email)
            if (t_user == null) {
                const user = new User(req.body)
                try {
                    let result = await user.save()
                    res.status(201).send(result)
                } catch (e) {
                    erroResponse(res, e)
                }
            } else {
                res.status(200).send(t_user)
            }
        });
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
         * 400 - update failed hole
         * 202 - update Successful. return the updated element
         */
        app.patch("/user/:id", logger, emptyBodyChecker, async (req, res) => {
            try {
                let user = await User.findById(req.params.id);
                if (user != null) {
                    let modelKeys = Object.keys(User.schema.paths)
                    for (const key of Object.keys(req.body)) {
                        if (!modelKeys.includes(key)) {
                            res.status(400).send({ msg: `'${key}' is not a valid key. Update failed.` })
                            return
                        } else {
                            user[key] = req.body[key]
                        }
                    }
                    let result = await user.save()
                    res.status(202).send(result)
                } else {
                    res.status(404).send({ msg: "User not found" })
                }
            } catch (e) {
                erroResponse(res, e)
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
            let query = req.query
            if (query?.email) {
                User.findOne({ email: query.email }).then(result => {
                    if (result != null) {
                        res.status(200).send(result)
                    } else {
                        res.status(404).send({ msg: "User not found" })
                    }
                }).catch(e => {
                    erroResponse(res, e)
                })
            } else if (query?.id) {
                User.findOne({ _id: query.id }).then(result => {
                    if (result != null) {
                        res.status(200).send(result)
                    } else {
                        res.status(404).send({ msg: "User not found" })
                    }
                }).catch(e => {
                    erroResponse(res, e)
                })
            } else {
                res.status(400).send({ msg: "Query invalid" })
            }
        });
        /**
        * Crate Event
        * req.body:
        * {
        *   duration: time in minutes,
        *   desc: event description,
        *   createdby: user id, - right now send the data from localStorage. After JWT it will fetch from cookies
        *   events:{
        *       201024:[9:30AM,4:50PM],
        *       211024:[9:10PM,4:50PM]
        *   },
        *   
        * }
        */
        app.post("/event", logger, emptyBodyChecker, async (req, res) => {
            let data = req.body
        });
    } catch (e) {
        console.log(`22:The Error is:${e.message}`);
        return
    }
}

run().catch(console.dir);

app.get('/', (req, res) => { res.send("Backend Running") });
app.listen(port, () => { console.log(`Server Started at ${port}`) });
