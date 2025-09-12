// Mock users data
export const mockUsers = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', avatar: '👩‍💼', status: 'online', lastSeen: new Date(), bio: 'Product Manager at TechCorp', phone: '+1234567890' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', avatar: '👨‍💻', status: 'away', lastSeen: new Date(Date.now() - 300000), bio: 'Full Stack Developer', phone: '+1234567891' },
  { id: 3, name: 'Carol Davis', email: 'carol@example.com', avatar: '👩‍🎨', status: 'offline', lastSeen: new Date(Date.now() - 3600000), bio: 'UI/UX Designer', phone: '+1234567892' },
  { id: 4, name: 'David Wilson', email: 'david@example.com', avatar: '👨‍🚀', status: 'online', lastSeen: new Date(), bio: 'DevOps Engineer', phone: '+1234567893' },
  { id: 5, name: 'Emma Brown', email: 'emma@example.com', avatar: '👩‍🔬', status: 'online', lastSeen: new Date(), bio: 'Data Scientist', phone: '+1234567894' }
];

// Mock conversations data
export const mockConversations = [
  { 
    id: 1, 
    type: 'direct',
    participants: [1, 2], 
    lastMessage: { text: 'Hey, how are you doing? 😊', timestamp: new Date(Date.now() - 60000), sender: 2 },
    unreadCount: 2
  },
  { 
    id: 2, 
    type: 'direct',
    participants: [1, 3], 
    lastMessage: { text: 'Thanks for the files!', timestamp: new Date(Date.now() - 300000), sender: 1 },
    unreadCount: 0
  },
  { 
    id: 3, 
    type: 'group',
    name: 'Team Alpha',
    description: 'Main project team',
    participants: [1, 2, 4, 5], 
    admin: 1,
    lastMessage: { text: 'Meeting at 3 PM today 🚀', timestamp: new Date(Date.now() - 3600000), sender: 4 },
    unreadCount: 1
  },
  { 
    id: 4, 
    type: 'group',
    name: 'Design Team',
    description: 'UI/UX discussions',
    participants: [1, 3, 5], 
    admin: 3,
    lastMessage: { text: 'New mockups are ready!', timestamp: new Date(Date.now() - 7200000), sender: 3 },
    unreadCount: 0
  }
];

// Mock messages data
export const mockMessages = {
  1: [
    { id: 1, text: 'Hey Alice! How\'s the project going?', sender: 2, timestamp: new Date(Date.now() - 180000), status: 'read' },
    { id: 2, text: 'Going great! Just finished the authentication flow 🎉', sender: 1, timestamp: new Date(Date.now() - 120000), status: 'read' },
    { id: 3, text: 'Awesome! Can you show me the demo?', sender: 2, timestamp: new Date(Date.now() - 90000), status: 'read', replyTo: 2 },
    { id: 4, text: 'Sure! Let me share my screen', sender: 1, timestamp: new Date(Date.now() - 80000), status: 'delivered' },
    { id: 5, text: 'Hey, how are you doing? 😊', sender: 2, timestamp: new Date(Date.now() - 60000), status: 'sent' }
  ],
  2: [
    { id: 6, text: 'Hi Carol! I sent you the design files', sender: 1, timestamp: new Date(Date.now() - 400000), status: 'read', type: 'file', fileName: 'designs.zip' },
    { id: 7, text: 'Perfect! They look amazing 🎨✨', sender: 3, timestamp: new Date(Date.now() - 350000), status: 'read' },
    { id: 8, text: 'Thanks for the files!', sender: 1, timestamp: new Date(Date.now() - 300000), status: 'read' }
  ],
  3: [
    { id: 9, text: 'Ready for tomorrow\'s launch? 🚀', sender: 1, timestamp: new Date(Date.now() - 7200000), status: 'read' },
    { id: 10, text: 'Absolutely! Everything is deployed and ready', sender: 4, timestamp: new Date(Date.now() - 7000000), status: 'read' },
    { id: 11, text: 'Great work team! 👏', sender: 5, timestamp: new Date(Date.now() - 6800000), status: 'read' },
    { id: 12, text: 'Meeting at 3 PM today 🚀', sender: 4, timestamp: new Date(Date.now() - 3600000), status: 'read' }
  ],
  4: [
    { id: 13, text: 'Working on the new dashboard design', sender: 3, timestamp: new Date(Date.now() - 14400000), status: 'read' },
    { id: 14, text: 'Looking forward to seeing it! 👀', sender: 1, timestamp: new Date(Date.now() - 14000000), status: 'read' },
    { id: 15, text: 'New mockups are ready!', sender: 3, timestamp: new Date(Date.now() - 7200000), status: 'read', type: 'image', fileName: 'mockups.png' }
  ]
};