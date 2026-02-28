const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const session = require("express-session");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

app.use(session({
    secret: "openboardsecret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

/* ================= DATABASE ================= */

const db = mysql.createPool({
    host: "107.180.1.16",
    user: "cis440Spring2026team3",
    password: "cis440Spring2026team3",
    database: "cis440Spring2026team3"
});

/* ================= AUTH ================= */

const users = {
    admin: { password: "admin123", role: "admin", attempts: 0, lockedUntil: null },
    user: { password: "user123", role: "employee", attempts: 0, lockedUntil: null }
};

function requireAuth(req, res, next) {
    if (!req.session.user)
        return res.status(401).json({ error: "Not authenticated." });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin")
        return res.status(403).json({ error: "Admin only." });
    next();
}

app.get("/api/session", (req, res) => {
    if (req.session.user)
        res.json({ loggedIn: true, ...req.session.user });
    else
        res.json({ loggedIn: false });
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const account = users[username];

    if (!account)
        return res.status(401).json({ error: "Invalid credentials." });

    if (account.lockedUntil && account.lockedUntil > Date.now()) {
        const minutesLeft = Math.ceil(
            (account.lockedUntil - Date.now()) / 60000
        );
        return res.status(403).json({
            error: `Account locked. Try again in ${minutesLeft} minutes.`
        });
    }

    if (account.password !== password) {
        account.attempts++;

        if (account.attempts >= 3) {
            account.lockedUntil = Date.now() + 10 * 60 * 1000;
            return res.status(403).json({
                error: "Too many failed attempts. Locked for 10 minutes."
            });
        }

        return res.status(401).json({
            error: `Invalid credentials. Attempt ${account.attempts}/3`
        });
    }

    account.attempts = 0;
    account.lockedUntil = null;

    req.session.user = { username, role: account.role };
    req.session.createdIdeas = [];
    req.session.createdComments = [];

    res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

/* ================= IDEAS ================= */

app.get("/api/ideas", async (req, res) => {

    const [ideas] = await db.query(query, params);

    for (let idea of ideas) {

        // Get comments (management pinned first)
        const [comments] = await db.query(
            `SELECT * FROM comments 
         WHERE idea_id = ?
         ORDER BY 
            CASE WHEN author_role = 'management' THEN 0 ELSE 1 END,
            created_at DESC`,
            [idea.id]
        );

        idea.comments = comments;

        idea.hasManagementResponse = comments.some(
            c => c.author_role === "management"
        );

        // Get user vote
        if (req.session.user) {
            const [vote] = await db.query(
                "SELECT value FROM idea_votes WHERE idea_id = ? AND username = ?",
                [idea.id, req.session.user.username]
            );

            idea.userVote = vote.length ? vote[0].value : 0;
        } else {
            idea.userVote = 0;
        }
    }

    res.json(ideas);

    /* ================= VOTING ================= */

    app.post("/api/ideas/:id/vote", requireAuth, async (req, res) => {

        const value = Number(req.body.value);
        const idea_id = req.params.id;
        const username = req.session.user.username;

        if (![1, -1].includes(value))
            return res.status(400).json({ error: "Invalid vote value." });

        const [existing] = await db.query(
            "SELECT value FROM idea_votes WHERE idea_id = ? AND username = ?",
            [idea_id, username]
        );

        if (existing.length === 0) {

            await db.query(
                "INSERT INTO idea_votes (idea_id, username, value) VALUES (?, ?, ?)",
                [idea_id, username, value]
            );

            await db.query(
                "UPDATE ideas SET score = score + ? WHERE id = ?",
                [value, idea_id]
            );

            return res.json({ success: true });
        }

        const previous = existing[0].value;

        if (previous === value) {

            await db.query(
                "DELETE FROM idea_votes WHERE idea_id = ? AND username = ?",
                [idea_id, username]
            );

            await db.query(
                "UPDATE ideas SET score = score - ? WHERE id = ?",
                [previous, idea_id]
            );

            return res.json({ success: true });
        }

        const delta = value - previous;

        await db.query(
            "UPDATE idea_votes SET value = ? WHERE idea_id = ? AND username = ?",
            [value, idea_id, username]
        );

        await db.query(
            "UPDATE ideas SET score = score + ? WHERE id = ?",
            [delta, idea_id]
        );

        res.json({ success: true });
    });

    /* ================= COMMENTS ================= */

    app.post("/api/ideas/:id/comments", requireAuth, async (req, res) => {
        const { content } = req.body;
        const idea_id = req.params.id;

        if (!content || content.length > 300) {
            return res.status(400).json({ error: "Comment max 300 chars." });
        }

        // Determine if user is admin
        const role = req.session.user.role === "admin"
            ? "management"
            : "employee";

        await db.query(
            "INSERT INTO comments (idea_id, content, author_role, created_at) VALUES (?, ?, ?, NOW())",
            [idea_id, content, role]
        );

        res.json({ success: true });
    });
    app.delete("/api/comments/:id", requireAuth, async (req, res) => {
        const id = parseInt(req.params.id);

        if (
            req.session.user.role === "admin" ||
            req.session.createdComments.includes(id)
        ) {
            await db.query("DELETE FROM comments WHERE id = ?", [id]);
            return res.json({ success: true });
        }

        res.status(403).json({ error: "Not allowed." });
    });

    /* ================= ADMIN ================= */

    app.put("/api/ideas/:id/status", requireAdmin, async (req, res) => {
        const { status } = req.body;
        const id = req.params.id;

        await db.query(
            "UPDATE ideas SET status = ? WHERE id = ?",
            [status, id]
        );

        res.json({ success: true });
    });

    app.get("/api/admin/metrics", requireAdmin, async (req, res) => {

        const [[totalIdeas]] = await db.query(
            "SELECT COUNT(*) AS count FROM ideas"
        );

        const [[totalComments]] = await db.query(
            "SELECT COUNT(*) AS count FROM comments"
        );

        const [byStatus] = await db.query(
            "SELECT status, COUNT(*) AS count FROM ideas GROUP BY status"
        );

        const [topIdeas] = await db.query(
            "SELECT title, score FROM ideas ORDER BY score DESC LIMIT 5"
        );

        res.json({
            totalIdeas: totalIdeas.count,
            totalComments: totalComments.count,
            byStatus,
            topIdeas
        });
    });

    /* ================= START SERVER ================= */

    app.listen(3000, () =>
        console.log("Server running on http://localhost:3000")
    );
});