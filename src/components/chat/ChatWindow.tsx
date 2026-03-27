import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Conversation, 
  ChatMessage, 
  subscribeToMessages, 
  sendMessage, 
  uploadChatFile,
  markMessagesAsRead 
} from '@/lib/chatService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  File, 
  Download,
  X,
  Users,
  ArrowLeft,
  MoreVertical
} from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatWindowProps {
  conversation: Conversation | null;
  onBack?: () => void;
  compact?: boolean;
}

export default function ChatWindow({ conversation, onBack, compact = false }: ChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');

  useEffect(() => {
    if (!conversation) return;

    const unsubscribe = subscribeToMessages(conversation.id, (msgs) => {
      setMessages(msgs);
      scrollToBottom();
    });

    // Mark messages as read when opening conversation
    if (user) {
      markMessagesAsRead(conversation.id, user.uid);
    }

    return () => unsubscribe();
  }, [conversation, user]);

  useEffect(() => {
    if (user && conversation) {
      setCurrentUserName(conversation.participantNames[user.uid] || user.email || 'You');
      setCurrentUserAvatar(conversation.participantAvatars?.[user.uid] || '');
    }
  }, [user, conversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!conversation || !user || (!newMessage.trim() && !selectedFile)) return;

    setSending(true);
    try {
      let fileData = undefined;
      
      if (selectedFile) {
        setUploading(true);
        fileData = await uploadChatFile(selectedFile, conversation.id, user.uid);
        setUploading(false);
        setSelectedFile(null);
      }

      const messageType = fileData 
        ? (fileData.type.startsWith('image/') ? 'image' : 'file')
        : 'text';

      await sendMessage(
        conversation.id,
        user.uid,
        currentUserName,
        newMessage.trim() || fileData?.name || '',
        messageType,
        fileData,
        currentUserAvatar
      );

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getConversationName = () => {
    if (!conversation || !user) return '';
    if (conversation.type === 'group' && conversation.name) {
      return conversation.name;
    }
    const otherParticipant = conversation.participants.find(p => p !== user.uid);
    return otherParticipant ? conversation.participantNames[otherParticipant] : 'Unknown';
  };

  const getConversationAvatar = () => {
    if (!conversation || !user) return undefined;
    if (conversation.type === 'group') return null;
    const otherParticipant = conversation.participants.find(p => p !== user.uid);
    return otherParticipant ? conversation.participantAvatars?.[otherParticipant] : undefined;
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return format(date, 'h:mm a');
  };

  const formatDateSeparator = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowDateSeparator = (currentMsg: ChatMessage, prevMsg?: ChatMessage) => {
    if (!prevMsg) return true;
    if (!currentMsg.createdAt || !prevMsg.createdAt) return false;
    return !isSameDay(currentMsg.createdAt.toDate(), prevMsg.createdAt.toDate());
  };

  const renderMessageContent = (msg: ChatMessage) => {
    const isOwn = msg.senderId === user?.uid;

    if (msg.type === 'image') {
      return (
        <div className="max-w-xs">
          <img 
            src={msg.fileUrl} 
            alt={msg.fileName || 'Image'} 
            className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(msg.fileUrl, '_blank')}
          />
          {msg.content && msg.content !== msg.fileName && (
            <p className="mt-2">{msg.content}</p>
          )}
        </div>
      );
    }

    if (msg.type === 'file') {
      return (
        <div className={`flex items-center gap-3 p-3 rounded-lg ${isOwn ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
          <File className="h-8 w-8 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{msg.fileName}</p>
            <p className="text-xs opacity-70">
              {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : ''}
            </p>
          </div>
          <Button 
            size="icon" 
            variant="ghost"
            onClick={() => window.open(msg.fileUrl, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Select a chat</p>
          <p className="text-sm">Choose a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-10 w-10">
          {conversation.type === 'group' ? (
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage src={getConversationAvatar() || ''} />
              <AvatarFallback>{getConversationName().charAt(0).toUpperCase()}</AvatarFallback>
            </>
          )}
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{getConversationName()}</h3>
          {conversation.type === 'group' && (
            <p className="text-xs text-muted-foreground">
              {conversation.participants.length} members
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Info</DropdownMenuItem>
            {conversation.type === 'group' && (
              <DropdownMenuItem className="text-destructive">Leave Group</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const isOwn = msg.senderId === user?.uid;
            const showDateSeparator = shouldShowDateSeparator(msg, messages[index - 1]);
            const showAvatar = !isOwn && (
              index === 0 || 
              messages[index - 1]?.senderId !== msg.senderId ||
              showDateSeparator
            );

            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="flex justify-center my-4">
                    <span className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}
                
                <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {!isOwn && showAvatar && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={msg.senderAvatar} />
                      <AvatarFallback className="text-xs">
                        {msg.senderName?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {!isOwn && !showAvatar && <div className="w-8" />}
                  
                  <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {!isOwn && showAvatar && conversation.type === 'group' && (
                      <p className="text-xs text-muted-foreground mb-1 ml-1">
                        {msg.senderName}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      {renderMessageContent(msg)}
                      <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatMessageTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex items-center gap-3 bg-card p-2 rounded-lg">
            {selectedFile.type.startsWith('image/') ? (
              <img 
                src={URL.createObjectURL(selectedFile)} 
                alt="Preview" 
                className="h-12 w-12 object-cover rounded"
              />
            ) : (
              <File className="h-12 w-12 p-2 bg-muted rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sending || uploading}
          />
          
          <Button 
            size="icon"
            onClick={handleSendMessage}
            disabled={sending || uploading || (!newMessage.trim() && !selectedFile)}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
