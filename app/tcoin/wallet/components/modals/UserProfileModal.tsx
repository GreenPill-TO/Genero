// @ts-nocheck
import { useAuth } from "@shared/api/hooks/useAuth";
import { Avatar } from "@shared/components/ui/Avatar";
import { Button } from "@shared/components/ui/Button";

interface UserProfileModalProps {
  closeModal: () => void;
}

const UserProfileModal = ({ closeModal }: UserProfileModalProps) => {
  const { signOut, userData } = useAuth();

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <div className="flex items-center space-x-4 mb-4">
          <Avatar className="w-20 h-20" src="https://github.com/shadcn.png" alt="@shadcn" />
          <Button variant="link" className="p-0 h-auto" onClick={() => console.log("Change avatar")}>
            Change avatar
          </Button>
        </div>
        <p>
          <strong>Name:</strong> {userData?.cubidData?.full_name}
        </p>
        <p>
          <strong>Email:</strong> {userData?.cubidData?.email}
        </p>
        <Button className="w-full" variant="default">
          Edit Profile
        </Button>
        <Button
          className="w-full"
          variant="ghost"
          onClick={() => {
            signOut();
            closeModal();
          }}
        >
          Log Out
        </Button>
      </div>
    </div>
  );
};

export { UserProfileModal };
