# ChatApp - Real-time Chat Application

A modern, full-stack real-time chat application built with React, Node.js, Express, MongoDB, and Socket.IO. Features include direct messaging, group chats, broadcast channels, file sharing, message reactions, and comprehensive user management.

## Features

### Core Chat Features
- **Real-time Messaging**: Instant message delivery with Socket.IO
- **Message Status**: Sent, delivered, and read receipts
- **Message Types**: Text, images, files, documents, audio, and video
- **Message Actions**: Edit, delete, react with emojis, reply, and forward
- **Typing Indicators**: See when others are typing
- **Message Search**: Find messages across conversations

### Conversation Types
- **Direct Messages**: One-on-one private conversations
- **Group Chats**: Multi-participant conversations with admin controls
- **Broadcast Channels**: One-way communication channels for announcements

### User Management
- **Authentication**: JWT-based authentication with refresh tokens
- **Email Verification**: Secure account verification via email
- **Password Reset**: Secure password recovery system
- **User Profiles**: Customizable profiles with avatars and status
- **User Blocking**: Block/unblock users functionality
- **Online Status**: Real-time online/offline status tracking

### Advanced Features
- **File Sharing**: Upload and share various file types with Cloudinary integration
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Session Management**: Multi-device session support
- **Admin Controls**: Group/broadcast channel administration
- **Message History**: Persistent message storage with pagination

## Architecture

### Backend (Node.js/Express)
```
backend/chat-backend/
├── app.js                 # Main application entry point
├── config/
│   └── cloudinary.js     # Cloudinary configuration
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── models/
│   ├── User.js           # User data model
│   ├── Message.js        # Message data model
│   └── Conversation.js   # Conversation data model
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── users.js          # User management routes
│   ├── conversations.js  # Conversation management routes
│   └── messages.js       # Message handling routes
└── services/
    └── socketService.js  # Socket.IO service for real-time communication
```

### Frontend (React)
```
frontend/chat-frontend/
├── src/
│   ├── components/
│   │   ├── ChatApp.jsx           # Main chat application component
│   │   ├── ChatLayout.jsx        # Layout wrapper
│   │   ├── ChatArea.jsx          # Chat interface
│   │   ├── Sidebar.jsx           # Conversation list
│   │   ├── MessageList.jsx       # Message display
│   │   ├── MessageInput.jsx      # Message composition
│   │   ├── Login/                # Authentication components
│   │   └── Modals/               # Various modal components
│   ├── contexts/
│   │   └── UserContext.js        # Global user state management
│   ├── api/
│   │   ├── auth.js               # Authentication API calls
│   │   ├── config.js             # API configuration
│   │   ├── conversations.js      # Conversation API calls
│   │   ├── messages.js           # Message API calls
│   │   └── users.js              # User API calls
│   ├── services/
│   │   └── socketService.js      # Socket.IO client service
│   └── utils/
│       ├── sessionManager.js     # Session management utilities
│       ├── fileUpload.js         # File upload utilities
│       └── helpers.js            # General helper functions
```

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.IO** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Cloudinary** - File storage and management
- **Nodemailer** - Email services
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 19** - UI framework
- **Tailwind CSS** - Styling
- **Socket.IO Client** - Real-time communication
- **Lucide React** - Icons
- **date-fns** - Date manipulation
- **jwt-decode** - JWT token handling

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16.0.0 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Chatapp
```

### 2. Backend Setup

```bash
cd backend/chat-backend
npm install
```

Create a `.env` file in the `backend/chat-backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/chatapp

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (for verification and password reset)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000

# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Frontend Setup

```bash
cd frontend/chat-frontend
npm install
```

Create a `.env` file in the `frontend/chat-frontend` directory:

```env
# API Configuration
REACT_APP_API_BASE_URL=http://localhost:5000/api
REACT_APP_SERVER_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
```

### 4. Start the Application

#### Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# On Windows
net start MongoDB
```

#### Start Backend Server
```bash
cd backend/chat-backend
npm run dev
```

#### Start Frontend Development Server
```bash
cd frontend/chat-frontend
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Socket.IO**: ws://localhost:5000

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `EMAIL_USER` | Email address for sending emails | Yes |
| `EMAIL_PASS` | Email password or app password | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |

#### Frontend (.env)
| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_BASE_URL` | Backend API base URL | Yes |
| `REACT_APP_SERVER_URL` | Backend server URL | Yes |
| `REACT_APP_WS_URL` | WebSocket server URL | Yes |

### Email Configuration

For email functionality (verification and password reset), you'll need to configure an email service:

1. **Gmail Setup**:
   - Enable 2-factor authentication
   - Generate an app password
   - Use your Gmail address and app password in the `.env` file

2. **Other Email Providers**:
   - Update the email configuration in `backend/chat-backend/routes/auth.js`
   - Modify the `emailConfig` object with your provider's settings

### Cloudinary Setup

1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com)
2. Get your cloud name, API key, and API secret from the dashboard
3. Add these credentials to your backend `.env` file

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/refresh-token` | Refresh access token |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/me` | Get current user |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/search` | Search users |
| GET | `/api/users/online` | Get online users |
| PUT | `/api/users/status` | Update user status |
| POST | `/api/users/:id/block` | Block user |
| POST | `/api/users/:id/unblock` | Unblock user |

