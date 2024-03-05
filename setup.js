require("dotenv").config();
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const config = {
  service: "gmail",
  auth: {
    user: process.env.MAIL,
    pass: process.env.PASS,
  },
};
const mailTransporter = nodemailer.createTransport(config);

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);
 module.exports={
    oauth2Client,
    mailTransporter
 }
