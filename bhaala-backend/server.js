const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/bhaalaUsers")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
 email:String,
 password:String
});

const User = mongoose.model("User",UserSchema);

// Login Route
app.post("/login", async(req,res)=>{

 const {email,password} = req.body;

 const newUser = new User({
  email:email,
  password:password
 });

 await newUser.save();

 console.log("User saved:",email);

 res.redirect("/Bhaala.html");
});

// Server
app.listen(3000,()=>{
 console.log("Server running on http://localhost:3000");
});