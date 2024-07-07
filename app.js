const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const upload = require("./utils/multerconfig");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

const secret = process.env.JWT_SECRET || "your_jwt_secret";

app.get("/login", (req, res) => {
  res.render("login");
});
app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await userModel.findOne({ email });
  if (!user) return res.status(500).send("Wrong email or password");

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, usrid: user._id }, secret);
      res.cookie("token", token);
      res.status(200).send("Logged in successfully");
    } else {
      res.redirect("/login");
    }
  });
});

app.get("/upload", isLoggedIn, (req, res) => {
  res.render("upload");
});

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  res.redirect("/profile");
});

app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts");
  let posts = user.posts;
  res.render("profile", { user, posts });
});

app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.usrid) === -1) {
    post.likes.push(req.user.usrid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.usrid), 1);
  }
  await post.save();
  res.redirect("/profile");
});

app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

app.get("/delete/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post) {
    await postModel.deleteOne({ _id: req.params.id });
  }
  res.redirect("/profile");
});

app.get("/register", (req, res) => {
  res.render("index");
});

app.post("/register", async (req, res) => {
  try {
    let { email, name, password, username, age } = req.body;
    let user = await userModel.findOne({ email });
    if (user) {
      return res.status(400).send("User Already Exists");
    }

    bcrypt.genSalt(10, async (err, salt) => {
      if (err) {
        console.error("Error generating salt:", err);
        return res.status(500).send("Error generating salt");
      }

      try {
        let hash = await bcrypt.hash(password, salt);
        let newUser = await userModel.create({
          username,
          email,
          age,
          name,
          password: hash,
        });
        let token = jwt.sign({ email: email, usrid: newUser._id }, secret);
        res.cookie("token", token);
        res.status(200).send("Registered successfully");
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).send("Error creating user");
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Registration error");
  }
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postModel.create({ user: user._id, content: content });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

app.get("/logout", (req, res) => {
  res.cookie("token", "", { maxAge: 1 });
  res.redirect("/login");
});

function isLoggedIn(req, res, next) {
  let token = req.cookies.token;
  if (!token) {
    res.redirect("/login");
  } else {
    try {
      let data = jwt.verify(token, secret);
      req.user = data;
      next();
    } catch (err) {
      res.redirect("/login");
    }
  }
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
