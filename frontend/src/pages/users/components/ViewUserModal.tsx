// src/pages/users/components/ViewUserModal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  department: string;
  specialization?: string;
  shift?: string;
  licenseNumber?: string;
  joinDate: string;
  isActive: boolean;
}

interface ViewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export default function ViewUserModal({ isOpen, onClose, user }: ViewUserModalProps) {
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">User Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Profile Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <span className="text-4xl font-bold text-red-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-2xl font-semibold tracking-tight">{user.name}</h3>
            <p className="text-muted-foreground mt-1">{user.email}</p>
            
            <Badge 
              variant={user.isActive ? "default" : "secondary"} 
              className="mt-3 px-4 py-1"
            >
              {user.isActive ? "● Active" : "○ Inactive"}
            </Badge>
          </div>

          <Separator />

          {/* User Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="font-medium mt-1.5">{user.role}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Department</Label>
              <p className="font-medium mt-1.5">{user.department}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Mobile</Label>
              <p className="font-medium mt-1.5">{user.mobile}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Joined On</Label>
              <p className="font-medium mt-1.5">
                {new Date(user.joinDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </p>
            </div>

            {user.specialization && (
              <>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Specialization</Label>
                  <p className="font-medium mt-1.5">{user.specialization}</p>
                </div>
              </>
            )}

            {user.shift && (
              <div>
                <Label className="text-xs text-muted-foreground">Shift</Label>
                <p className="font-medium mt-1.5">{user.shift}</p>
              </div>
            )}

            {user.licenseNumber && (
              <div>
                <Label className="text-xs text-muted-foreground">License Number</Label>
                <p className="font-medium mt-1.5 font-mono tracking-wide">{user.licenseNumber}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}