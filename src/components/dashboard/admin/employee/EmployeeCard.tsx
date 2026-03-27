import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User, Mail, Phone, MapPin, Briefcase, Shield, Edit, Trash2, Ban, CheckCircle, KeyRound, Eye, MoreVertical } from 'lucide-react';
import { UserRole } from '@/contexts/AuthContext';

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  designation?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  departmentId?: string;
  department?: string;
  departmentName?: string;
  salary?: number;
  experience?: number;
  userId: string;
  organizationId?: string;
  createdAt: string;
  isBlocked?: boolean;
  pan?: string;
  profileImageUrl?: string;
  gender?: 'Male' | 'Female';
}

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (emp: Employee) => void;
  onDelete: (id: string) => void;
  onBlockUnblock: (emp: Employee) => void;
  onResetPassword: (emp: Employee) => void;
  onViewDetails: (emp: Employee) => void;
}

export const EmployeeCard = ({
  employee: emp,
  onEdit,
  onDelete,
  onBlockUnblock,
  onResetPassword,
  onViewDetails
}: EmployeeCardProps) => {
  return (
    <div className="p-3 sm:p-4 border rounded-lg space-y-3 hover:border-primary/50 transition-colors bg-card">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
            <AvatarImage src={emp.profileImageUrl} />
            <AvatarFallback className="text-xs sm:text-sm">
              <User className="h-4 w-4 sm:h-6 sm:w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <p className="font-semibold text-base sm:text-lg truncate">{emp.name}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {emp.employeeCode}
                </Badge>
                <Badge 
                  variant={emp.role === 'hr' || emp.role === 'hod' ? 'default' : 'secondary'}
                  className="text-xs px-1.5 py-0 capitalize"
                >
                  <Shield className="h-2.5 w-2.5 mr-1 hidden sm:inline" />
                  {emp.role}
                </Badge>
              </div>
            </div>
            
            {emp.designation && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Briefcase className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{emp.designation}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{emp.email}</span>
            </div>
            
            {emp.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>{emp.phone}</span>
              </div>
            )}

            {emp.department && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{emp.department}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {emp.isBlocked && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0 hidden sm:inline-flex">
              <Ban className="h-2.5 w-2.5 mr-1" />
              Blocked
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onViewDetails(emp)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(emp)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(emp)}>
                <KeyRound className="mr-2 h-4 w-4" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBlockUnblock(emp)}>
                {emp.isBlocked ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Unblock
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" />
                    Block
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(emp.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};