const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

let users = [];

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", (req, res) => {
  const {
    firstName,
    lastName,
    username,
    email,
    password,
    profileImg,
    links,
  } = req.body;
  const newUser = { 
      id: uuidv4(),
      firstName,
      lastName,
      username,
      email,
      password, 
      profileImg: profileImg || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
      links: links || [],
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(user => user.email === email);
  if (!user) {
    return res.status(401).json({ message: "User not found. Please Sign Up." });
  }

  if (user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // Clear password before sending user data back
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password;

  res.status(200).json({ message: "Login successful", user: userWithoutPassword });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
