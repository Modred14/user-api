const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

let users = [];


app.get('/users', (req, res) => {
  res.json(users);
});


app.post('/users', (req, res) => {
  const { firstName, lastName, username, email, password, profileImg, links } = req.body;
  const newUser = {
    id: uuidv4(),
    firstName,
    lastName,
    username,
    email,
    password,
    profileImg: profileImg || "./circle.png",
    links: links || []
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
