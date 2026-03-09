import { createContext, useContext, useState } from 'react';

const ChatMeetingContext = createContext(null);

export const ChatMeetingProvider = ({ children }) => {
    const [pendingMeetings, setPendingMeetings] = useState(null);
    return (
        <ChatMeetingContext.Provider value={{ pendingMeetings, setPendingMeetings }}>
            {children}
        </ChatMeetingContext.Provider>
    );
};

export const useChatMeeting = () => useContext(ChatMeetingContext);
