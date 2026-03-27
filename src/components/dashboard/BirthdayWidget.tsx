import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Cake, Send, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

interface EmployeeBirthday {
  id: string;
  name: string;
  dateOfBirth: string;
  department?: string;
  photoURL?: string;
  daysUntil: number;
  isToday: boolean;
}

const predefinedWishes = [
  "🎉 Happy Birthday! Wishing you a fantastic day filled with joy and happiness!",
  "🎂 Happy Birthday! May this year bring you success and prosperity!",
  "🎈 Wishing you a wonderful birthday and a year full of blessings!",
  "🌟 Happy Birthday! May all your dreams come true this year!",
  "🎁 Happy Birthday! Hope your special day is as amazing as you are!",
];

const BirthdayWidget = () => {
  const { user, organizationId } = useAuth();
  const [birthdays, setBirthdays] = useState<EmployeeBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishMessage, setWishMessage] = useState('');
  const [sendingWish, setSendingWish] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeBirthday | null>(null);

  useEffect(() => {
    fetchBirthdays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchBirthdays = async () => {
    try {
      // Filter by organizationId to show only employees from the same organization
      const q = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId))
        : collection(db, 'employees');
      const snapshot = await getDocs(q);
      const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingBirthdays: EmployeeBirthday[] = [];

      employees.forEach((emp: any) => {
        if (emp.dateOfBirth) {
          try {
            let birthDate: Date;

            if (typeof emp.dateOfBirth === 'string') {
              if (emp.dateOfBirth.includes('-')) {
                const [year, month, day] = emp.dateOfBirth.split('-').map(Number);
                birthDate = new Date(year, month - 1, day);
              } else {
                birthDate = new Date(emp.dateOfBirth);
              }
            } else {
              birthDate = new Date(emp.dateOfBirth);
            }

            if (isNaN(birthDate.getTime())) return;

            const thisYearBirthday = new Date(
              today.getFullYear(),
              birthDate.getMonth(),
              birthDate.getDate()
            );
            thisYearBirthday.setHours(0, 0, 0, 0);

            if (thisYearBirthday < today) thisYearBirthday.setFullYear(today.getFullYear() + 1);

            const daysUntil = Math.ceil(
              (thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysUntil >= 0 && daysUntil <= 4) {
              upcomingBirthdays.push({
                id: emp.id,
                name: emp.name || 'Unknown',
                dateOfBirth: emp.dateOfBirth,
                department: emp.department,
                photoURL: emp.profileImageUrl || emp.photoURL || '',
                daysUntil,
                isToday: daysUntil === 0,
              });
            }
          } catch (err) {
            console.error(`Error processing birthday for employee ${emp.name}:`, err);
          }
        }
      });

      upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
      setBirthdays(upcomingBirthdays);
    } catch (error) {
      console.error('Error fetching birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBirthdayText = (daysUntil: number) => {
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    return `In ${daysUntil} days`;
  };

  const initials = (name = '') => {
    return name
      .split(' ')
      .map(s => s.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const sendBirthdayWish = async (closeDialog?: () => void) => {
    if (!user || !selectedEmployee || !wishMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a birthday wish',
        variant: 'destructive',
      });
      return;
    }

    setSendingWish(true);
    try {
      // Filter by organizationId when fetching sender info
      const senderQuery = organizationId 
        ? query(collection(db, 'employees'), where('organizationId', '==', organizationId), where('userId', '==', user.uid))
        : query(collection(db, 'employees'), where('userId', '==', user.uid));
      const senderSnapshot = await getDocs(senderQuery);
      const senderDoc = senderSnapshot.docs[0];
      const senderName = senderDoc?.data()?.name || user.email?.split('@')[0] || 'Someone';

      await addDoc(collection(db, 'notifications'), {
        title: '🎂 Birthday Wish',
        message: `${senderName} says: ${wishMessage.trim()}`,
        type: 'birthday',
        createdAt: new Date().toISOString(),
        readBy: [],
        sentBy: user.uid,
        sentByName: senderName,
        recipientId: selectedEmployee.id,
      });

      toast({
        title: 'Success',
        description: `Birthday wish sent to ${selectedEmployee.name}!`,
      });

      setWishMessage('');
      setSelectedEmployee(null);
      if (closeDialog) closeDialog();
    } catch (error) {
      console.error('Error sending birthday wish:', error);
      toast({
        title: 'Error',
        description: 'Failed to send birthday wish',
        variant: 'destructive',
      });
    } finally {
      setSendingWish(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-birthday/20 bg-gradient-to-br from-birthday/5 to-birthday/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Cake className="h-6 w-6 text-birthday" />
          Upcoming Birthdays
        </CardTitle>
      </CardHeader>

      <CardContent>
        {birthdays.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Currently there are no birthdays in the next 4 days.</p>
        ) : (
          <div className="space-y-3">
            {birthdays.map((birthday) => (
              <div
                key={birthday.id}
                className={`p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-all border ${
                  birthday.isToday ? 'bg-birthday/20 border-2 border-birthday animate-pulse' : 'bg-card border-border hover:border-birthday/30'
                }`}
              >
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={birthday.photoURL} alt={birthday.name} />
                  <AvatarFallback className="bg-birthday text-white text-lg font-semibold">{initials(birthday.name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{birthday.name}</p>
                  {birthday.department && (
                    <p className="text-xs text-muted-foreground truncate">{birthday.department}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <Badge
                    variant={birthday.isToday ? 'default' : 'outline'}
                    className={`${birthday.isToday ? 'bg-birthday text-white' : 'border-birthday text-birthday'} whitespace-nowrap`}
                  >
                    {formatBirthdayText(birthday.daysUntil)}
                  </Badge>

                  {birthday.isToday && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-birthday text-birthday hover:bg-birthday hover:text-white"
                          onClick={() => setSelectedEmployee(birthday)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="w-full sm:max-w-xl max-h-[90vh] overflow-auto">
                        <DialogHeader className="sticky top-0 bg-white/90 backdrop-blur-sm z-20 p-4 border-b">
                          <div className="flex items-center justify-between gap-2">
                            <DialogTitle>Send Birthday Wish to {birthday.name}</DialogTitle>
                            <DialogClose asChild>
                              <Button variant="ghost" size="sm" aria-label="Close dialog">
                                <X className="h-4 w-4" />
                              </Button>
                            </DialogClose>
                          </div>
                        </DialogHeader>

                        <div className="p-4 space-y-4">
                          <div>
                            <Label className="mb-2">Select a message or write your own</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {predefinedWishes.map((wish, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full text-left h-auto py-2 px-3 rounded-md border border-border hover:shadow-sm"
                                  onClick={() => setWishMessage(wish)}
                                >
                                  <span className="block truncate">{wish}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Textarea
                              placeholder="Or type your own birthday wish..."
                              value={wishMessage}
                              onChange={(e) => setWishMessage(e.target.value)}
                              rows={4}
                              className="w-full min-h-[88px] resize-vertical"
                            />
                          </div>

                          <div className="flex gap-2">
                            <DialogClose asChild>
                              <Button variant="ghost" className="flex-1">Cancel</Button>
                            </DialogClose>

                            <Button
                              onClick={() => sendBirthdayWish(undefined)}
                              disabled={sendingWish}
                              className="flex-1"
                            >
                              {sendingWish ? 'Sending...' : 'Send Birthday Wish 🎉'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BirthdayWidget;
