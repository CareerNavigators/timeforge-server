const { User, Meeting, Note, Attendee, Timeline, Token } = require("./schema");
const mongo = require("mongoose");
const { oauth2Client } = require("./setup");
const calendar = require("googleapis").google.calendar("v3");
/**
 * sends error with error server side any other un handel error.
 *
 * @param {express.res} res
 * @param {Error} err
 *
 */
function erroResponse(res, err) {
  console.log(err);
  if (err?.code == 11000) {
    res.status(400).send({ msg: err.message });
  }
  res.status(500).send({ msg: err.message });
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
    let modelKeys = Object.keys(doc.schema.paths);
    for (const key of Object.keys(body)) {
      if (!modelKeys.includes(key)) {
        res
          .status(400)
          .send({ msg: `'${key}' is not a valid key. Update failed.` });
        return;
      } else {
        doc[key] = body[key];
      }
    }
    let result = await doc.save();
    if (result?.content) {
      res.status(202).send({ msg: "Note Updated" });
    } else {
      res.status(202).send(result);
    }
    return;
  } catch (e) {
    erroResponse(res, e);
    return;
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
    const userResult = await User.findByIdAndDelete(id);
    const allResult = await DeleteMeeting(id);
    let response;
    if (userResult?._id) {
      response = { msg: "User Deleted Successfully" };
    }
    return { ...allResult, userResult };
  } catch (e) {
    return { error: true, msg: e.message };
  }
}

/**
 * This function take user id then delete all the meeting associate with the user
 * @param {string} id - user id
 *
 * @returns
 * All the delete result or error message
 */
async function DeleteMeeting(id, updateUser = false) {
  try {
    const meetings = await Meeting.where("createdBy").equals(id);
    for (const meeting of meetings) {
      await Note.deleteMany({ meeting: new mongo.Types.ObjectId(meeting._id) });
      await Attendee.deleteMany({
        event: new mongo.Types.ObjectId(meeting._id),
      });
      await Timeline.deleteMany({
        event: new mongo.Types.ObjectId(meeting._id),
      });
    }
    await Meeting.deleteMany({ createdBy: new mongo.Types.ObjectId(id) });
    if (updateUser) {
      await User.findByIdAndUpdate(id, { totalMeeting: 0 });
    }
    return { msg: "Meeting, Note and Attendee Delete successfully" };
  } catch (e) {
    return { error: true, msg: e.message };
  }
}
/**
 * google image profile have `=s96-c` which makes image smaller. this function just remove it
 * @param {String} mainString
 * @param {String} compareString
 * @returns {String} - return mainString if mainString does not contain the compareString. otherwise cut it then return it
 *
 */
function ProfileImageSizeCutter(mainString, compareString = "=s96-c") {
  const lastSix = mainString.slice(-6);
  if (lastSix === compareString) {
    return mainString.slice(0, -6);
  } else {
    return mainString;
  }
}
/**
 * Set credential of oauth2Client
 * @param {String} userID - user._id
 * @param {res} res - express res
 * @returns 
 * true - if everything ok
 * 400 - if token notfound
 * false - token not and res not found
 */
async function setCreadential(userID, res=null) {
  const userToken = await Token.findOne({
    user: new mongo.Types.ObjectId(userID),
  });
  if (userToken) {
    oauth2Client.setCredentials({
      refresh_token: userToken.refreshToken,
    });
    console.log("creadentialSet");
    return true
  } else if (res) {
    return res.status(400).send({ msg: "Authorize First" });
  }else{
    return false
  }
}
/**
 * Return TimeForge calendarId. but can be used for other calendar. Must call setCreadential function before
 * @param {String} calendarName - CalendarName you are searching
 * @returns
 * false - if not found
 * calendarId - if found
 */
async function GetCalendarId(calendarName="TimeForge") {
    const response = await calendar.calendarList.list({
      auth: oauth2Client,
    });
    const calendars = response.data.items;
    let calendarId = false;
    for (const calendar of calendars) {
      if (calendar.summary === calendarName) {
        calendarId = calendar.id;
        break;
      }
    }
    return calendarId
    
}

module.exports = {
  erroResponse,
  UpdateHelper,
  DeleteUser,
  DeleteMeeting,
  ProfileImageSizeCutter,
  setCreadential,
  GetCalendarId
};
