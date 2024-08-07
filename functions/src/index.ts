// /**
//  * Import function triggers from their respective submodules:
//  *
//  * import {onCall} from "firebase-functions/v2/https";
//  * import {onDocumentWritten} from "firebase-functions/v2/firestore";
//  *
//  * See a full list of supported triggers at https://firebase.google.com/docs/functions
//  */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript

// // export const helloWorld = onRequest((request, response) => {
// //   logger.info("Hello logs!", {structuredData: true});
// //   response.send("Hello from Firebase!");
// // });
import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import * as bodyParser from "body-parser";
import {v4 as uuidv4} from "uuid";
import whois from "whois-json";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  profileImg: string;
  links: Link[];
}

interface CustomDomains {
  id: string;
  domain: string;
}
const users: User[] = [];
const customDomains: CustomDomains[] = [];

interface Link {
  id: string;
  title: string;
  mainLink: string;
  shortenedLink: string;
  qrcode: string;
  customLink: string;
  clicks: number;
  visits: string[];
  createdAt: Date;
}

interface WhoisResponse {
  domainName?: string;
  registrar?: string;
}

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", (req, res) => {
  const {firstName, lastName, username, email, password, profileImg, links} =
    req.body;

  const formattedLinks = links ?
    links.map((link: Link) => ({
      id: uuidv4(),
      title: link.title || link.mainLink,
      mainLink: link.mainLink,
      shortenedLink: link.shortenedLink,
      qrcode: link.qrcode,
      customLink: link.customLink,
      clicks: link.clicks || 0,
      visits: link.visits || [],
      createdAt: link.createdAt || new Date().toISOString(),
    })) :
    [];

  const newUser = {
    id: uuidv4(),
    firstName,
    lastName,
    username,
    email,
    password,
    profileImg:
      profileImg ||
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    links: formattedLinks,
  };

  users.push(newUser);
  res.status(201).json(newUser);
});

app.post("/login", (req, res) => {
  const {email, password} = req.body;

  const user = users.find((user) => user.email === email);
  if (!user) {
    return res.status(401).json({message: "User not found. Please Sign Up."});
  }

  if (user.password !== password) {
    return res.status(401).json({message: "Invalid email or password"});
  }

  return res.status(200).json({message: "Login successful", user});
});

// Endpoint to increment link clicks and add visit
app.post("/links/:linkId/click", (req, res) => {
  const {linkId} = req.params;
  const user = users.find((user) =>
    user.links.some((link: Link) => link.id === linkId)
  );

  if (!user) {
    return res.status(404).json({message: "Link not found"});
  }

  const link = user.links.find((link: Link) => link.id === linkId);
  if (link) {
    link.clicks += 1;
    link.visits.push(new Date().toISOString());
    return res.status(200).json(link);
  } else {
    return res.status(404).json({message: "Link not found"});
  }
});
app.put("/users/:id", (req, res) => {
  const {id} = req.params;
  const {firstName, lastName, username, email, password, profileImg, links} =
    req.body;

  const userIndex = users.findIndex((user) => user.id === id);
  if (userIndex === -1) {
    return res.status(404).json({message: "User not found"});
  }

  const updatedUser = {
    ...users[userIndex],
    firstName,
    lastName,
    username,
    email,
    password,
    profileImg,
    links,
  };

  users[userIndex] = updatedUser;
  return res.json(updatedUser);
});

app.delete("/users/:id", (req, res) => {
  const {id} = req.params;
  const userIndex = users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    return res.status(404).json({message: "User not found"});
  }

  users.splice(userIndex, 1);
  return res.status(200).json({message: "User deleted successfully"});
});

app.post("/users/:userId/links", (req, res) => {
  const {userId} = req.params;
  const {
    title,
    mainLink,
    shortenedLink,
    qrcode,
    customLink,
    clicks,
    visits,
    createdAt,
  } = req.body;

  const user = users.find((user) => user.id === userId);
  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const newLink = {
    id: uuidv4(),
    title: title || mainLink,
    mainLink,
    shortenedLink,
    qrcode,
    customLink,
    clicks: clicks || 0,
    visits: visits || [],
    createdAt: createdAt || new Date().toISOString(),
  };

  user.links.push(newLink);
  return res.status(201).json(newLink);
});

