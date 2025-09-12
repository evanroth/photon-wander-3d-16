import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface MicButtonProps {
  isActive: boolean;
  onToggle: () => void;
  error: string | null;
}

export default function MicButton({ isActive, onToggle, error }: MicButtonProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title: "Microphone Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  return (
    <div className="fixed bottom-6 left-6 z-10">
      <Button
        onClick={onToggle}
        className={`w-12 h-12 ${
          isActive 
            ? 'bg-red-500/20 hover:bg-red-500/30 border-red-400/40' 
            : 'bg-black/20 hover:bg-black/30 border-white/20'
        } border rounded-full flex items-center justify-center transition-all duration-300 ease-out`}
        variant="ghost"
        size="icon"
        title={isActive ? "Turn off audio wobble" : "Turn on audio wobble"}
      >
        {isActive ? (
          <Mic className="h-5 w-5 text-red-400" />
        ) : (
          <MicOff className="h-5 w-5 text-white" />
        )}
      </Button>
    </div>
  );
}