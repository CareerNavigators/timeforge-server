const cc = require("node-console-colors");

function logger(req, res, next) {
    let date = new Date()
    console.log(cc.set("fg_yellow", date.toLocaleString("en-US"), cc.set("fg_purple", req.method), cc.set("fg_cyan", req.url)));
    next()
}
/**
 *check required keys from frontend.
 *
 * @param {Array} expectedkeys - keys of data
 * @returns 404 if keys does not match. otherwise execute next()
 */
function checkPost(expectedkeys) {
    return (req, res, next) => {
        if (req.method == "POST") {
            let notfound=new Array()
            let keys = Object.keys(req.body)
            if (expectedkeys.length<keys.length) {
                expectedkeys.forEach(key=>{
                    let isInside=keys.includes(key)
                    if (!isInside) {
                        notfound.push(key)
                    }
                })
                if (notfound.length!=0) {
                    res.status(400).send({msg:` ${notfound.join(",")} notfound.`})
                    return
                }
            }else{
                res.status(400).send({msg:"expectation failed."})
                return
            }
        }
        next()
    }
}

//  function checkPost(req,res,next){
//     if (req.method=="POST") {
//         let data=Object.keys(req.body)
//         console.log(data);
//     }
//     next()
// }

module.exports = { logger, checkPost };