app.put("/users/:userId/links/:linkId", (req, res) => {
  const {userId, linkId} = req.params;
  const {title, mainLink, shortenedLink, qrcode, customLink} = req.body;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const link = user.links.find((link: Link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({message: "Link not found"});
  }

  link.title = title || link.title;
  link.mainLink = mainLink || link.mainLink;
  link.shortenedLink = shortenedLink || link.shortenedLink;
  link.qrcode = qrcode || link.qrcode;
  link.customLink = customLink || link.customLink;

  return res.status(200).json(link);
});

app.delete("/users/:userId/links/:linkId", (req, res) => {
  const {userId, linkId} = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const linkIndex = user.links.findIndex((link: Link) => link.id === linkId);

  if (linkIndex === -1) {
    return res.status(404).json({message: "Link not found"});
  }

  user.links.splice(linkIndex, 1);

  return res.status(204).send();
});

app.get("/users/:userId/links", (req, res) => {
  const {userId} = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  return res.status(200).json(user.links);
});

app.get("/users/:userId/links/:linkId", (req, res) => {
  const {userId, linkId} = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const link = user.links.find((link: Link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({message: "Link not found"});
  }

  return res.status(200).json(link);
});

app.put("/users/:userId/links/:linkId", (req, res) => {
  const {userId, linkId} = req.params;
  const {
    title,
    mainLink,
    shortenedLink,
    qrcode,
    customLink,
    clicks,
    visits,
    createdAt,
  } = req.body;

  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const link = user.links.find((link: Link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({message: "Link not found"});
  }

  link.title = title || link.title;
  link.mainLink = mainLink || link.mainLink;
  link.shortenedLink = shortenedLink || link.shortenedLink;
  link.qrcode = qrcode || link.qrcode;
  link.customLink = customLink || link.customLink;
  link.clicks = clicks !== undefined ? clicks : link.clicks;
  link.visits = visits || link.visits;
  link.createdAt = createdAt || link.createdAt;

  return res.status(200).json(link);
});

app.delete("/users/:userId/links/:linkId", (req, res) => {
  const {userId, linkId} = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({message: "User not found"});
  }

  const linkIndex = user.links.findIndex((link: Link) => link.id === linkId);

  if (linkIndex === -1) {
    return res.status(404).json({message: "Link not found"});
  }

  user.links.splice(linkIndex, 1);

  return res.status(204).send();
});
app.get("/check-domain", async (req, res) => {
  const domain = req.query.domain as string;
  try {
    const result = (await whois(domain)) as WhoisResponse;
    console.log(result); // Log the WHOIS data for debugging

    // Check if the WHOIS data indicates the domain is registered
    const isAvailable = !result.domainName && !result.registrar;
    return res.json({available: isAvailable});
  } catch (error) {
    console.error("Error checking domain:", error);
    return res.status(500).json({error: "Error checking domain"});
  }
});

app.post("/add-domain", (req, res) => {
  const {id, domain} = req.body;
  if (domain && !customDomains.some((d) => d.domain === domain)) {
    customDomains.push({id, domain});
    res.json({
      success: true,
      message: "Domain added",
      domains: customDomains,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Domain already exists or invalid",
      domains: customDomains,
    });
  }
});

app.get("/get-domains", (req, res) => {
  res.json({domains: customDomains});
});

app.delete("/remove-domain", (req, res) => {
  const {id} = req.body;
  const index = customDomains.findIndex((d) => d.id === id);
  if (index !== -1) {
    customDomains.splice(index, 1);
    res.json({
      success: true,
      message: "Domain removed",
      domains: customDomains,
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Domain not found",
      domains: customDomains,
    });
  }
});

app.put("/update-domain", (req, res) => {
  const {id, newDomain} = req.body;
  const index = customDomains.findIndex((d) => d.id === id);
  if (index !== -1) {
    if (!customDomains.some((d) => d.domain === newDomain)) {
      customDomains[index].domain = newDomain;
      res.json({
        success: true,
        message: "Domain updated",
        domains: customDomains,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "New domain already exists",
        domains: customDomains,
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: "Domain not found",
      domains: customDomains,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export const api = functions.https.onRequest(app);
