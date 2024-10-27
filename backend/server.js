const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIo = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const userSocketMap = new Map();

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://chatting-appy143.netlify.app",
    methods: ["GET", "POST", "PUT"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String,
  profilePicture: String,
  status: { type: String, default: "offline" },
});

const Message = mongoose.model("Message", {
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
  timestamp: { type: Date, default: Date.now },
  fileUrl: String,
  fileName: String,
});

const Call = mongoose.model("Call", {
  caller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: String,
  status: String,
  startTime: Date,
  endTime: Date,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("userConnected", ({ userId }) => {
    userSocketMap.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });
  socket.on("sendMessage", async (messageData) => {
    try {
      const newMessage = new Message(messageData);
      await newMessage.save();
      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "name")
        .populate("receiver", "name");
      io.emit("newMessage", populatedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("typing", (data) => {
    socket.broadcast.emit("userTyping", data);
  });

  socket.on("stopTyping", (data) => {
    socket.broadcast.emit("userStoppedTyping", data);
  });

  socket.on("userStatus", async ({ userId, status }) => {
    try {
      await User.findByIdAndUpdate(userId, { status });
      io.emit("userStatusChange", { userId, status });
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  });

  socket.on("initiateCall", async (data) => {
    try {
      const newCall = new Call({
        caller: data.callerId,
        receiver: data.receiverId,
        type: data.callType,
        status: "ringing",
        startTime: new Date(),
      });
      await newCall.save();
      const receiverSocketId = userSocketMap.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("incomingCall", {
          callId: newCall._id,
          callerId: data.callerId,
          callerName: data.callerName,
          callType: data.callType,
          offer: data.offer,
        });
      } else {
        console.log("Receiver not found or offline");
      }
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  });

  socket.on("acceptCall", async (data) => {
    try {
      await Call.findByIdAndUpdate(data.callId, { status: "ongoing" });
      io.to(data.callerId).emit("callAccepted", {
        callId: data.callId,
        answer: data.answer,
      });
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  });

  socket.on("rejectCall", async (data) => {
    try {
      await Call.findByIdAndUpdate(data.callId, {
        status: "rejected",
        endTime: new Date(),
      });
      io.to(data.callerId).emit("callRejected", { callId: data.callId });
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  });

  socket.on("endCall", async (data) => {
    try {
      await Call.findByIdAndUpdate(data.callId, {
        status: "ended",
        endTime: new Date(),
      });
      io.to(data.receiverId).emit("callEnded", { callId: data.callId });
    } catch (error) {
      console.error("Error ending call:", error);
    }
  });

  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", data.candidate);
  });

  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", data.answer);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    // Remove user from userSocketMap
    for (let [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });
  socket.on("deleteMessage", ({ messageId, receiverId }) => {
    socket.to(receiverId).emit("messageDeleted", messageId);
  });
});

app.post("/api/register", async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
      password: req.body.password,
    });
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/messages/:senderId/:receiverId", async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.params.senderId, receiver: req.params.receiverId },
        { sender: req.params.receiverId, receiver: req.params.senderId },
      ],
    })
      .populate("sender", "name")
      .populate("receiver", "name");
    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/users/:id", upload.single("profilePicture"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = req.body.name || user.name;
    if (req.file) {
      if (user.profilePicture) {
        const oldPicturePath = path.join(__dirname, user.profilePicture);
        if (fs.existsSync(oldPicturePath)) {
          fs.unlinkSync(oldPicturePath);
        }
      }
      user.profilePicture = `/uploads/${req.file.filename}`;
    }

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const newMessage = new Message({
      sender: req.body.sender,
      receiver: req.body.receiver,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
    });

    await newMessage.save();
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name")
      .populate("receiver", "name");

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error uploading file:", error);
    res
      .status(500)
      .json({ message: "Error uploading file", error: error.message });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const newMessage = new Message(req.body);
    await newMessage.save();
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name")
      .populate("receiver", "name");
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    res
      .status(500)
      .json({ message: "Error saving message", error: error.message });
  }
});
app.delete("/api/messages/:messageId", async (req, res) => {
  try {
    const messageId = req.params.messageId;
    await Message.findByIdAndDelete(messageId);
    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the message" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
