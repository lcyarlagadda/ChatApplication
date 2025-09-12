import React from "react";
import { UserProvider } from "./contexts/UserContext";
import ChatApp from "./components/ChatApp";
import "./index.css";

// Main App component - now just provides context
const App = () => {
  return (
    <UserProvider>
      <ChatApp />
    </UserProvider>
  );
};

export default App;