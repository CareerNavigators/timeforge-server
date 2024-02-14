const { User, Meeting, Note, Attendee } = require("./schema");
const mongo = require('mongoose');
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
        if (result?.content) {
            res.status(202).send({ msg: "Note Updated" })
        } else {
            res.status(202).send(result)
        }
        return
    } catch (e) {
        erroResponse(res, e)
        return
    }
}

/**
 * Delete the user with given id. It also delete all the data associate with the user
 * @param {string} id - user id 
 * 
 * @returns
 * All the delete result or error message
 */
async function DeleteUser(id) {
    try {
        const userResult = await User.findByIdAndDelete(id)
        const allResult = await DeleteMeeting(id)
        let response;
        if (userResult?._id) {
            response={msg:"User Deleted Successfully"}
        }
        return { ...allResult, userResult }
    } catch (e) {
        return { error: true, msg: e.message }
    }

}

/**
 * This function take user id then delete all the meeting associate with the user
 * @param {string} id - user id
 * 
 * @returns
 * All the delete result or error message
 */
async function DeleteMeeting(id) {
    try {
        const meetings = await Meeting.where("createdBy").equals(id)
        for (const meeting of meetings) {
             await Note.deleteMany({ meeting: new mongo.Types.ObjectId(meeting._id) })
             await Attendee.deleteMany({ event: new mongo.Types.ObjectId(meeting._id) })
        }
        await Meeting.deleteMany({ createdBy: new mongo.Types.ObjectId(id) })
        return {msg:"Meeting, Note and Attendee Delete successfully" }
    } catch (e) {
        return { error: true, msg: e.message }
    }

}


module.exports = { erroResponse, UpdateHelper, DeleteUser, DeleteMeeting }