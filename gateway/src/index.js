const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.GATEWAY_PORT || 8000;
const statUrl = process.env.STAT_URL || "http://localhost:8002";
const nlpUrl = process.env.NLP_URL || "http://localhost:8001";
const jwtSecret = process.env.JWT_SECRET || "supersecret";
const demoUser = process.env.DEMO_USER || "admin";
const demoPass = process.env.DEMO_PASS || "admin123";

app.use(cors());
app.use(express.json());

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "gateway", port });
});

app.post("/auth/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username !== demoUser || password !== demoPass) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username }, jwtSecret, { expiresIn: "12h" });
  return res.json({ token });
});

app.post("/api/dashboard", authMiddleware, async (req, res) => {
  const {
    includeKeywords = [],
    excludeKeywords = [],
    fromDate = "",
    toDate = "",
    sampleSize = 5,
  } = req.body || {};

  try {
    const statResp = await axios.post(`${statUrl}/stats`, {
      include_keywords: includeKeywords,
      exclude_keywords: excludeKeywords,
      from_date: fromDate,
      to_date: toDate,
      example_limit: sampleSize,
      post_limit: 500,
    });

    const stats = statResp.data;
    const posts = Array.isArray(stats.posts) ? stats.posts : [];
    const texts = posts.map((p) => p.content);

    const sentimentResp = await axios.post(`${nlpUrl}/sentiment`, { texts });
    const sentimentData = sentimentResp.data;

    const classifications = sentimentData.classifications || [];
    const classifiedPosts = posts.map((post, idx) => {
      const cls = classifications[idx] || {};
      return {
        ...post,
        sentiment: cls.label || "neutral",
        sentiment_score: cls.score || 0,
      };
    });

    const examples = classifiedPosts.slice(0, sampleSize);

    return res.json({
      sentimentPercentage: sentimentData.sentiment_percentage,
      topKeywords: stats.top_keywords || [],
      trends: stats.trends || [],
      examplePosts: examples,
      mentionCount: stats.mention_count || 0,
      totalAnalyzedPosts: classifiedPosts.length,
    });
  } catch (err) {
    const detail = (err.response && err.response.data) || err.message;
    return res.status(500).json({
      error: "Failed to build dashboard response",
      detail,
    });
  }
});

app.post("/api/posts", authMiddleware, async (req, res) => {
  const { platform = "", author = "", content = "", createdAt = "" } = req.body || {};

  try {
    const statResp = await axios.post(`${statUrl}/posts`, {
      platform,
      author,
      content,
      created_at: createdAt,
    });
    return res.status(201).json(statResp.data);
  } catch (err) {
    const status = (err.response && err.response.status) || 500;
    const detail = (err.response && err.response.data) || err.message;
    return res.status(status).json({
      error: "Failed to insert post",
      detail,
    });
  }
});

app.listen(port, () => {
  console.log(`gateway listening on :${port}`);
});
