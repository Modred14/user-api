import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";
import whois from "whois-json";

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

interface WhoisResponse {
  domainName?: string;
  registrar?: string;
}

let users: User[] = [];
let customDomains: Domain[] = [];

app.get("/users", (req: Request, res: Response) => {
  res.json(users);
});

app.post("/users", (req: Request, res: Response) => {
  const { firstName, lastName, username, email, password, profileImg, links } =
    req.body;

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
app.put("/users/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, username, email, password, profileImg, links } =
    req.body;

  const userIndex = users.findIndex((user) => user.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found" });
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
  res.json(updatedUser);
});

app.delete("/users/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const userIndex = users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found" });
  }

  users.splice(userIndex, 1);
  res.status(200).json({ message: "User deleted successfully" });
});

app.post("/users/:userId/links", (req: Request, res: Response) => {
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
app.get("/check-domain", async (req: Request, res: Response) => {
  const { domain } = req.query as { domain: string };
  try {
    const result = await whois(domain) as WhoisResponse;
    console.log(result); // Log the WHOIS data for debugging

    // Check if the WHOIS data indicates the domain is registered
    const isAvailable = !result.domainName && !result.registrar;
    res.json({ available: isAvailable });
  } catch (error) {
    console.error("Error checking domain:", error);
    res.status(500).json({ error: "Error checking domain" });
  }
});

app.post("/add-domain", (req: Request, res: Response) => {
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

app.get("/get-domains", (req: Request, res: Response) => {
  res.json({ domains: customDomains });
});

app.delete("/remove-domain", (req: Request, res: Response) => {
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

app.put("/update-domain", (req: Request, res: Response) => {
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

app.listen(PORT, () => {
  console.log("Server running at http://localhost:${PORT}");
});
