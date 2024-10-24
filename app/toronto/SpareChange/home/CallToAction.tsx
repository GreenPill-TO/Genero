import { useAuth } from "@shared/api/hooks/useAuth";
import { Button } from "@shared/components/ui/Button";

type CallToActionProps = {
  onAuthClick: () => void;
};

export function CallToAction({ onAuthClick }: CallToActionProps) {
  const { isAuthenticated } = useAuth();

  return (
    <section id="call-to-action" className="py-12 bg-gradient-to-r from-green-400 to-blue-500 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          {isAuthenticated ? "Next Step: Add some funds to your account" : "Ready to make a difference?"}
        </h2>
        {!isAuthenticated && (
          <Button onClick={onAuthClick} className="px-6 py-3">
            Sign Up Now
          </Button>
        )}
      </div>
    </section>
  );
}
