require("dotenv").config();
const express = require("express");
const cors = require("cors");

const multer = require("multer");
const path = require("path");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/tasksRoute");
const meetingsRoute = require("./routes/meetingsRoute");
const jiraRoutes = require("./routes/jiraRoutes");
const emailRoutes = require("./routes/emailRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const chatRoutes      = require("./routes/chatRoutes");

connectDB();

const app = express();


app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());


app.use((req, res, next) => {
  if (req.path.startsWith('/api/users') && req.method === 'POST') {
    console.log('Incoming API request body:', req.body);
  }
  next();
});

// Since frontend calls /signIn at root, we keep it here but use controller
const { signIn } = require("./controllers/userController");
app.post("/signIn", signIn);

// Since frontend calls /ask at root, we keep it here but use controller
const { analyzeMeeting } = require("./controllers/meetingsController");
const upload = multer({ dest: "uploads/" });
app.post("/ask", upload.single("file"), analyzeMeeting);

app.use(express.static(path.join(__dirname, "frontend", "dist")));

app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/meetings", meetingsRoute);
app.use("/api/jira", jiraRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/chat",      chatRoutes);

app.get("/*path", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
