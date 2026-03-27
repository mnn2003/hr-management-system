import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Conversation, subscribeToConversations, createConversation } from '@/lib/chatService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users, User, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ConversationListProps {
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  compact?: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string;
  profileImageUrl?: string;
}

export default function ConversationList({ 
  selectedConversation, 
  onSelectConversation,
  compact = false
}: ConversationListProps) {
  const { user, organizationId } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !organizationId) return;

    const unsubscribe = subscribeToConversations(user.uid, organizationId, (convs) => {
      setConversations(convs);
    });

    return () => unsubscribe();
  }, [user, organizationId]);

  useEffect(() => {
    if (isDialogOpen) {
      loadEmployees();
    }
  }, [isDialogOpen]);

  const loadEmployees = async () => {
    if (!organizationId || !user) return;
    
    try {
      const employeesQuery = query(
        collection(db, 'employees'),
        where('organizationId', '==', organizationId)
      );
      
      const snapshot = await getDocs(employeesQuery);
      const employeesList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Employee))
        .filter(emp => emp.id !== user.uid); // Exclude current user
      
      setEmployees(employeesList);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const handleCreateConversation = async () => {
    if (!user || !organizationId) return;
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one person');
      return;
    }
    if (isGroup && !groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setLoading(true);
    try {
      const participants = [user.uid, ...selectedEmployees];
      const participantNames: { [key: string]: string } = {};
      const participantAvatars: { [key: string]: string } = {};
      
      // Add current user's name
      const currentUserDoc = await getDocs(query(
        collection(db, 'employees'),
        where('__name__', '==', user.uid)
      ));
      
      if (!currentUserDoc.empty) {
        const userData = currentUserDoc.docs[0].data();
        participantNames[user.uid] = userData.name || user.email || 'You';
        if (userData.profileImageUrl) {
          participantAvatars[user.uid] = userData.profileImageUrl;
        }
      } else {
        participantNames[user.uid] = user.email || 'You';
      }
      
      // Add selected employees' names
      selectedEmployees.forEach(empId => {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          participantNames[empId] = emp.name;
          if (emp.profileImageUrl) {
            participantAvatars[empId] = emp.profileImageUrl;
          }
        }
      });

      const type = isGroup || selectedEmployees.length > 1 ? 'group' : 'direct';
      const conversationId = await createConversation(
        type,
        participants,
        participantNames,
        organizationId,
        user.uid,
        type === 'group' ? groupName : undefined,
        participantAvatars
      );

      // Find and select the new conversation
      const newConv = conversations.find(c => c.id === conversationId);
      if (newConv) {
        onSelectConversation(newConv);
      }

      setIsDialogOpen(false);
      setSelectedEmployees([]);
      setGroupName('');
      setIsGroup(false);
      toast.success('Chat created successfully!');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'group' && conv.name) {
      return conv.name;
    }
    // For direct chats, show the other person's name
    const otherParticipant = conv.participants.find(p => p !== user?.uid);
    return otherParticipant ? conv.participantNames[otherParticipant] : 'Unknown';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'group') {
      return null; // Will show group icon
    }
    const otherParticipant = conv.participants.find(p => p !== user?.uid);
    return otherParticipant ? conv.participantAvatars?.[otherParticipant] : undefined;
  };

  const getUnreadCount = (conv: Conversation) => {
    return user?.uid ? (conv.unreadCount?.[user.uid] || 0) : 0;
  };

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-card ${compact ? '' : 'border-r'}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {!compact && 'Chats'}
          </h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="group" 
                    checked={isGroup}
                    onCheckedChange={(checked) => setIsGroup(checked as boolean)}
                  />
                  <Label htmlFor="group">Create a group chat</Label>
                </div>
                
                {isGroup && (
                  <Input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedEmployees.includes(emp.id)
                            ? 'bg-primary/10 border border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleEmployee(emp.id)}
                      >
                        <Checkbox 
                          checked={selectedEmployees.includes(emp.id)}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={emp.profileImageUrl} />
                          <AvatarFallback>
                            {emp.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{emp.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {emp.department || emp.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {selectedEmployees.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployees.map(empId => {
                      const emp = employees.find(e => e.id === empId);
                      return emp ? (
                        <Badge key={empId} variant="secondary" className="gap-1">
                          {emp.name}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEmployee(empId);
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}

                <Button 
                  onClick={handleCreateConversation} 
                  disabled={loading || selectedEmployees.length === 0}
                  className="w-full"
                >
                  {loading ? 'Creating...' : 'Start Chat'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!compact && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No chats yet</p>
              <p className="text-sm">Start a new conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const unreadCount = getUnreadCount(conv);
              const isSelected = selectedConversation?.id === conv.id;
              
              return (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => onSelectConversation(conv)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      {conv.type === 'group' ? (
                        <AvatarFallback className={isSelected ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground'}>
                          <Users className="h-5 w-5" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={getConversationAvatar(conv)} />
                          <AvatarFallback className={isSelected ? 'bg-primary-foreground text-primary' : ''}>
                            {getConversationName(conv).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  
                  {!compact && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium truncate ${unreadCount > 0 && !isSelected ? 'font-bold' : ''}`}>
                          {getConversationName(conv)}
                        </p>
                        {conv.lastMessageTime && (
                          <span className={`text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(conv.lastMessageTime.toDate(), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className={`text-sm truncate ${
                          isSelected 
                            ? 'text-primary-foreground/70' 
                            : unreadCount > 0 
                              ? 'text-foreground font-medium' 
                              : 'text-muted-foreground'
                        }`}>
                          {conv.lastMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
