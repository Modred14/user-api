import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import whois from "whois-json";
import admin from "firebase-admin";
// Initialize Firebase
const serviceAccount = require("./scissors-altschool-favour-firebase-adminsdk-3jha8-3f022b5646.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://scissors-altschool-favour-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

interface Link {
  id: string;
  title: string;
  mainLink: string;
  shortenedLink: string;
  qrcode: string;
  customLink: string;
  clicks: number;
  visits: string[];
  createdAt: string;
}

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

interface Domain {
  id: string;
  domain: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: admin.auth.DecodedIdToken;
  }
}

interface WhoisResponse {
  domainName?: string;
  registrar?: string;
  createdDate?: string;
  status?: string;
  updatedDate?: string;
}

let users: User[] = [];


app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hi there, welcome to Scissors backend api." });
});

app.get("/users", async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (email) {
      // Query the database to check if the email exists
      const usersSnapshot = await db.collection("users").where("email", "==", email).get();

      if (usersSnapshot.empty) {
        return res.status(404).json({ exists: false });
      }

      const users = usersSnapshot.docs.map((doc) => doc.data());
      return res.json({ exists: true, user: users[0] });
    }
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => doc.data());
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
});

app.post("/users", async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, profileImg, links } =
    req.body;

    console.log("Received data:", req.body);
  const formattedLinks = links
    ? links.map((link: Partial<Link>) => ({
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
    id: uuidv4(),
    firstName,
    lastName,
    email,
    password,
    profileImg:
      profileImg ||
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    links: formattedLinks,
  };

  try {
    await db.collection("users").doc(newUser.id).set(newUser);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: "Error saving user", error });
  }
});

const authenticateUser = async (req: Request, res: Response, next: Function) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

app.get("/protected", authenticateUser, (req: Request, res: Response) => {
  res.json({ message: "This is a protected route" });
});

app.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);
  if (!user) {
    return res.status(401).json({ message: "User not found. Please Sign Up." });
  }

  if (user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.status(200).json({ message: "Login successful", user });
});

// Endpoint to increment link clicks and add visit
app.post("/links/:linkId/click", (req: Request, res: Response) => {
  const { linkId } = req.params;
  const user = users.find((user) =>
    user.links.some((link) => link.id === linkId)
  );

  if (!user) {
    return res.status(404).json({ message: "Link not found" });
  }

  const link = user.links.find((link) => link.id === linkId);
  if (link) {
    link.clicks += 1;
    link.visits.push(new Date().toISOString());

    res.status(200).json(link);
  } else {
    return res.status(404).json({ message: "Link not found" });
  }
});
app.put("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, username, email, password, profileImg, links } =
    req.body;

  try {
    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = {
      ...userDoc.data(),
      firstName,
      lastName,
      username,
      email,
      password,
      profileImg,
      links,
    };

    await userRef.set(updatedUser);
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Error updating user", error });
  }
});

app.delete("/users/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    await userRef.delete();
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error });
  }
});

