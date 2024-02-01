const cc = require("node-console-colors");

function logger(req, res, next) {
    let date = new Date()
    console.log(cc.set("fg_yellow", date.toLocaleString("en-US"), cc.set("fg_purple", req.method), cc.set("fg_cyan", req.url)));
    next()
}
/**
 * Check req.body empty or not
 * @returns 400 if empty otherwise next()
 */
function emptyBodyChecker(req, res, next) {
    if (req.method == "POST") {
        if (Object.keys(req.body).length == 0) {
            res.status(400).send({ msg: "Empty Body" })
            return
        }
    }
    next()
}
/**
 * Check req.query empty or not
 * @returns 400 if empty otherwise next()
 */
function emptyQueryChecker(req, res, next) {

    if (Object.keys(req.query).length == 0) {
        res.status(400).send({ msg: "Empty Query" })
        return
    }

    next()
}
/**
 *check required keys from frontend.
 *
 * @param {Array} expectedkeys - keys of data
 * @returns 404 if keys does not match. otherwise execute next()
 */
function checkBody(expectedkeys) {
    return (req, res, next) => {
        if (req.method == "POST") {
            let notfound = new Array()
            let keys = Object.keys(req.body)
            if (expectedkeys.length <= keys.length) {
                expectedkeys.forEach(key => {
                    let isInside = keys.includes(key)
                    if (!isInside) {
                        notfound.push(key)
                    }
                })
                if (notfound.length != 0) {
                    res.status(400).send({ msg: ` ${notfound.join(",")} notfound.` })
                    return
                }
            } else {
                console.log(req.body);
                res.status(400).send({ msg: "expectation failed." })
                return
            }
        }
        next()
    }
}


module.exports = { logger, checkBody, emptyBodyChecker, emptyQueryChecker };