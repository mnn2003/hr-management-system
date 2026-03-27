import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableEmployeeSelect } from '@/components/ui/searchable-employee-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { BookOpen, Plus, CheckCircle, Edit, Users, Clock, CheckCircle2 } from 'lucide-react';

interface KnowledgeTransferItem {
  category: string;
  details: string;
  handoverTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedDate: string;
}

interface KnowledgeTransfer {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  items: KnowledgeTransferItem[];
  overallStatus: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
}

const KNOWLEDGE_CATEGORIES = [
  'Projects & Responsibilities',
  'System Access & Credentials',
  'Important Contacts',
  'Ongoing Tasks',
  'Documentation',
  'Tools & Software',
  'Processes & Workflows',
  'Client Information'
];

export const KnowledgeTransfer = () => {
  const [transfers, setTransfers] = useState<KnowledgeTransfer[]>([]);
  const [resignations, setResignations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<KnowledgeTransfer | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    designation: '',
    items: KNOWLEDGE_CATEGORIES.map(cat => ({
      category: cat,
      details: '',
      handoverTo: '',
      status: 'pending' as const,
      completedDate: ''
    }))
  });

  useEffect(() => {
    fetchTransfers();
    fetchResignations();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'employees'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchResignations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'resignations'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setResignations(data.filter((r: any) => r.status === 'approved' || r.status === 'in-clearance'));
    } catch (error) {
      console.error('Error fetching resignations:', error);
    }
  };

  const fetchTransfers = async () => {
    try {
      const q = query(collection(db, 'knowledge_transfers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as KnowledgeTransfer[];
      setTransfers(data);
    } catch (error) {
      console.error('Error fetching knowledge transfers:', error);
      toast.error('Failed to fetch knowledge transfers');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedResignation = resignations.find(r => r.employeeId === formData.employeeId);
      
      if (!selectedResignation) {
        toast.error('Resignation not found');
        return;
      }

      await addDoc(collection(db, 'knowledge_transfers'), {
        employeeId: formData.employeeId,
        employeeName: selectedResignation.employeeName,
        employeeCode: selectedResignation.employeeCode,
        designation: formData.designation,
        items: formData.items,
        overallStatus: 'pending',
        createdAt: Timestamp.now()
      });

      toast.success('Knowledge transfer documentation created');
      setIsDialogOpen(false);
      resetForm();
      fetchTransfers();
    } catch (error) {
      console.error('Error creating knowledge transfer:', error);
      toast.error('Failed to create knowledge transfer');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      designation: '',
      items: KNOWLEDGE_CATEGORIES.map(cat => ({
        category: cat,
        details: '',
        handoverTo: '',
        status: 'pending',
        completedDate: ''
      }))
    });
  };

  const updateTransferItem = async (transferId: string, itemIndex: number, updatedItem: KnowledgeTransferItem) => {
    if (!selectedTransfer) return;

    setLoading(true);
    try {
      const updatedItems = [...selectedTransfer.items];
      updatedItems[itemIndex] = {
        ...updatedItem,
        completedDate: updatedItem.status === 'completed' ? new Date().toISOString() : ''
      };

      const allCompleted = updatedItems.every(item => item.status === 'completed');
      const anyInProgress = updatedItems.some(item => item.status === 'in-progress');
      
      const overallStatus = allCompleted ? 'completed' : 
                           anyInProgress ? 'in-progress' : 'pending';

      await updateDoc(doc(db, 'knowledge_transfers', transferId), {
        items: updatedItems,
        overallStatus
      });

      toast.success('Knowledge transfer updated');
      fetchTransfers();
      setEditDialogOpen(false);
      setSelectedTransfer(null);
    } catch (error) {
      console.error('Error updating knowledge transfer:', error);
      toast.error('Failed to update knowledge transfer');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      'in-progress': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      'completed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    };
    return <Badge className={config[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const stats = [
    { label: 'Total Transfers', value: transfers.length, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'In Progress', value: transfers.filter(t => t.overallStatus === 'in-progress').length, icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    { label: 'Completed', value: transfers.filter(t => t.overallStatus === 'completed').length, icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { label: 'Categories', value: KNOWLEDGE_CATEGORIES.length, icon: BookOpen, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Knowledge Transfer Documentation</h3>
          <p className="text-sm text-muted-foreground">Document and track knowledge transfer process</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Documentation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Knowledge Transfer Documentation
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Employee *</Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                    required
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {resignations.map(res => (
                        <SelectItem key={res.employeeId} value={res.employeeId}>
                          {res.employeeName} - {res.employeeCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="designation">Designation *</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="Enter designation"
                    className="mt-1.5"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">Knowledge Transfer Checklist</h4>
                {formData.items.map((item, index) => (
                  <Card key={index} className="border">
                    <CardContent className="pt-5 space-y-3">
                      <h5 className="font-medium text-foreground">{item.category}</h5>
                      <div className="grid gap-3">
                        <div>
                          <Label className="text-sm">Details</Label>
                          <Textarea
                            value={item.details}
                            onChange={(e) => {
                              const updatedItems = [...formData.items];
                              updatedItems[index].details = e.target.value;
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            placeholder="Enter details for this category"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Handover To</Label>
                          <SearchableEmployeeSelect
                            employees={employees.map(emp => ({ id: emp.id, name: emp.name, employeeCode: emp.employeeCode }))}
                            value={employees.find(emp => emp.name === item.handoverTo)?.id || ''}
                            onValueChange={(value) => {
                              const updatedItems = [...formData.items];
                              const selectedEmp = employees.find(emp => emp.id === value);
                              updatedItems[index].handoverTo = selectedEmp?.name || value;
                              setFormData({ ...formData, items: updatedItems });
                            }}
                            placeholder="Select employee"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Documentation'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transfer Cards */}
      <div className="grid gap-4">
        {transfers.length === 0 ? (
          <Card className="border">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No knowledge transfer documentation created</p>
            </CardContent>
          </Card>
        ) : (
          transfers.map((transfer) => (
            <Card key={transfer.id} className="border shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{transfer.employeeName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {transfer.employeeCode} • {transfer.designation}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(transfer.overallStatus)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTransfer(transfer);
                        setEditDialogOpen(true);
                      }}
                      className="gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Update
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {transfer.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.status === 'completed' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                        {item.status === 'in-progress' && <Clock className="h-5 w-5 text-amber-500" />}
                        {item.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
                        <div>
                          <p className="font-medium text-sm">{item.category}</p>
                          {item.handoverTo && (
                            <p className="text-xs text-muted-foreground">Handover to: {item.handoverTo}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Transfer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Update Knowledge Transfer
            </DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4">
              {selectedTransfer.items.map((item, index) => (
                <Card key={index} className="border">
                  <CardContent className="pt-5 space-y-3">
                    <h5 className="font-semibold text-foreground">{item.category}</h5>
                    <div className="grid gap-3">
                      <div>
                        <Label className="text-sm">Details</Label>
                        <Textarea
                          value={item.details}
                          onChange={(e) => {
                            const updatedItems = [...selectedTransfer.items];
                            updatedItems[index].details = e.target.value;
                            setSelectedTransfer({ ...selectedTransfer, items: updatedItems });
                          }}
                          placeholder="Enter details"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Handover To</Label>
                        <Input
                          value={item.handoverTo}
                          onChange={(e) => {
                            const updatedItems = [...selectedTransfer.items];
                            updatedItems[index].handoverTo = e.target.value;
                            setSelectedTransfer({ ...selectedTransfer, items: updatedItems });
                          }}
                          placeholder="Employee name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Status</Label>
                        <Select
                          value={item.status}
                          onValueChange={(value: any) => {
                            const updated = { ...item, status: value };
                            updateTransferItem(selectedTransfer.id, index, updated);
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