app.post("/users/:userId/links", async (req: Request, res: Response) => {
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

  const user = users.find((user) => user.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
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
  res.status(201).json(newLink);
});

app.put("/users/:userId/links/:linkId", (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  const { title, mainLink, shortenedLink, qrcode, customLink } = req.body;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const link = user.links.find((link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({ message: "Link not found" });
  }

  link.title = title || link.title;
  link.mainLink = mainLink || link.mainLink;
  link.shortenedLink = shortenedLink || link.shortenedLink;
  link.qrcode = qrcode || link.qrcode;
  link.customLink = customLink || link.customLink;

  res.status(200).json(link);
});

app.delete("/users/:userId/links/:linkId", (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const linkIndex = user.links.findIndex((link) => link.id === linkId);

  if (linkIndex === -1) {
    return res.status(404).json({ message: "Link not found" });
  }

  user.links.splice(linkIndex, 1);

  res.status(204).send();
});

app.get("/users/:userId/links", (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json(user.links);
});

app.get("/users/:userId/links/:linkId", (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const link = user.links.find((link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({ message: "Link not found" });
  }

  res.status(200).json(link);
});

app.put("/users/:userId/links/:linkId", (req: Request, res: Response) => {
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

  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const link = user.links.find((link) => link.id === linkId);

  if (!link) {
    return res.status(404).json({ message: "Link not found" });
  }

  link.title = title || link.title;
  link.mainLink = mainLink || link.mainLink;
  link.shortenedLink = shortenedLink || link.shortenedLink;
  link.qrcode = qrcode || link.qrcode;
  link.customLink = customLink || link.customLink;
  link.clicks = clicks !== undefined ? clicks : link.clicks;
  link.visits = visits || link.visits;
  link.createdAt = createdAt || link.createdAt;

  res.status(200).json(link);
});

app.delete("/users/:userId/links/:linkId", (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const linkIndex = user.links.findIndex((link) => link.id === linkId);

  if (linkIndex === -1) {
    return res.status(404).json({ message: "Link not found" });
  }

  user.links.splice(linkIndex, 1);

  res.status(204).send();
});

// Endpoint to create a short URL
app.post("/api/urls/shorten", async (req: Request, res: Response) => {
  const { longUrl, shortUrl } = req.body;
  try {
    // Save short URL to Firestore
    await db.collection("shortUrls").doc(shortUrl).set({
      longUrl,
      shortUrl,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: "Short URL created!", shortUrl });
  } catch (error) {
    res.status(500).json({ message: "Error saving short URL", error });
  }
});

// Endpoint to redirect short URL to the long URL
app.get("/:shortUrl", async (req: Request, res: Response) => {
  const { shortUrl } = req.params;
  try {
    // Retrieve long URL from Firestore
    const shortUrlDoc = await db.collection("shortUrls").doc(shortUrl).get();

    if (shortUrlDoc.exists) {
      const { longUrl } = shortUrlDoc.data()!;
      res.redirect(longUrl);
    } else {
      res.status(404).json({ message: "URL not found!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error retrieving short URL", error });
  }
});

app.get("/check-domain", async (req: Request, res: Response) => {
  const { domain } = req.query as { domain: string };

  try {
    const result = (await whois(domain)) as WhoisResponse;
    const isAvailable = !result.domainName && !result.registrar;
    const otherFieldsIndicatingAvailability =
      !result.status && !result.createdDate && !result.updatedDate;

    res.json({ available: isAvailable && otherFieldsIndicatingAvailability });
  } catch (error) {
    res.status(500).json({ error: "Error checking domain" });
  }
});

app.post("/add-domain", async (req: Request, res: Response) => {
  const { id, domain } = req.body;
  try {
    const domainRef = db.collection("domains").doc(id);
    const domainDoc = await domainRef.get();

    if (domainDoc.exists) {
      return res.status(400).json({ message: "Domain already exists" });
    }

    await domainRef.set({ id, domain });
    res.json({ success: true, message: "Domain added" });
  } catch (error) {
    res.status(500).json({ message: "Error adding domain", error });
  }
});

app.get("/get-domains", async (req: Request, res: Response) => {
  try {
    const domainsSnapshot = await db.collection("domains").get();
    const domains = domainsSnapshot.docs.map((doc) => doc.data());
    res.json({ domains });
  } catch (error) {
    res.status(500).json({ message: "Error fetching domains", error });
  }
});

app.delete("/remove-domain", async (req: Request, res: Response) => {
  const { domain } = req.body;
  try {
    const domainQuerySnapshot = await db
      .collection("domains")
      .where("domain", "==", domain)
      .get();
    const domainDoc = domainQuerySnapshot.docs[0];

    if (!domainDoc) {
      return res.status(400).json({ message: "Domain not found" });
    }

    await domainDoc.ref.delete();
    res.json({ success: true, message: "Domain removed" });
  } catch (error) {
    res.status(500).json({ message: "Error removing domain", error });
  }
});

app.put("/update-domain", async (req: Request, res: Response) => {
  const { id, newDomain } = req.body;

  try {
    const domainRef = db.collection("domains").doc(id);
    const domainDoc = await domainRef.get();

    if (!domainDoc.exists) {
      return res.status(400).json({ message: "Domain not found" });
    }

    const domainExistsQuerySnapshot = await db
      .collection("domains")
      .where("domain", "==", newDomain)
      .get();

    if (!domainExistsQuerySnapshot.empty) {
      return res.status(400).json({ message: "New domain already exists" });
    }

    await domainRef.update({ domain: newDomain });
    res.json({ success: true, message: "Domain updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating domain", error });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
