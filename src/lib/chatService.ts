import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  getDoc,
  arrayUnion,
  Timestamp,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  createdAt: Timestamp;
  readBy: string[];
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name?: string; // For group chats
  participants: string[];
  participantNames: { [key: string]: string };
  participantAvatars?: { [key: string]: string };
  organizationId: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  lastMessageSenderId?: string;
  createdAt: Timestamp;
  createdBy: string;
  unreadCount?: { [key: string]: number };
}

// Create a new conversation
export const createConversation = async (
  type: 'direct' | 'group',
  participants: string[],
  participantNames: { [key: string]: string },
  organizationId: string,
  createdBy: string,
  name?: string,
  participantAvatars?: { [key: string]: string }
): Promise<string> => {
  // For direct chats, check if conversation already exists
  if (type === 'direct' && participants.length === 2) {
    const existingQuery = query(
      collection(db, 'conversations'),
      where('type', '==', 'direct'),
      where('organizationId', '==', organizationId),
      where('participants', 'array-contains', participants[0])
    );
    
    const existingDocs = await getDocs(existingQuery);
    const existingConv = existingDocs.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(participants[1]);
    });
    
    if (existingConv) {
      return existingConv.id;
    }
  }

  const conversationRef = await addDoc(collection(db, 'conversations'), {
    type,
    name: name || null,
    participants,
    participantNames,
    participantAvatars: participantAvatars || {},
    organizationId,
    createdAt: serverTimestamp(),
    createdBy,
    lastMessage: null,
    lastMessageTime: null,
    unreadCount: participants.reduce((acc, p) => ({ ...acc, [p]: 0 }), {})
  });

  return conversationRef.id;
};

// Send a message
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  content: string,
  type: 'text' | 'image' | 'file' = 'text',
  fileData?: {
    url: string;
    name: string;
    size: number;
    type: string;
  },
  senderAvatar?: string
): Promise<string> => {
  const messageData: any = {
    conversationId,
    senderId,
    senderName,
    senderAvatar: senderAvatar || null,
    content,
    type,
    createdAt: serverTimestamp(),
    readBy: [senderId]
  };

  if (fileData) {
    messageData.fileUrl = fileData.url;
    messageData.fileName = fileData.name;
    messageData.fileSize = fileData.size;
    messageData.fileType = fileData.type;
  }

  const messageRef = await addDoc(collection(db, 'messages'), messageData);

  // Update conversation's last message
  const convRef = doc(db, 'conversations', conversationId);
  const convDoc = await getDoc(convRef);
  
  if (convDoc.exists()) {
    const convData = convDoc.data();
    const updatedUnreadCount = { ...convData.unreadCount };
    
    // Increment unread count for all participants except sender
    convData.participants.forEach((participantId: string) => {
      if (participantId !== senderId) {
        updatedUnreadCount[participantId] = (updatedUnreadCount[participantId] || 0) + 1;
      }
    });

    await updateDoc(convRef, {
      lastMessage: type === 'text' ? content : `📎 ${fileData?.name || 'File'}`,
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: senderId,
      unreadCount: updatedUnreadCount
    });
  }

  return messageRef.id;
};

// Upload file for chat
export const uploadChatFile = async (
  file: File,
  conversationId: string,
  senderId: string
): Promise<{ url: string; name: string; size: number; type: string }> => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `chat/${conversationId}/${senderId}/${timestamp}_${safeName}`;
  const fileRef = ref(storage, filePath);
  
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  
  return {
    url,
    name: file.name,
    size: file.size,
    type: file.type
  };
};

