const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const whois = require("whois-json");
const admin = require("firebase-admin");

const serviceAccount = require("./firebaseServiceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

let customDomains = [];

// Users API
app.get("/users", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Error getting users" });
  }
});

app.post("/users", async (req, res) => {
  const { firstName, lastName, username, email, password, profileImg, links } =
    req.body;

  const formattedLinks = links
    ? links.map((link) => ({
        id: uuidv4(),
        title: link.title || link.mainLink,
        mainLink: link.mainLink,
        shortenedLink: link.shortenedLink,
        qrcode: link.qrcode,
        customLink: link.customLink,
        clicks: link.clicks || 0,
        visits: link.visits || [],
        createdAt: link.createdAt || new Date().toISOString(),
      }))
    : [];

  const newUser = {
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

  try {
    const userRef = await db.collection("users").add(newUser);
    res.status(201).json({ id: userRef.id, ...newUser });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Error adding user" });
  }
});

app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, username, email, password, profileImg, links } =
    req.body;

  const updatedUser = {
    firstName,
    lastName,
    username,
    email,
    password,
    profileImg,
    links,
  };

  try {
    const userRef = db.collection("users").doc(id);
    await userRef.set(updatedUser, { merge: true });
    res.json({ id, ...updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Error updating user" });
  }
});

app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("users").doc(id).delete();
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// Links API
app.post("/links/:linkId/click", async (req, res) => {
  const { linkId } = req.params;

  try {
    const usersSnapshot = await db
      .collection("users")
      .where("links", "array-contains", { id: linkId })
      .get();
    if (usersSnapshot.empty) {
      return res.status(404).json({ message: "Link not found" });
    }

    const userRef = usersSnapshot.docs[0].ref;
    const user = usersSnapshot.docs[0].data();
    const linkIndex = user.links.findIndex((link) => link.id === linkId);

    user.links[linkIndex].clicks += 1;
    user.links[linkIndex].visits.push(new Date().toISOString());

    await userRef.update({ links: user.links });

    res.status(200).json(user.links[linkIndex]);
  } catch (error) {
    console.error("Error incrementing link clicks:", error);
    res.status(500).json({ error: "Error incrementing link clicks" });
  }
});

app.post("/users/:userId/links", async (req, res) => {
  const { userId } = req.params;
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

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    user.links.push(newLink);
    await userRef.update({ links: user.links });

    res.status(201).json(newLink);
  } catch (error) {
    console.error("Error adding link:", error);
    res.status(500).json({ error: "Error adding link" });
  }
});

app.put("/users/:userId/links/:linkId", async (req, res) => {
  const { userId, linkId } = req.params;
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

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    const linkIndex = user.links.findIndex((link) => link.id === linkId);
    if (linkIndex === -1) {
      return res.status(404).json({ message: "Link not found" });
    }

    const updatedLink = {
      ...user.links[linkIndex],
      title: title || user.links[linkIndex].title,
      mainLink: mainLink || user.links[linkIndex].mainLink,
      shortenedLink: shortenedLink || user.links[linkIndex].shortenedLink,
      qrcode: qrcode || user.links[linkIndex].qrcode,
      customLink: customLink || user.links[linkIndex].customLink,
      clicks: clicks !== undefined ? clicks : user.links[linkIndex].clicks,
      visits: visits || user.links[linkIndex].visits,
      createdAt: createdAt || user.links[linkIndex].createdAt,
    };

    user.links[linkIndex] = updatedLink;
    await userRef.update({ links: user.links });

    res.status(200).json(updatedLink);
  } catch (error) {
    console.error("Error updating link:", error);
    res.status(500).json({ error: "Error updating link" });
  }
});

app.delete("/users/:userId/links/:linkId", async (req, res) => {
  const { userId, linkId } = req.params;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    const linkIndex = user.links.findIndex((link) => link.id === linkId);
    if (linkIndex === -1) {
      return res.status(404).json({ message: "Link not found" });
    }

    user.links.splice(linkIndex, 1);
    await userRef.update({ links: user.links });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting link:", error);
    res.status(500).json({ error: "Error deleting link" });
  }
});

app.get("/users/:userId/links", async (req, res) => {
  const { userId } = req.params;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    res.status(200).json(user.links);
  } catch (error) {
    console.error("Error getting links:", error);
    res.status(500).json({ error: "Error getting links" });
  }
});

app.get("/users/:userId/links/:linkId", async (req, res) => {
  const { userId, linkId } = req.params;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    const link = user.links.find((link) => link.id === linkId);
    if (!link) {
      return res.status(404).json({ message: "Link not found" });
    }

    res.status(200).json(link);
  } catch (error) {
    console.error("Error getting link:", error);
    res.status(500).json({ error: "Error getting link" });
  }
});

// Domain API
app.get("/check-domain", async (req, res) => {
  const { domain } = req.query;

  try {
    const result = await whois(domain);
    console.log(result); // Log the WHOIS data for debugging

    // Check if the WHOIS data indicates the domain is registered
    const isAvailable = !result.domainName && !result.registrar;
    res.json({ available: isAvailable });
  } catch (error) {
    console.error("Error checking domain:", error);
    res.status(500).json({ error: "Error checking domain" });
  }
});

app.post("/add-domain", async (req, res) => {
  const { id, domain } = req.body;

  if (domain && !customDomains.some((d) => d.domain === domain)) {
    customDomains.push({ id, domain });
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
  res.json({ domains: customDomains });
});

app.delete("/remove-domain", async (req, res) => {
  const { id } = req.body;
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

app.put("/update-domain", async (req, res) => {
  const { id, newDomain } = req.body;
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
