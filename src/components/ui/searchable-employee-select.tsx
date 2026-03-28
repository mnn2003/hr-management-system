import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface Employee {
  id: string;
  name: string;
  employeeCode: string;
  userId?: string;
}

interface SearchableEmployeeSelectProps {
  employees: Employee[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
}

export function SearchableEmployeeSelect({
  employees,
  value,
  onValueChange,
  placeholder = "Select employee",
  disabled = false,
  className,
  includeAllOption = false,
  allOptionLabel = "All Employees",
}: SearchableEmployeeSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedEmployee = React.useMemo(() => {
    if (value === "all" && includeAllOption) return { name: allOptionLabel, employeeCode: "" };
    return employees.find((emp) => emp.id === value);
  }, [employees, value, includeAllOption, allOptionLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          {selectedEmployee
            ? selectedEmployee.name + (selectedEmployee.employeeCode ? ` (${selectedEmployee.employeeCode})` : "")
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[300px] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search employee..." />
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value="all"
                  onSelect={() => {
                    onValueChange("all");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "all" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {allOptionLabel}
                </CommandItem>
              )}
              {employees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.name} ${emp.employeeCode}`}
                  onSelect={() => {
                    onValueChange(emp.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === emp.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {emp.name} ({emp.employeeCode})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