// Subscribe to conversations for a user
export const subscribeToConversations = (
  userId: string,
  organizationId: string,
  callback: (conversations: Conversation[]) => void
) => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    where('organizationId', '==', organizationId),
    orderBy('lastMessageTime', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Conversation[];
    callback(conversations);
  }, (error) => {
    console.error('Error subscribing to conversations:', error);
    // Fallback without ordering if index doesn't exist
    const fallbackQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      where('organizationId', '==', organizationId)
    );
    
    onSnapshot(fallbackQuery, (snapshot) => {
      const conversations = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as Conversation)
        .sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis() || 0;
          const timeB = b.lastMessageTime?.toMillis() || 0;
          return timeB - timeA;
        });
      callback(conversations);
    });
  });
};

// Subscribe to messages in a conversation
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];
    callback(messages);
  }, (error) => {
    console.error('Error subscribing to messages:', error);
    // Fallback
    const fallbackQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    );
    
    onSnapshot(fallbackQuery, (snapshot) => {
      const messages = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as ChatMessage)
        .sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeA - timeB;
        });
      callback(messages);
    });
  });
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
) => {
  // Update the unread count in the conversation
  const convRef = doc(db, 'conversations', conversationId);
  const convDoc = await getDoc(convRef);
  
  if (convDoc.exists()) {
    const convData = convDoc.data();
    const updatedUnreadCount = { ...convData.unreadCount, [userId]: 0 };
    
    await updateDoc(convRef, {
      unreadCount: updatedUnreadCount
    });
  }

  // Mark individual messages as read
  const messagesQuery = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId)
  );
  
  const messagesDocs = await getDocs(messagesQuery);
  
  const updatePromises = messagesDocs.docs
    .filter(doc => !doc.data().readBy?.includes(userId))
    .map(doc => updateDoc(doc.ref, {
      readBy: arrayUnion(userId)
    }));
  
  await Promise.all(updatePromises);
};

// Get total unread count for a user
export const getTotalUnreadCount = (conversations: Conversation[], userId: string): number => {
  return conversations.reduce((total, conv) => {
    return total + (conv.unreadCount?.[userId] || 0);
  }, 0);
};

// Delete a conversation (only for admins or creators)
export const deleteConversation = async (conversationId: string) => {
  // Delete all messages first
  const messagesQuery = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId)
  );
  
  const messagesDocs = await getDocs(messagesQuery);
  const deletePromises = messagesDocs.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  
  // Delete the conversation
  await deleteDoc(doc(db, 'conversations', conversationId));
};

// Add participants to a group
export const addParticipantsToGroup = async (
  conversationId: string,
  newParticipants: string[],
  newParticipantNames: { [key: string]: string }
) => {
  const convRef = doc(db, 'conversations', conversationId);
  const convDoc = await getDoc(convRef);
  
  if (convDoc.exists()) {
    const convData = convDoc.data();
    const updatedParticipants = [...new Set([...convData.participants, ...newParticipants])];
    const updatedParticipantNames = { ...convData.participantNames, ...newParticipantNames };
    const updatedUnreadCount = { ...convData.unreadCount };
    
    newParticipants.forEach(p => {
      updatedUnreadCount[p] = 0;
    });
    
    await updateDoc(convRef, {
      participants: updatedParticipants,
      participantNames: updatedParticipantNames,
      unreadCount: updatedUnreadCount
    });
  }
};

// Leave a group
export const leaveGroup = async (conversationId: string, userId: string) => {
  const convRef = doc(db, 'conversations', conversationId);
  const convDoc = await getDoc(convRef);
  
  if (convDoc.exists()) {
    const convData = convDoc.data();
    const updatedParticipants = convData.participants.filter((p: string) => p !== userId);
    const { [userId]: _, ...updatedParticipantNames } = convData.participantNames;
    const { [userId]: __, ...updatedUnreadCount } = convData.unreadCount || {};
    
    if (updatedParticipants.length === 0) {
      // Delete the conversation if no participants left
      await deleteConversation(conversationId);
    } else {
      await updateDoc(convRef, {
        participants: updatedParticipants,
        participantNames: updatedParticipantNames,
        unreadCount: updatedUnreadCount
      });
    }
  }
};
