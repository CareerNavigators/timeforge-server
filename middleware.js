 function logger(req, res, next) {
    let date = new Date()
    console.log(`${date.toLocaleString("en-US")}:${req.method}:${req.url}`);
    next()
}

 function checkPost(req,res,next){
    if (req.method=="POST") {
        let data=req.body
        console.log(data);
    }
    next()
}

module.exports = { logger, checkPost };