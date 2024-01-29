require('dotenv').config();
const express = require('express')

const cors = require('cors');
const mongo = require('mongoose');
const { User, Meeting, Attendee } = require("./schema")
const { logger, checkBody, emptyBodyChecker, emptyQueryChecker } = require("./middleware")
const {erroResponse}=require("./util")
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
        app.post("/meeting",logger,emptyBodyChecker,checkBody(['title','duration','createdBy','events','eventType']),async(req,res)=>{
            const meeting=new Meeting(req.body)
            meeting.save().then(result=>{
                res.status(201).send(result)
            }).catch(e=>{
                res.status(400).send({msg:"Meeting Creation Failed."})
            })

        })
        /**
         * get all meeting or single meeting
         * req.query:{id:user id,type:all},{id:meeting id,type:single}
         * res.send:
         * 200 - meetings or meeting
         * 404 - not found event
         */
        app.get("/meeting",logger,emptyQueryChecker,async (req,res)=>{
            try {
                if (req.query.type=="all") {
                    Meeting.where("createdBy").equals(req.query.id).select("-createdBy -desc -events").then(result=>{
                        if(result.length!=0){
                            res.status(200).send(result)
                        }else{
                            res.send({msg:"No meetings found."})
                        }
                    })
                }else if(req.query.type="single"){
                    Meeting.findById(req.query.id).then(result=>{
                        res.status(200).send(result)
                    }).catch(e=>{
                        res.status(404).send({msg:"Meeting not found."})
                    })
                }else{
                    res.status(400).send({msg:"Expected query failed."})
                }
            } catch (e) {
                erroResponse(res,e)
            }
            
        })
        app.patch("/meeting/:id",logger,emptyBodyChecker,async(req,res)=>{
            try {
                Meeting.findById(req.params.id).then(result=>{
                    let modelKeys=Object.keys(Meeting.schema.paths)
                    console.log(modelKeys);
                    for (const key of Object.keys(req.body)) {
                        if (!modelKeys.includes(key)) {
                            res.status(400).send({ msg: `'${key}' is not a valid key. Update failed.` })
                            return
                        }else{
                            result[key]=req.body[key]
                        }
                    }
                    result.save().then(result=>{
                        res.status(202).send(result)
                    }).catch(e=>{
                        console.log(e);
                        res.status(400).send({msg:"Update Failed"})
                    })
                }).catch(e=>{
                    console.log(e);
                    res.status(400).send("Meeting not found.")
                })
            } catch (error) {
                erroResponse(res,error)
            }
        })
    } catch (e) {
        console.log(`22:The Error is:${e.message}`);
        return
    }
}

run().catch(console.dir);

app.get('/', (req, res) => { res.send("Backend Running") });
app.listen(port, () => { console.log(`Server Started at ${port}`) });
