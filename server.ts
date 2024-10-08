import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import admin from "firebase-admin";

// Initialize Firebase
const serviceAccount = require("./scissors-altschool-favour-firebase-adminsdk-3jha8-3f022b5646.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://scissors-altschool-favour-default-rtdb.firebaseio.com",
});

const db = admin.firestore();
const firebaseAdminAuth = admin.auth();
const app = express();
const PORT = process.env.PORT || 5000;

const getUserLocation = async () => {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Failed to fetch location data:", error);
  }
  return { city: "Unknown" };
};

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

declare module "express-serve-static-core" {
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
      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", email)
        .get();

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
  const { firstName, lastName, email, password, profileImg, links } = req.body;

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
    profileImg:
      profileImg || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
    links: formattedLinks,
    ...(password && { password }),
  };

  try {
    await db.collection("users").doc(newUser.id).set(newUser);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: "Error saving user", error });
  }
});

const authenticateUser = async (
  req: Request,
  res: Response,
  next: Function
) => {
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

app.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const userDoc = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userDoc.empty) {
      return res
        .status(401)
        .json({ message: "User not found. Please Sign Up." });
    }

    const userData = userDoc.docs[0].data();
    const userId = userDoc.docs[0].id;
    try {
      const userCredential = await firebaseAdminAuth.getUserByEmail(email);

      if (!userCredential) {
        return res.status(401).json({ message: "Authentication failed." });
      }

      if (userData.password !== password) {
        await db.collection("users").doc(userId).update({ password });

        console.log("Password updated in Firestore to match Firebase.");
      }

      return res
        .status(200)
        .json({ message: "Login successful", user: userData });
    } catch (err) {
      console.error("Error verifying password with Firebase:", err);
      return res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal Server Error" });
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

app.post("/links/:linkId/click", async (req: Request, res: Response) => {
  const { linkId } = req.params;
  try {
    const userSnapshot = await db
      .collection("users")
      .where("links", "array-contains", { id: linkId })
      .get();

    if (userSnapshot.empty) {
      return res.status(404).json({ message: "Link not found" });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const links = userData.links as Array<{
      id: string;
      clicks: number;
      visits: string[];
    }>;

    const link = links.find((link) => link.id === linkId);
    if (link) {
      link.clicks += 1;
      link.visits.push(new Date().toISOString());

      await db.collection("users").doc(userDoc.id).update({
        links: links,
      });

      res.status(200).json(link);
    } else {
      return res.status(404).json({ message: "Link not found" });
    }
  } catch (error) {
    console.error("Error updating link clicks:", error);
    res.status(500).json({ message: "Internal server error" });
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
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const userRecord = await firebaseAdminAuth.getUserByEmail(email);
    const firebaseUid = userRecord.uid;

    try {
      await firebaseAdminAuth.deleteUser(firebaseUid);
      console.log("User deleted from Firebase Authentication.");
    } catch (error) {
      console.error("Error deleting user from Firebase Authentication:", error);
      return res.status(500).json({
        message: "Failed to delete user from Firebase Authentication.",
      });
    }

    const userRef = db.collection("users").doc(id);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      try {
        await userRef.delete();
        console.log("User document deleted from Firestore.");
        res.status(200).json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user document from Firestore:", error);
        res
          .status(500)
          .json({ message: "Failed to delete user document from Firestore." });
      }
    } else {
      res.status(404).json({ message: "User not found in Firestore" });
    }
  } catch (error) {
    console.error("Error retrieving user by email:", error);
    res.status(500).json({ message: "Error retrieving user by email" });
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

  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    if (!userData) {
      return res.status(404).json({ message: "User data not found" });
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

    const userLinks = userData.links || [];
    userLinks.push(newLink);

    await db.collection("users").doc(userId).update({ links: userLinks });

    res.status(201).json(newLink);
  } catch (error) {
    console.error("Error adding link:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/users/:userId/links/:linkId", async (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  const { title, mainLink, shortenedLink, qrcode, customLink } = req.body;

  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();

    if (!user || !user.links) {
      return res.status(404).json({ message: "Links not found for this user" });
    }

    const linkIndex = user.links.findIndex((link: any) => link.id === linkId);

    if (linkIndex === -1) {
      return res.status(404).json({ message: "Link not found" });
    }

    user.links[linkIndex] = {
      ...user.links[linkIndex],
      title: title || user.links[linkIndex].title,
      mainLink: mainLink || user.links[linkIndex].mainLink,
      shortenedLink: shortenedLink || user.links[linkIndex].shortenedLink,
      qrcode: qrcode || user.links[linkIndex].qrcode,
      customLink: customLink || user.links[linkIndex].customLink,
    };

    await db.collection("users").doc(userId).update({
      links: user.links,
    });

    res.status(200).json(user.links[linkIndex]);
  } catch (error) {
    console.error("Error updating link:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete(
  "/users/:userId/links/:linkId",
  async (req: Request, res: Response) => {
    const { userId, linkId } = req.params;
    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "User not found" });
      }

      const userData = userDoc.data();
      const links = userData?.links || [];

      const linkIndex = links.findIndex((link: any) => link.id === linkId);

      if (linkIndex === -1) {
        return res.status(404).json({ message: "Link not found" });
      }

      links.splice(linkIndex, 1);
      await db.collection("users").doc(userId).update({ links });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error deleting link", error });
    }
  }
);

app.get("/users/:userId/links", async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    const links = userData?.links || [];

    res.status(200).json(links);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user links", error });
  }
});

app.get("/users/:userId/links/:linkId", async (req: Request, res: Response) => {
  const { userId, linkId } = req.params;
  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const links = user.links || [];
    const link = links.find((link: any) => link.id === linkId);

    if (!link) {
      return res.status(404).json({ message: "Link not found" });
    }

    res.status(200).json(link);
  } catch (error) {
    console.error("Error fetching user or link:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/users/:userId/links/:linkId", async (req: Request, res: Response) => {
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
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();

    if (!user || !user.links) {
      return res.status(404).json({ message: "User links not found" });
    }

    const link = user.links.find((link: any) => link.id === linkId);

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

    await db.collection("users").doc(userId).update({ links: user.links });

    res.status(200).json(link);
  } catch (error) {
    console.error("Error updating link:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete(
  "/users/:userId/links/:linkId",
  async (req: Request, res: Response) => {
    const { userId, linkId } = req.params;
    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = userDoc.data();
      if (!user || !user.links) {
        return res.status(404).json({ message: "User links not found" });
      }

      const linkIndex = user.links.findIndex((link: any) => link.id === linkId);

      if (linkIndex === -1) {
        return res.status(404).json({ message: "Link not found" });
      }

      user.links.splice(linkIndex, 1);

      await db.collection("users").doc(userId).update({ links: user.links });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting link:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

app.post("/api/urls/shortenCustom", async (req: Request, res: Response) => {
  const { longUrl, customLink, uniqueId } = req.body;
  try {
    await db.collection("customLinks").doc(customLink).set({
      longUrl,
      customLink,
      uniqueId,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: "Short custom URL created!", customLink });
  } catch (error) {
    res.status(500).json({ message: "Error saving short URL", error });
  }
});

app.post("/api/urls/shorten", async (req: Request, res: Response) => {
  const { longUrl, shortUrl, uniqueId } = req.body;

  try {
    await db.collection("shortUrls").doc(shortUrl).set({
      longUrl,
      shortUrl,
      uniqueId,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: "Short URL created!", shortUrl });
  } catch (error) {
    res.status(500).json({ message: "Error saving short URL", error });
  }
});

app.get("/s/:shortUrl", async (req: Request, res: Response) => {
  const { shortUrl } = req.params;
  try {
    const shortUrlDoc = await db.collection("shortUrls").doc(shortUrl).get();

    if (shortUrlDoc.exists) {
      const { longUrl, createdAt, uniqueId } = shortUrlDoc.data()!;
      const location = await getUserLocation().catch(() => ({
        city: "Unknown",
        country_name: "Unknown",
      }));
    

      const clickData = {
        referrer: req.headers.referer || "direct",
        timestamp: new Date().toISOString(),
        createdAt: createdAt,
        location: {
          city: location.city,
          country: location.country_name,
        },
      };

      await db
        .collection("link_clicks")
        .doc(uniqueId)
        .set(
          {
            clicks: admin.firestore.FieldValue.arrayUnion(clickData),
            clickCount: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        );
      try {
        await fetch(
          `https://app-scissors-api.onrender.com/links/${uniqueId}/click`,
          {
            method: "POST",
          }
        );
      } catch (error) {
        console.error("Error sending click to server:", error);
      }  res.redirect(longUrl);
    } else {
      res.status(404).json({
        message:
          "Oops, Page not found. The page is either broken or deleted or does not exist.",
      });
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: "Error retrieving short URL", error });
    } else {
      console.error("Error after headers sent:", error);
    }
  }
});

app.get(
  "/api/urls/allCustomLinks",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customLinksSnapshot = await db.collection("customLinks").get();

      if (customLinksSnapshot.empty) {
        res.status(404).json({ message: "No custom links found!" });
        return;
      }

      const customLinks: any[] = [];
      customLinksSnapshot.forEach((doc) => {
        customLinks.push(doc.data());
      });

      res.status(200).json(customLinks);
    } catch (error) {
      res.status(500).json({ message: "Error retrieving custom links", error });
    }
  }
);

app.get(
  "/c/:customLink",
  async (req: Request, res: Response): Promise<void> => {
    const { customLink } = req.params;
    try {
      const customLinkDoc = await db
        .collection("customLinks")
        .doc(customLink)
        .get();

      if (customLinkDoc.exists) {
        const { longUrl, createdAt, uniqueId } = customLinkDoc.data()!;
        const location = await getUserLocation().catch(() => ({
          city: "Unknown",
          country_name: "Unknown",
        }));
     
        const clickData = {
          referrer: req.headers.referer || "direct",
          timestamp: new Date().toISOString(),
          createdAt: createdAt,
          location: {
            city: location.city,
            country: location.country_name,
          },
        };
  
        await db
          .collection("link_clicks")
          .doc(uniqueId )
          .set(
            {
              clicks: admin.firestore.FieldValue.arrayUnion(clickData),
              clickCount: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        try {
          await fetch(
            `https://app-scissors-api.onrender.com/links/${uniqueId}/click`,
            {
              method: "POST",
            }
          );
        } catch (error) {
          console.error("Error sending click to server:", error);
        }  res.redirect(longUrl);
      } else {
        res.status(404).json({
          message:
            "Oops, Page not found. The page is either broken or deleted or does not exist.",
        });
      }
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ message: "Error retrieving short URL", error });
      } else {
        console.error("Error after headers sent:", error);
      }
    }
  });

app.get("*", (req, res) => {
  res
    .status(404)
    .send(
      "Oops, Page not found. The page is either broken or deleted or does not exist."
    );
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
