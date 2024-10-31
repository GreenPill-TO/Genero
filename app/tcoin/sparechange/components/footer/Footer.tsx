import { MarkdownViewer } from "@shared/components/ui/MarkdownViewer";
import { useModal } from "@shared/contexts/ModalContext";
import { cn } from "@shared/utils/classnames";

export function Footer() {
  const { openModal } = useModal();

  const handleOpenModal = (filePath: string) => {
    openModal({ content: <MarkdownViewer filePath={filePath} /> });
  };

  return (
    <footer className={cn("py-6 w-full", "bg-background", "shadow-top")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-lg font-bold">SpareChange</h4>
            <p>&copy; {new Date().getFullYear()} SpareChange. All rights reserved.</p>
          </div>
          <div className="flex space-x-4 items-center">
            <button onClick={() => handleOpenModal("/privacypolicy.md")} className="hover:underline">
              Privacy Policy
            </button>
            <button onClick={() => handleOpenModal("/TermsAndConditions.md")} className="hover:underline">
              Terms of Service
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
