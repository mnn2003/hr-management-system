import { useState } from 'react';
import Layout from '@/components/Layout';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import { Conversation } from '@/lib/chatService';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Chat() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const isMobile = useIsMobile();

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  return (
    <Layout pageTitle="Chat">
      <div className="sm:p-6 h-[calc(100vh-65px)] flex">
        {/* Conversation List - Hidden on mobile when a conversation is selected */}
        <div className={`${isMobile ? (selectedConversation ? 'hidden' : 'w-full') : 'w-80 lg:w-96'} flex-shrink-0`}>
          <ConversationList
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Chat Window - Hidden on mobile when no conversation is selected */}
        <div className={`flex-1 ${isMobile && !selectedConversation ? 'hidden' : ''}`}>
          <ChatWindow 
            conversation={selectedConversation}
            onBack={isMobile ? handleBack : undefined}
          />
        </div>
      </div>
    </Layout>
  );
}
