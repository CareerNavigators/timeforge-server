require('dotenv').config();
const express = require('express')
const cors = require('cors');
const mongo = require('mongoose');
const {User}=require("./schema")
const {logger,checkPost}=require("./middleware")

const app = express()
const port = process.env.PORT || 5111
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`
mongo.connect(uri)

async function run() {
    try {
        app.post("/user",logger,checkPost,async(req,res)=>{
            res.send({msg:"Nice"})
        })
    } catch (e) {
        console.log(`22:The Error is:${e.message}`);
        return
    }
}

run().catch(console.dir);

app.get('/', (req, res) => { res.send("Backend Running") });
app.listen(port, () => { console.log(`Server Started at ${port}`) });