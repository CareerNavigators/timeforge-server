const { Mongoose } = require("mongoose");

/**
 * sends error with error server side any other un handel error.
 * 
 * @param {express.res} res 
 * @param {Error} err 
 * 
 */
function erroResponse(res, err) {
    if (err?.code == 11000) {
        res.status(400).send({ msg: err.message })
    }
    res.status(500).send({ msg: err.message })
}
/**
 * Automatically update the document
 * @param {document} doc 
 * @param {Request.body} body 
 * @param {Response} res 
 * @returns
 * 202-update successfully
 * 400-update failed
 */
async function UpdateHelper(doc, body, res) {
    try {
        let modelKeys = Object.keys(doc.schema.paths)
        for (const key of Object.keys(body)) {
            if (!modelKeys.includes(key)) {
                res.status(400).send({ msg: `'${key}' is not a valid key. Update failed.` })
                return
            } else {
                doc[key] = body[key]
            }
        }
        let result = await doc.save()
        res.status(202).send(result)
        return
    } catch (e) {
        erroResponse(res, e)
        return
    }
}



module.exports = { erroResponse, UpdateHelper }