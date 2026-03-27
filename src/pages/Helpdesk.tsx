import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquare, Plus, Clock, CheckCircle, XCircle, Search, Filter, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdBy: string;
  createdAt: string;
  responses: { respondedBy: string; message: string; timestamp: string }[];
}

export default function Helpdesk() {
  const { userRole, user, organizationId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: '',
    priority: '',
    description: '',
  });
  const [responseMessage, setResponseMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const isAdmin = userRole === 'hr' || userRole === 'hod';

  useEffect(() => {
    if (user && organizationId) {
      loadUserName();
      loadTickets();
    }
  }, [user, organizationId]);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const loadUserName = async () => {
    try {
      const employeeDoc = await getDoc(doc(db, 'employees', user?.uid || ''));
      if (employeeDoc.exists()) {
        setUserName(employeeDoc.data().name || 'Unknown User');
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };

  const loadTickets = async () => {
    try {
      const q = query(
        collection(db, 'helpdesk_tickets'),
        where('organizationId', '==', organizationId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      setTickets(data);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    if (searchQuery) {
      filtered = filtered.filter(ticket =>
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.category || !newTicket.priority || !newTicket.description) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const ticketNumber = `TKT${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, 'helpdesk_tickets'), {
        ticketNumber,
        organizationId,
        userId: user?.uid,
        createdBy: userName || user?.email || 'Unknown User',
        ...newTicket,
        status: 'open',
        createdAt: new Date().toISOString(),
        responses: [],
      });

      setNewTicket({ subject: '', category: '', priority: '', description: '' });
      toast.success('Ticket created successfully');
      loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
    }
  };

  const handleAddResponse = async () => {
    if (!selectedTicket || !responseMessage) return;

    try {
      const updatedResponses = [
        ...selectedTicket.responses,
        {
          respondedBy: userName || user?.email || (isAdmin ? 'HR Admin' : 'Employee'),
          message: responseMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      await updateDoc(doc(db, 'helpdesk_tickets', selectedTicket.id), {
        responses: updatedResponses
      });

      const updatedTicket = {
        ...selectedTicket,
        responses: updatedResponses,
      };

      setTickets(tickets.map(t => (t.id === selectedTicket.id ? updatedTicket : t)));
      setSelectedTicket(updatedTicket);
      setResponseMessage('');
      toast.success('Response added');
    } catch (error) {
      console.error('Error adding response:', error);
      toast.error('Failed to add response');
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'helpdesk_tickets', ticketId), { status });
      setTickets(tickets.map(t => (t.id === ticketId ? { ...t, status } : t)));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      toast.success('Ticket status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      case 'closed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'secondary';
      case 'in-progress':
        return 'default';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusCount = (status: string) => {
    return tickets.filter(ticket => ticket.status === status).length;
  };

  // Calculate stats
  const totalTickets = tickets.length;
  const openTickets = getStatusCount('open');
  const resolvedTickets = getStatusCount('resolved');

  return (
    <Layout pageTitle="Helpdesk"> 
      <div className="space-y-4 p-4 sm:p-6">
      <div className="space-y-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <div className="text-xs text-blue-600 font-medium">Total Tickets</div>
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1">{totalTickets}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div className="text-xs text-orange-600 font-medium">Open</div>
            </div>
            <div className="text-lg font-bold text-orange-900 mt-1">{openTickets}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="text-xs text-green-600 font-medium">Resolved</div>
            </div>
            <div className="text-lg font-bold text-green-900 mt-1">{resolvedTickets}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-purple-600" />
              <div className="text-xs text-purple-600 font-medium">My Tickets</div>
            </div>
            <div className="text-lg font-bold text-purple-900 mt-1">
              {tickets.filter(t => t.createdBy === userName).length}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl">Helpdesk System</CardTitle>
                  <CardDescription>Submit and track support tickets</CardDescription>
                </div>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Create New Ticket
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                      <Input
                        id="subject"
                        value={newTicket.subject}
                        onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                        placeholder="Brief description of the issue"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                        <Select value={newTicket.category} onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="payroll">Payroll</SelectItem>
                            <SelectItem value="leave">Leave Management</SelectItem>
                            <SelectItem value="attendance">Attendance</SelectItem>
                            <SelectItem value="technical">Technical Issue</SelectItem>
                            <SelectItem value="benefits">Benefits & Insurance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
                        <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                      <Textarea
                        id="description"
                        value={newTicket.description}
                        onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                        placeholder="Detailed description of your issue"
                        rows={5}
                        className="mt-1 resize-none"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateTicket} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={!newTicket.subject || !newTicket.category || !newTicket.priority || !newTicket.description}
                    >
                      Create Ticket
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="sm:w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="sm:w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-muted-foreground mt-3">Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <Card className="text-center py-16 mx-4 my-4 border-dashed bg-muted/20">
                <CardContent>
                  <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">
                    {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' 
                      ? 'No tickets found' 
                      : 'No tickets yet'
                    }
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria'
                      : 'Create your first support ticket to get started'
                    }
                  </p>
                  {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') ? (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setPriorityFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Ticket
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Create New Ticket</DialogTitle>
                        </DialogHeader>
                        {/* Dialog content would be the same as above */}
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <ScrollArea className="h-[500px]">
                    <div className="min-w-[800px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket #</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Created Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTickets.map((ticket) => (
                            <TableRow key={ticket.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  {ticket.ticketNumber}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate" title={ticket.subject}>
                                {ticket.subject}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{ticket.category}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getPriorityVariant(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(ticket.status)} className="flex items-center gap-1 w-fit">
                                  {getStatusIcon(ticket.status)}
                                  {ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{ticket.createdBy}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(ticket.createdAt).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => setSelectedTicket(ticket)}
                                      className="hover:bg-blue-50"
                                    >
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5" />
                                        Ticket Details - {ticket.ticketNumber}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <TicketDetails 
                                      ticket={ticket}
                                      isAdmin={isAdmin}
                                      onUpdateStatus={handleUpdateStatus}
                                      responseMessage={responseMessage}
                                      onResponseChange={setResponseMessage}
                                      onAddResponse={handleAddResponse}
                                      getPriorityVariant={getPriorityVariant}
                                      getStatusVariant={getStatusVariant}
                                      getStatusIcon={getStatusIcon}
                                    />
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3 p-4">
                  {filteredTickets.map((ticket) => (
                    <Card key={ticket.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                              <h3 className="font-semibold text-base">{ticket.ticketNumber}</h3>
                            </div>
                            <h4 className="font-medium text-sm">{ticket.subject}</h4>
                          </div>
                          <Badge variant={getStatusVariant(ticket.status)} className="flex items-center gap-1">
                            {getStatusIcon(ticket.status)}
                            {ticket.status}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Category</div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {ticket.category}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Priority</div>
                            <Badge variant={getPriorityVariant(ticket.priority)} className="text-xs mt-1">
                              {ticket.priority}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Created By</div>
                            <div className="flex items-center gap-1 font-medium">
                              <User className="h-3 w-3" />
                              <span className="truncate">{ticket.createdBy}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Created</div>
                            <div className="flex items-center gap-1 font-medium">
                              <Calendar className="h-3 w-3" />
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end pt-3 border-t">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSelectedTicket(ticket)}
                                className="hover:bg-blue-50"
                              >
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <MessageSquare className="h-5 w-5" />
                                  Ticket - {ticket.ticketNumber}
                                </DialogTitle>
                              </DialogHeader>
                              <TicketDetails 
                                ticket={ticket}
                                isAdmin={isAdmin}
                                onUpdateStatus={handleUpdateStatus}
                                responseMessage={responseMessage}
                                onResponseChange={setResponseMessage}
                                onAddResponse={handleAddResponse}
                                getPriorityVariant={getPriorityVariant}
                                getStatusVariant={getStatusVariant}
                                getStatusIcon={getStatusIcon}
                              />
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </Layout>
  );
}

// Separate component for ticket details to reduce duplication
function TicketDetails({ 
  ticket, 
  isAdmin, 
  onUpdateStatus, 
  responseMessage, 
  onResponseChange, 
  onAddResponse,
  getPriorityVariant,
  getStatusVariant,
  getStatusIcon 
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Subject</Label>
          <p className="text-sm mt-1 bg-muted p-2 rounded-md">{ticket.subject}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Category</Label>
          <p className="text-sm mt-1">
            <Badge variant="outline">{ticket.category}</Badge>
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium">Priority</Label>
          <p className="text-sm mt-1">
            <Badge variant={getPriorityVariant(ticket.priority)}>
              {ticket.priority}
            </Badge>
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium">Status</Label>
          {isAdmin ? (
            <Select value={ticket.status} onValueChange={(value) => onUpdateStatus(ticket.id, value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="mt-1">
              <Badge variant={getStatusVariant(ticket.status)} className="flex items-center gap-1 w-fit">
                {getStatusIcon(ticket.status)}
                {ticket.status}
              </Badge>
            </div>
          )}
        </div>
      </div>
      
      <div>
        <Label className="text-sm font-medium">Description</Label>
        <p className="text-sm mt-1 whitespace-pre-wrap bg-muted p-3 rounded-md">{ticket.description}</p>
      </div>
      
      <div>
        <Label className="text-sm font-medium">Responses ({ticket.responses.length})</Label>
        <ScrollArea className="h-48 border rounded-md p-3 mt-2">
          {ticket.responses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No responses yet</p>
          ) : (
            <div className="space-y-3">
              {ticket.responses.map((response, index) => (
                <div key={index} className="border-b pb-2 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">{response.respondedBy}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(response.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{response.message}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      <div>
        <Label className="text-sm font-medium">Add Response</Label>
        <Textarea
          value={responseMessage}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Type your response here..."
          rows={3}
          className="mt-2"
        />
        <Button onClick={onAddResponse} className="mt-2 bg-blue-600 hover:bg-blue-700">
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Response
        </Button>
      </div>
    </div>
  );
}
