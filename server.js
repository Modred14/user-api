"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const uuid_1 = require("uuid");
const whois_json_1 = __importDefault(require("whois-json"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
let users = [];
let customDomains = [];
app.get("/users", (req, res) => {
    res.json(users);
});
app.post("/users", (req, res) => {
    const { firstName, lastName, username, email, password, profileImg, links } = req.body;
    const formattedLinks = links
        ? links.map((link) => ({
            id: (0, uuid_1.v4)(),
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
        id: (0, uuid_1.v4)(),
        firstName,
        lastName,
        username,
        email,
        password,
        profileImg: profileImg ||
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        links: formattedLinks,
    };
    users.push(newUser);
    res.status(201).json(newUser);
});
app.post("/login", (req, res) => {
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
app.post("/links/:linkId/click", (req, res) => {
    const { linkId } = req.params;
    const user = users.find((user) => user.links.some((link) => link.id === linkId));
    if (!user) {
        return res.status(404).json({ message: "Link not found" });
    }
    const link = user.links.find((link) => link.id === linkId);
    if (link) {
        link.clicks += 1;
        link.visits.push(new Date().toISOString());
        res.status(200).json(link);
    }
    else {
        return res.status(404).json({ message: "Link not found" });
    }
});
app.put("/users/:id", (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, username, email, password, profileImg, links } = req.body;
    const userIndex = users.findIndex((user) => user.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
    }
    const updatedUser = Object.assign(Object.assign({}, users[userIndex]), { firstName,
        lastName,
        username,
        email,
        password,
        profileImg,
        links });
    users[userIndex] = updatedUser;
    res.json(updatedUser);
});
app.delete("/users/:id", (req, res) => {
    const { id } = req.params;
    const userIndex = users.findIndex((user) => user.id === id);
    if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
    }
    users.splice(userIndex, 1);
    res.status(200).json({ message: "User deleted successfully" });
});
app.post("/users/:userId/links", (req, res) => {
    const { userId } = req.params;
    const { title, mainLink, shortenedLink, qrcode, customLink, clicks, visits, createdAt, } = req.body;
    const user = users.find((user) => user.id === userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    const newLink = {
        id: (0, uuid_1.v4)(),
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
app.put("/users/:userId/links/:linkId", (req, res) => {
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
app.delete("/users/:userId/links/:linkId", (req, res) => {
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
app.get("/users/:userId/links", (req, res) => {
    const { userId } = req.params;
    const user = users.find((user) => user.id === userId);
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user.links);
});
app.get("/users/:userId/links/:linkId", (req, res) => {
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
app.put("/users/:userId/links/:linkId", (req, res) => {
    const { userId, linkId } = req.params;
    const { title, mainLink, shortenedLink, qrcode, customLink, clicks, visits, createdAt, } = req.body;
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
app.delete("/users/:userId/links/:linkId", (req, res) => {
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
app.get("/check-domain", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { domain } = req.query;
    try {
        const result = yield (0, whois_json_1.default)(domain);
        console.log(result); // Log the WHOIS data for debugging
        // Check if the WHOIS data indicates the domain is registered
        const isAvailable = !result.domainName && !result.registrar;
        res.json({ available: isAvailable });
    }
    catch (error) {
        console.error("Error checking domain:", error);
        res.status(500).json({ error: "Error checking domain" });
    }
}));
app.post("/add-domain", (req, res) => {
    const { id, domain } = req.body;
    if (domain && !customDomains.some((d) => d.domain === domain)) {
        customDomains.push({ id, domain });
        res.json({
            success: true,
            message: "Domain added",
            domains: customDomains,
        });
    }
    else {
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
app.delete("/remove-domain", (req, res) => {
    const { id } = req.body;
    const index = customDomains.findIndex((d) => d.id === id);
    if (index !== -1) {
        customDomains.splice(index, 1);
        res.json({
            success: true,
            message: "Domain removed",
            domains: customDomains,
        });
    }
    else {
        res.status(400).json({
            success: false,
            message: "Domain not found",
            domains: customDomains,
        });
    }
});
app.put("/update-domain", (req, res) => {
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
        }
        else {
            res.status(400).json({
                success: false,
                message: "New domain already exists",
                domains: customDomains,
            });
        }
    }
    else {
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
