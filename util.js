const { Mongoose } = require("mongoose");

/**
 * sends 500 error with error server side any other un handel error.
 * 
 * @param {express.res} res 
 * @param {Error} err 
 * 
 */
function erroResponse(res, err) {
    console.log(err.code);
    if (err?.code == 11000) {
        res.status(400).send({ msg: err.message })
    }
    res.status(500).send({ msg: err.message })
}



module.exports = { erroResponse }