### Conversation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | Get user conversations |
| POST | `/api/conversations` | Create new conversation |
| GET | `/api/conversations/:id` | Get specific conversation |
| PUT | `/api/conversations/:id` | Update conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/conversations/:id/participants` | Add participant |
| DELETE | `/api/conversations/:id/participants/:userId` | Remove participant |
| POST | `/api/conversations/:id/admins` | Add admin |
| DELETE | `/api/conversations/:id/admins/:adminId` | Remove admin |

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:conversationId` | Get conversation messages |
| POST | `/api/messages/:conversationId` | Send message |
| PUT | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/react` | React to message |

## 🔌 Socket.IO Events

### Client to Server Events

| Event | Description | Data |
|-------|-------------|------|
| `join_conversation` | Join a conversation room | `{ conversationId }` |
| `leave_conversation` | Leave a conversation room | `{ conversationId }` |
| `send_message` | Send a new message | `{ conversationId, content, messageType, replyTo, fileInfo }` |
| `typing_start` | Start typing indicator | `{ conversationId }` |
| `typing_stop` | Stop typing indicator | `{ conversationId }` |
| `message_delivered` | Mark message as delivered | `{ messageId }` |
| `message_seen` | Mark message as seen | `{ messageId }` |
| `edit_message` | Edit a message | `{ messageId, content }` |
| `delete_message` | Delete a message | `{ messageId }` |
| `react_to_message` | React to a message | `{ messageId, emoji }` |

### Server to Client Events

| Event | Description | Data |
|-------|-------------|------|
| `new_message` | New message received | `{ conversationId, message }` |
| `message_status_update` | Message status changed | `{ messageId, status, timestamp }` |
| `message_edited` | Message was edited | `{ messageId, content, editedAt }` |
| `message_deleted` | Message was deleted | `{ messageId, conversationId }` |
| `message_reaction` | Message reaction updated | `{ messageId, reactions }` |
| `typing_start` | User started typing | `{ userId, userName, conversationId }` |
| `typing_stop` | User stopped typing | `{ userId, userName, conversationId }` |
| `user_online` | User came online | `{ userId, user }` |
| `user_offline` | User went offline | `{ userId }` |
| `conversation_created` | New conversation created | `{ conversation }` |
| `conversation_updated` | Conversation updated | `{ conversation, updateType }` |
| `conversation_deleted` | Conversation deleted | `{ conversationId, deletedBy }` |

## UI Components

### Main Components

- **ChatApp**: Main application component with state management
- **ChatLayout**: Layout wrapper with sidebar and chat area
- **Sidebar**: Conversation list with search and creation options
- **ChatArea**: Main chat interface with message list and input
- **MessageList**: Displays messages with pagination
- **MessageInput**: Message composition with file upload support

### Modal Components

- **ProfileModal**: User profile display and management
- **CreateConversationModal**: Create new conversations
- **ForwardModal**: Forward messages to other conversations
- **ConfirmationModal**: Confirm destructive actions
- **DeleteModal**: Delete messages or conversations

### Specialized Components

- **EmojiPicker**: Emoji selection for reactions
- **GifPicker**: GIF selection and sharing
- **ReactionPicker**: Message reaction interface
- **StatusIcon**: User online/offline status indicator
- **Thumbnail**: File preview thumbnails

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for secure password storage
- **Email Verification**: Required email verification for new accounts
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Cross-origin resource sharing protection
- **Helmet Security**: Security headers and protection
- **Input Validation**: Comprehensive input validation and sanitization
- **File Upload Security**: Secure file upload with type and size validation

## Deployment

### Backend Deployment

1. **Environment Setup**:
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export MONGODB_URI=your-production-mongodb-uri
   export JWT_SECRET=your-production-jwt-secret
   ```

2. **Build and Start**:
   ```bash
   cd backend/chat-backend
   npm install --production
   npm start
   ```

### Frontend Deployment

1. **Build for Production**:
   ```bash
   cd frontend/chat-frontend
   npm run build
   ```

2. **Serve Static Files**:
   - Use a web server like Nginx or Apache
   - Or deploy to platforms like Vercel, Netlify, or AWS S3

### Database Setup
   - Install MongoDB on your server
   - Configure authentication and security
   - Update connection string accordingly

## Scripts

### Backend Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint

### Frontend Scripts
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Performance Considerations

- **Message Pagination**: Messages are loaded in chunks for better performance
- **Image Optimization**: Images are automatically optimized via Cloudinary
- **Lazy Loading**: Components are loaded on demand
- **Caching**: API responses are cached where appropriate
- **Database Indexing**: Proper database indexes for fast queries

---
