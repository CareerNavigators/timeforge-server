require('dotenv').config();
const express = require('express')
const cors = require('cors');
const mongo = require('mongoose');

const app = express()
const port = process.env.PORT || 5111
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@timeforge.ob9twtj.mongodb.net/TimeForge?retryWrites=true&w=majority`
mongo.connect(uri)

app.get('/', (req, res) => { res.send("Backend Running") });
app.listen(port, () => { console.log(`Server Started at ${port}`) });