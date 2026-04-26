
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import api from "@/lib/Api";

import ViewUserModal from "./components/ViewUserModal";
import EditUserModal from "./components/EditUserModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";

interface User {
  _id: string;
  name: string;
  username: string;
  mobile: string;
  role: string;
  department: string;
  specialization?: string;
  shift?: string;
  licenseNumber?: string;
  joinDate: string;
  isActive: boolean;
}

export default function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get("/users");
      setUsers(response.data.data.users || []);
      setFilteredUsers(response.data.data.users || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Search filter
  useEffect(() => {
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleView = (user: User) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/users/${userToDelete._id}`);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    } finally {
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      Doctor: "bg-blue-100 text-blue-700",
      Nurse: "bg-green-100 text-green-700",
      Admin: "bg-purple-100 text-purple-700",
      Receptionist: "bg-orange-100 text-orange-700",
      LabTech: "bg-cyan-100 text-cyan-700",
      Pharmacist: "bg-emerald-100 text-emerald-700",
      Accountant: "bg-amber-100 text-amber-700",
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Hospital Staff Management</h1>
          <p className="text-gray-500">Manage users and their access rights</p>
        </div>
        <Button asChild className="bg-red-600 hover:bg-red-700">
          <Link to="/users/add">
            <Plus className="mr-2 h-4 w-4" /> Add New User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
            <Input
              placeholder="Search by name, department or role..."
              className="max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-4 px-4">Name</th>
                  <th className="text-left py-4 px-4">Mobile</th>
                  <th className="text-left py-4 px-4">Role</th>
                  <th className="text-left py-4 px-4">Department</th>
                  <th className="text-left py-4 px-4">Status</th>
                  <th className="text-center py-4 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium">{user.name}</td>
                    <td className="py-4 px-4">{user.mobile}</td>
                    <td className="py-4 px-4">
                      <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                    </td>
                    <td className="py-4 px-4">{user.department}</td>
                    <td className="py-4 px-4">
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleView(user)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteClick(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedUser && (
        <>
          <ViewUserModal
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            user={selectedUser}
          />

          <EditUserModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            user={selectedUser}
            onSuccess={fetchUsers}
          />
        </>
      )}

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        userName={userToDelete?.name || ""}
      />
    </div>
  );
}
