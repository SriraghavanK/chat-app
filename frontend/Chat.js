import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import {
  LogOut,
  Send,
  Paperclip,
  Smile,
  Edit,
  Phone,
  Video,
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Trash2,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import ProfileEdit from "./ProfileEdit";
import "./Chat.css";
const socket = io("https://chat-app-0cqk.onrender.com");

export default function Component() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
 
   useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) {
      navigate("/");
    } else {
      setCurrentUser(user);
      socket.emit("userConnected", { userId: user._id });
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      socket.on("newMessage", (message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });
     
        if (currentUser) {
          fetchUsers();
        }
     
      socket.on("messageDeleted", (messageId) => {
        setMessages((prevMessages) =>
          prevMessages.filter((message) => message._id !== messageId)
        );
      });

      socket.on("userTyping", ({ userId, userName }) => {
        setTypingUsers((prev) => ({ ...prev, [userId]: userName }));
      });

      socket.on("userStoppedTyping", ({ userId }) => {
        setTypingUsers((prev) => {
          const newTypingUsers = { ...prev };
          delete newTypingUsers[userId];
          return newTypingUsers;
        });
      });

      socket.on("incomingCall", ({ callerId, callerName, callType, offer }) => {
        console.log("Incoming call received", {
          callerId,
          callerName,
          callType,
          offer,
        });
        setShowCallModal(true);
        setCallType(callType);
        setCallStatus("incoming");
        createPeerConnection(callType, true);
        peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
      });

      socket.on("callAccepted", ({ answer }) => {
        console.log("Call accepted", answer);
        setCallStatus("accepted");
        peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      });

      socket.on("callRejected", () => {
        console.log("Call rejected");
        setCallStatus("rejected");
        setTimeout(() => {
          setCallStatus("");
          setIsCallActive(false);
        }, 3000);
      });

      socket.on("callEnded", () => {
        console.log("Call ended");
        setCallStatus("ended");
        endCall();
      });

      socket.on("ice-candidate", async (candidate) => {
        console.log("ICE candidate received", candidate);
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (e) {
            console.error("Error adding received ice candidate", e);
          }
        }
      });
    }

    return () => {
      socket.off("newMessage");
      socket.off("messageDeleted");
      socket.off("userTyping");
      socket.off("userStoppedTyping");
      socket.off("incomingCall");
      socket.off("callAccepted");
      socket.off("callRejected");
      socket.off("callEnded");
      socket.off("ice-candidate");
    };
  }, [currentUser]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(
        "https://chat-app-0cqk.onrender.com/api/users"
      );
      if (currentUser) {
        const filteredUsers = response.data.filter(
          (user) => user._id !== currentUser._id
        );
        setUsers(filteredUsers);
      } else {
        setUsers(response.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMessages = async () => {
    if (!currentUser || !selectedUser) return;
    try {
      const response = await axios.get(
        `https://chat-app-0cqk.onrender.com/api/messages/${currentUser._id}/${selectedUser._id}`
      );
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedUser && currentUser) {
      const messageData = {
        sender: currentUser._id,
        receiver: selectedUser._id,
        content: newMessage,
      };
      socket.emit("sendMessage", messageData);
      setNewMessage("");
      socket.emit("stopTyping", {
        userId: currentUser._id,
        receiverId: selectedUser._id,
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `https://chat-app-0cqk.onrender.com/api/messages/${messageId}`
      );
      setMessages((prevMessages) =>
        prevMessages.filter((message) => message._id !== messageId)
      );
      socket.emit("deleteMessage", { messageId, receiverId: selectedUser._id });
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleTyping = () => {
    if (selectedUser && currentUser) {
      socket.emit("typing", {
        userId: currentUser._id,
        userName: currentUser.name,
        receiverId: selectedUser._id,
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleEmojiClick = (emojiObject) => {
    setNewMessage((prevMessage) => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && selectedUser && currentUser) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sender", currentUser._id);
      formData.append("receiver", selectedUser._id);

      try {
        const response = await axios.post(
          "https://chat-app-0cqk.onrender.com/api/upload",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        setMessages((prevMessages) => [...prevMessages, response.data]);
        socket.emit("sendMessage", response.data);
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setShowProfileEdit(false);
    fetchUsers();
  };

  const getProfilePicture = (user) => {
    if (!user) return "";
    if (user.profilePicture) {
      return `https://chat-app-0cqk.onrender.com${user.profilePicture}`;
    }
    return `https://api.dicebear.com/6.x/initials/svg?seed=${user.name}`;
  };

  const createPeerConnection = (type, isReceiver = false) => {
    console.log("Creating peer connection");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.google.com:19302" },
        { urls: "stun:stun2.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("New ICE candidate", event.candidate);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: selectedUser._id,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state change:", pc.iceConnectionState);
    };

    if (!isReceiver) {
      navigator.mediaDevices
        .getUserMedia({ video: type === "video", audio: true })
        .then((stream) => {
          console.log("Got local stream");
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        })
        .catch((error) =>
          console.error("Error accessing media devices:", error)
        );
    }

    peerConnectionRef.current = pc;
    return pc;
  };

  const initiateCall = async (type) => {
    if (selectedUser && currentUser) {
      try {
        console.log("Initiating call");
        setIsCallActive(true);
        setCallType(type);
        setCallStatus("outgoing");

        const pc = createPeerConnection(type);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log("Sending call offer");
        socket.emit("initiateCall", {
          callerId: currentUser._id,
          receiverId: selectedUser._id,
          callType: type,
          offer: offer,
        });
      } catch (error) {
        console.error("Error initiating call:", error);
        setIsCallActive(false);
        setCallStatus("");
      }
    }
  };

  const handleAcceptCall = async () => {
    try {
      console.log("Accepting call");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      stream
        .getTracks()
        .forEach((track) => peerConnectionRef.current.addTrack(track, stream));

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log("Sending call answer");
      if (selectedUser) {
        socket.emit("acceptCall", {
          callerId: selectedUser._id,
          answer: answer,
        });
      }

      setIsCallActive(true);
      setShowCallModal(false);
      setCallStatus("accepted");
    } catch (error) {
      console.error("Error accepting call:", error);
      handleRejectCall();
    }
  };

  const handleRejectCall = () => {
    console.log("Rejecting call");
    if (selectedUser) {
      socket.emit("rejectCall", { callerId: selectedUser._id });
    }
    setShowCallModal(false);
    setCallStatus("rejected");
    setTimeout(() => {
      setCallStatus("");
    }, 3000);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const endCall = () => {
    console.log("Ending call");
    socket.emit("endCall", { receiverId: selectedUser?._id });
    setIsCallActive(false);
    setCallType(null);
    setCallStatus("ended");
    setTimeout(() => {
      setCallStatus("");
    }, 3000);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const renderFileMessage = (message) => {
    const fileExtension = message.fileName.split(".").pop().toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "gif"].includes(fileExtension);

    if (isImage) {
      return (
        <img
          src={`https://chat-app-0cqk.onrender.com${message.fileUrl}`}
          alt={message.fileName}
          style={{ maxWidth: "200px", maxHeight: "200px" }}
        />
      );
    } else {
      return (
        <div className="file-message">
          <i className={`bi bi-file-earmark-${fileExtension}`}></i>
          <div className="file-info">
            <span className="file-name">{message.fileName}</span>
            <span className="file-ext">{fileExtension.toUpperCase()}</span>
          </div>
        </div>
      );
    }
  };

  const renderCallWindow = () => {
    if (!isCallActive) return null;

    return (
      <div className="call-window">
        <div className="call-header">
          <h2>{callType === "audio" ? "Audio Call" : "Video Call"}</h2>
          <p>{selectedUser?.name}</p>
          <p>{callStatus}</p>
        </div>
        <div className="call-body">
          {callType === "video" && (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="local-video"
              />
            </>
          )}
          {callType === "audio" && (
            <div className="audio-call-avatar">
              <img
                src={getProfilePicture(selectedUser)}
                alt={selectedUser?.name}
              />
            </div>
          )}
        </div>
        <div className="call-controls">
          <Button variant="light" onClick={toggleMute}>
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </Button>
          {callType === "video" && (
            <Button variant="light" onClick={toggleVideo}>
              {isVideoOff ? <CameraOff size={24} /> : <Camera size={24} />}
            </Button>
          )}
          <Button variant="danger" onClick={endCall}>
            <Phone size={24} />
          </Button>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="current-user-info">
            {currentUser && (
              <>
                <img
                  src={getProfilePicture(currentUser)}
                  alt={currentUser.name}
                  className="current-user-avatar"
                />
                <span>{currentUser.name}</span>
              </>
            )}
          </div>
          <div>
            <Button variant="link" onClick={() => setShowProfileEdit(true)}>
              <Edit size={24} />
            </Button>
            <Button variant="link" onClick={handleLogout}>
              <LogOut size={24} />
            </Button>
          </div>
        </div>
        <div className="user-list">
          {users.map((user) => (
            <div
              key={user._id}
              className={`user-item ${
                selectedUser?._id === user._id ? "active" : ""
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <img
                src={getProfilePicture(user)}
                alt={user.name}
                className="user-avatar"
              />
              <div className="user-info">
                <h3>{user.name}</h3>
                {typingUsers[user._id] && <p className="typing">Typing...</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <img
                src={getProfilePicture(selectedUser)}
                alt={selectedUser.name}
                className="selected-user-avatar"
              />
              <h2>{selectedUser.name}</h2>
              <div className="call-buttons">
                <Button variant="light" onClick={() => initiateCall("audio")}>
                  <Phone size={24} />
                </Button>
                <Button variant="light" onClick={() => initiateCall("video")}>
                  <Video size={24} />
                </Button>
              </div>
            </div>
            <div className="message-list">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message ${
                    message.sender._id === currentUser._id ? "sent" : "received"
                  }`}
                >
                  {message.fileUrl ? (
                    renderFileMessage(message)
                  ) : (
                    <p>{message.content}</p>
                  )}
                  <span className="timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.sender._id === currentUser._id && (
                    <Button
                      variant="link"
                      className="delete-message"
                      onClick={() => handleDeleteMessage(message._id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <Form onSubmit={handleSendMessage} className="message-form">
              <InputGroup>
                <Button
                  variant="light"
                  className="emoji-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <Smile size={24} />
                </Button>
                <Button
                  variant="light"
                  className="attachment-btn"
                  onClick={() => fileInputRef.current.click()}
                >
                  <Paperclip size={24} />
                </Button>
                <Form.Control
                  type="text"
                  placeholder="Type a message"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  className="message-input"
                />
                <Button type="submit" className="send-btn">
                  <Send size={24} />
                </Button>
              </InputGroup>
            </Form>
            {showEmojiPicker && (
              <div className="emoji-picker-container">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </>
        ) : (
          <div className="no-chat-selected">
            <h2>Select a chat to start messaging</h2>
          </div>
        )}
      </div>
      <Modal show={showProfileEdit} onHide={() => setShowProfileEdit(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Profile</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ProfileEdit user={currentUser} onUpdate={handleProfileUpdate} />
        </Modal.Body>
      </Modal>
      <Modal show={showCallModal} onHide={handleRejectCall}>
        <Modal.Header closeButton>
          <Modal.Title>
            {callType === "audio"
              ? "Incoming Audio Call"
              : "Incoming Video Call"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{selectedUser?.name} is calling you</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleRejectCall}>
            Reject
          </Button>
          <Button variant="primary" onClick={handleAcceptCall}>
            Accept
          </Button>
        </Modal.Footer>
      </Modal>
      {renderCallWindow()}
      {callStatus === "rejected" && (
        <div className="call-status-message">Call rejected</div>
      )}
      {callStatus === "ended" && (
        <div className="call-status-message">Call ended</div>
      )}
    </div>
  );
}
