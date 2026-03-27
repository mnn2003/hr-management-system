import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, writeBatch, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, 
  Trash2, 
  Plus, 
  Download, 
  Pencil, 
  RefreshCw, 
  Trash,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
  type?: string;
}

interface YearGroup {
  year: string;
  holidays: Holiday[];
  count: number;
}

const HolidayManagement = () => {
  const { organizationId } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchHolidays();
  }, [organizationId]);

  const fetchHolidays = async () => {
    try {
      let q;
      if (organizationId) {
        q = query(collection(db, 'holidays'), where('organizationId', '==', organizationId));
      } else {
        q = collection(db, 'holidays');
      }
      
      const snapshot = await getDocs(q);
      const holidayList = snapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as object)
      })) as Holiday[];
      
      setHolidays(holidayList);
      
      // Auto-expand current year
      const currentYear = new Date().getFullYear().toString();
      setExpandedYears([currentYear]);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to load holidays');
    }
  };

  const importIndianHolidays = async () => {
    setIsImporting(true);
    try {
      const year = new Date().getFullYear();
      
      toast.loading(`Fetching ${year} holidays from API...`, { id: 'importing' });
      
      const response = await fetch(
        `https://calendarific.com/api/v2/holidays?api_key=NCupeNKhbdNXCBgd8t62zUUm1oxHEuiy&country=IN&year=${year}`
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.response || !data.response.holidays) {
        toast.error("Failed to fetch holidays from API", { id: 'importing' });
        setIsImporting(false);
        return;
      }

      const apiHolidays = data.response.holidays;
      
      toast.loading(`Found ${apiHolidays.length} holidays. Processing...`, { id: 'importing' });

      const batch = writeBatch(db);
      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < apiHolidays.length; i++) {
        const holiday = apiHolidays[i];
        
        try {
          let dateStr;
          if (holiday.date && holiday.date.iso) {
            dateStr = holiday.date.iso.split("T")[0];
          } else {
            skippedCount++;
            continue;
          }

          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            skippedCount++;
            continue;
          }

          const dateParts = dateStr.split('-').map(Number);
          const testDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
          if (testDate.getFullYear() !== dateParts[0] || 
              testDate.getMonth() !== dateParts[1] - 1 || 
              testDate.getDate() !== dateParts[2]) {
            skippedCount++;
            continue;
          }

          const name = holiday.name || "Unknown Holiday";
          
          let description = "";
          if (holiday.description) {
            description = holiday.description;
          } else if (holiday.type && holiday.type.length > 0) {
            description = `${Array.isArray(holiday.type) ? holiday.type.join(', ') : holiday.type} Holiday`;
          }

          let holidayType = 'Public Holiday';
          if (holiday.type) {
            holidayType = Array.isArray(holiday.type) ? holiday.type.join(', ') : holiday.type;
          }

          const exists = holidays.find(h => h.date === dateStr);

          if (!exists) {
            const docRef = doc(collection(db, "holidays"));
            batch.set(docRef, {
              date: dateStr,
              name: name,
              description: description,
              type: holidayType,
              ...(organizationId && { organizationId }),
              createdAt: new Date().toISOString()
            });
            addedCount++;

            if (addedCount % 500 === 0) {
              await batch.commit();
              toast.loading(`Imported ${addedCount} holidays so far...`, { id: 'importing' });
            }
          } else {
            skippedCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      if (addedCount % 500 !== 0 && addedCount > 0) {
        await batch.commit();
      }

      if (addedCount > 0) {
        toast.success(
          `✨ Successfully imported ${addedCount} holidays for ${year}!`,
          { id: 'importing', duration: 5000 }
        );
        fetchHolidays();
      } else {
        toast.success(`All ${year} holidays are already in your list`, { id: 'importing' });
      }

    } catch (error) {
      console.error('Error importing holidays:', error);
      toast.error("Failed to import from API. Please try again later.", { id: 'importing' });
    } finally {
      setIsImporting(false);
    }
  };

  // Dynamic delete function for any year
  const deleteHolidaysByYear = async (year: string) => {
    if (!year) return;
    
    setIsDeleting(true);
    try {
      const holidaysToDelete = holidays.filter(holiday => {
        const holidayYear = holiday.date.split('-')[0];
        return holidayYear === year;
      });

      if (holidaysToDelete.length === 0) {
        toast.success(`No holidays found for ${year}`, { id: 'deleting' });
        setDeleteDialogOpen(false);
        setYearToDelete(null);
        setIsDeleting(false);
        return;
      }

      toast.loading(`Deleting ${holidaysToDelete.length} holidays from ${year}...`, { id: 'deleting' });

      const batch = writeBatch(db);
      let deletedCount = 0;
      
      for (let i = 0; i < holidaysToDelete.length; i++) {
        const holiday = holidaysToDelete[i];
        const holidayRef = doc(db, 'holidays', holiday.id);
        batch.delete(holidayRef);
        deletedCount++;

        if (deletedCount % 500 === 0) {
          await batch.commit();
          toast.loading(`Deleted ${deletedCount} holidays so far...`, { id: 'deleting' });
        }
      }

      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }

      toast.success(`✅ Successfully deleted all ${deletedCount} holidays from ${year}!`, { 
        id: 'deleting',
        duration: 5000 
      });
      
      fetchHolidays();
      setDeleteDialogOpen(false);
      setYearToDelete(null);
      
    } catch (error) {
      console.error(`Error deleting ${year} holidays:`, error);
      toast.error(`Failed to delete ${year} holidays`, { id: 'deleting' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!selectedDate || !holidayName.trim()) {
      toast.error('Please select a date and enter a holiday name');
      return;
    }

    if (!isValid(selectedDate)) {
      toast.error('Please select a valid date');
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const exists = holidays.find(h => h.date === dateStr);
      if (exists) {
        toast.error('A holiday already exists on this date');
        return;
      }

      await addDoc(collection(db, 'holidays'), {
        date: dateStr,
        name: holidayName.trim(),
        description: holidayDescription.trim(),
        ...(organizationId && { organizationId }),
        createdAt: new Date().toISOString()
      });
      
      toast.success('Holiday added successfully!');
      setHolidayName('');
      setHolidayDescription('');
      fetchHolidays();
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'holidays', id));
      toast.success('Holiday deleted successfully!');
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    try {
      const [year, month, day] = holiday.date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (isValid(dateObj)) {
        setEditDate(dateObj);
      } else {
        setEditDate(undefined);
      }
    } catch (error) {
      console.error('Error parsing date for edit:', error);
      setEditDate(undefined);
    }
    setEditName(holiday.name);
    setEditDescription(holiday.description || '');
    setEditDialogOpen(true);
  };

  const handleUpdateHoliday = async () => {
    if (!editingHoliday || !editDate || !editName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!isValid(editDate)) {
      toast.error('Please select a valid date');
      return;
    }

    try {
      const dateStr = format(editDate, 'yyyy-MM-dd');
      
      const exists = holidays.find(h => h.date === dateStr && h.id !== editingHoliday.id);
      if (exists) {
        toast.error('Another holiday already exists on this date');
        return;
      }

      await updateDoc(doc(db, 'holidays', editingHoliday.id), {
        date: dateStr,
        name: editName.trim(),
        description: editDescription.trim(),
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Holiday updated successfully!');
      setEditDialogOpen(false);
      setEditingHoliday(null);
      fetchHolidays();
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast.error('Failed to update holiday');
    }
  };

  // Group holidays by year
  const groupHolidaysByYear = (): YearGroup[] => {
    const groups: { [key: string]: Holiday[] } = {};
    
    holidays.forEach(holiday => {
      const year = holiday.date.split('-')[0];
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(holiday);
    });

    return Object.entries(groups)
      .map(([year, holidayList]) => ({
        year,
        holidays: holidayList.sort((a, b) => a.date.localeCompare(b.date)),
        count: holidayList.length
      }))
      .sort((a, b) => b.year.localeCompare(a.year)); // Sort years descending
  };

  // Filter holidays based on search and year selection
  const getFilteredHolidays = () => {
    let filtered = holidays;
    
    if (searchTerm) {
      filtered = filtered.filter(h => 
        h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(h => h.date.startsWith(selectedYear));
    }
    
    return filtered;
  };

  const toggleYearExpand = (year: string) => {
    setExpandedYears(prev => 
      prev.includes(year) 
        ? prev.filter(y => y !== year)
        : [...prev, year]
    );
  };

  const yearGroups = groupHolidaysByYear();
  const filteredHolidays = getFilteredHolidays();
  const years = ['all', ...yearGroups.map(g => g.year)];

  // Safe date formatting function
  const formatHolidayDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) {
        return format(date, 'MMM dd, yyyy');
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Holiday Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and organize your organization's holidays
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="flex gap-3">
          <div className="bg-primary/5 rounded-lg px-4 py-2 border border-primary/10">
            <p className="text-xs text-muted-foreground">Total Holidays</p>
            <p className="text-2xl font-bold text-primary">{holidays.length}</p>
          </div>
          <div className="bg-primary/5 rounded-lg px-4 py-2 border border-primary/10">
            <p className="text-xs text-muted-foreground">Years</p>
            <p className="text-2xl font-bold text-primary">{yearGroups.length}</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Add Holiday */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/5 to-transparent border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                Add New Holiday
              </CardTitle>
              <Button 
                onClick={importIndianHolidays} 
                variant="outline" 
                size="sm"
                disabled={isImporting}
                className="gap-2"
              >
                {isImporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isImporting ? 'Importing...' : 'Import Indian Holidays'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar */}
              <div className="bg-gradient-to-br from-background to-muted/30 rounded-lg p-4 border">
                <Calendar
                  mode="single"
                  selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
                  onSelect={(date) => {
                    if (date && isValid(date)) {
                      setSelectedDate(date);
                    }
                  }}
                  modifiers={{
                    holiday: holidays
                      .map(h => {
                        try {
                          const date = parseISO(h.date);
                          return isValid(date) ? date : null;
                        } catch {
                          return null;
                        }
                      })
                      .filter((date): date is Date => date !== null)
                  }}
                  modifiersClassNames={{
                    holiday: 'bg-destructive/20 text-destructive font-bold rounded-full ring-2 ring-destructive/20'
                  }}
                  className="rounded-lg"
                />
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    Holiday Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., Christmas"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Input
                    placeholder="Additional details..."
                    value={holidayDescription}
                    onChange={(e) => setHolidayDescription(e.target.value)}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={selectedDate && isValid(selectedDate) ? format(selectedDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const dateValue = e.target.value;
                      if (dateValue && dateValue.length === 10) {
                        const [year, month, day] = dateValue.split('-').map(Number);
                        const parsedDate = new Date(year, month - 1, day);
                        if (isValid(parsedDate)) {
                          setSelectedDate(parsedDate);
                        }
                      }
                    }}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                </div>

                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground mb-1">Selected Date</p>
                  <p className="font-semibold text-lg">
                    {selectedDate && isValid(selectedDate) 
                      ? format(selectedDate, 'MMMM dd, yyyy') 
                      : 'No date selected'}
                  </p>
                </div>

                <Button 
                  onClick={handleAddHoliday} 
                  size="lg" 
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                >
                  <Plus className="h-5 w-5" />
                  Add Holiday
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Holiday List */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow h-fit">
          <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/5 to-transparent border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              Holiday List
            </CardTitle>
            
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search holidays..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-muted/50"
                />
              </div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 rounded-md border bg-muted/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Years</option>
                {yearGroups.map(group => (
                  <option key={group.year} value={group.year}>
                    {group.year} ({group.count})
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {filteredHolidays.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex p-3 rounded-full bg-muted mb-4">
                  <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No holidays found</p>
                {searchTerm && (
                  <Button 
                    variant="link" 
                    onClick={() => setSearchTerm('')}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {/* Group by year */}
                {yearGroups.map(group => {
                  const isExpanded = expandedYears.includes(group.year);
                  const groupHolidays = group.holidays.filter(h => 
                    filteredHolidays.some(fh => fh.id === h.id)
                  );
                  
                  if (groupHolidays.length === 0) return null;
                  
                  return (
                    <div key={group.year} className="border rounded-lg overflow-hidden">
                      {/* Year Header */}
                      <div 
                        className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleYearExpand(group.year)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            group.year === new Date().getFullYear().toString() 
                              ? 'bg-primary/20' 
                              : 'bg-muted'
                          }`}>
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{group.year}</h3>
                            <p className="text-xs text-muted-foreground">
                              {group.count} {group.count === 1 ? 'holiday' : 'holidays'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Dynamic Delete Button for this year */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setYearToDelete(group.year);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Delete All
                          </Button>
                          
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                      
                      {/* Holiday Items */}
                      {isExpanded && (
                        <div className="divide-y">
                          {groupHolidays.map((holiday) => (
                            <div
                              key={holiday.id}
                              className="flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="font-semibold truncate">{holiday.name}</p>
                                  <Badge variant="outline" className="shrink-0">
                                    {formatHolidayDate(holiday.date)}
                                  </Badge>
                                  {holiday.type && (
                                    <Badge variant="secondary" className="shrink-0">
                                      {holiday.type.split(',').slice(0, 2).join(',')}
                                      {holiday.type.split(',').length > 2 && '...'}
                                    </Badge>
                                  )}
                                </div>
                                {holiday.description && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {holiday.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(holiday)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteHoliday(holiday.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              Delete All {yearToDelete} Holidays
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Year</span>
                <Badge variant="destructive" className="text-lg px-3">
                  {yearToDelete}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Holidays to delete</span>
                <span className="text-2xl font-bold text-destructive">
                  {yearToDelete ? holidays.filter(h => h.date.startsWith(yearToDelete)).length : 0}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. All holidays from {yearToDelete} will be permanently removed.
              </p>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span>This will affect leave calculations and attendance records</span>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setYearToDelete(null);
                }}
                disabled={isDeleting}
                className="gap-2"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => yearToDelete && deleteHolidaysByYear(yearToDelete)}
                disabled={isDeleting}
                className="gap-2 min-w-[120px]"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" />
                    Delete All
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Holiday Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              Edit Holiday
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="bg-gradient-to-br from-background to-muted/30 rounded-lg p-4 border">
              <Calendar
                mode="single"
                selected={editDate && isValid(editDate) ? editDate : undefined}
                onSelect={(date) => {
                  if (date && isValid(date)) {
                    setEditDate(date);
                  }
                }}
                className="rounded-lg"
              />
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Holiday Name *</Label>
                <Input
                  placeholder="e.g., Christmas"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Additional details..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={editDate && isValid(editDate) ? format(editDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value;
                    if (dateValue && dateValue.length === 10) {
                      const [year, month, day] = dateValue.split('-').map(Number);
                      const parsedDate = new Date(year, month - 1, day);
                      if (isValid(parsedDate)) {
                        setEditDate(parsedDate);
                      }
                    }
                  }}
                  className="bg-muted/50"
                />
              </div>
              
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">Selected Date</p>
                <p className="font-semibold">
                  {editDate && isValid(editDate) 
                    ? format(editDate, 'MMMM dd, yyyy') 
                    : 'No date selected'}
                </p>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)} 
                  className="flex-1 gap-2"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateHoliday} 
                  className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidayManagement;
