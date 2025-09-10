import { useState } from "react";
import { Settings, RotateCcw, Plus, Play, Pause, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface Settings {
  rotationSpeed: number;
  sphereTransparency: number;
  photonSpeed: number;
  stepDistance: number;
  photonSize: number;
}

interface ControlPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onReset: () => void;
  onAddPhoton: () => void;
  photonCount: number;
  maxPhotons: number;
  isPaused: boolean;
  onPauseToggle: () => void;
}

export default function ControlPanel({
  settings,
  onSettingsChange,
  onReset,
  onAddPhoton,
  photonCount,
  maxPhotons,
  isPaused,
  onPauseToggle
}: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pulseAddButton, setPulseAddButton] = useState(false);

  const handleSliderChange = (key: keyof Settings) => (value: number[]) => {
    onSettingsChange({
      ...settings,
      [key]: value[0]
    });
  };

  const handleAddPhoton = () => {
    if (photonCount >= maxPhotons) {
      setPulseAddButton(true);
      setTimeout(() => setPulseAddButton(false), 200);
      return;
    }
    onAddPhoton();
  };

  const handleDownload2D = () => {
    // Remove 2D download as extracting trails from 3D scene is complex
    console.log('2D download removed - complex to extract trails from 3D scene');
  };

  const handleDownload3D = () => {
    if ((window as any).exportPhotonSimulation3D) {
      (window as any).exportPhotonSimulation3D();
    }
  };

  return (
    <div className="fixed bottom-6 left-6 flex items-end gap-3 z-10">
      {/* Settings Panel */}
      {isOpen && (
        <div className="control-panel p-6 w-80 max-h-96 overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rotation Speed</Label>
              <Slider
                value={[settings.rotationSpeed]}
                onValueChange={handleSliderChange('rotationSpeed')}
                min={0}
                max={8} // Increased to 2x original max (4 * 2 = 8)
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Sphere Transparency</Label>
              <Slider
                value={[settings.sphereTransparency]}
                onValueChange={handleSliderChange('sphereTransparency')}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Photon Speed</Label>
              <div className="text-xs text-muted-foreground mb-1">
                Current: {settings.photonSpeed.toFixed(1)} | Max: 10.8
              </div>
              <Slider
                value={[settings.photonSpeed]}
                onValueChange={handleSliderChange('photonSpeed')}
                min={0.1}
                max={10.8} // Reduced by 60% from 27
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Step Distance</Label>
              <div className="text-xs text-muted-foreground mb-1">
                Current: {settings.stepDistance.toFixed(2)} | Max: 3.20
              </div>
              <Slider
                value={[settings.stepDistance]}
                onValueChange={handleSliderChange('stepDistance')}
                min={0.05}
                max={3.2} // Reduced by 60% from 8
                step={0.01}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Photon Size</Label>
              <Slider
                value={[settings.photonSize]}
                onValueChange={handleSliderChange('photonSize')}
                min={1}
                max={12}
                step={0.5}
                className="w-full"
              />
            </div>



            {/* Download Buttons */}
            <div className="space-y-2 pt-4 border-t border-white/10">
              <Button
                onClick={() => handleDownload3D()}
                className="w-full bg-white/90 hover:bg-white text-black hover:text-black border border-white/20"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Download 3D File (.GLB)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        {/* Settings Toggle */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="control-button"
          variant="ghost"
          size="icon"
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* Reset Button */}
        <Button
          onClick={onReset}
          className="control-button"
          variant="ghost"
          size="icon"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>

        {/* Pause/Play Button */}
        <Button
          onClick={onPauseToggle}
          className="control-button"
          variant="ghost"
          size="icon"
        >
          {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </Button>

        {/* Add Photon Button */}
        <Button
          onClick={handleAddPhoton}
          className={`control-button ${pulseAddButton ? 'animate-pulse' : ''}`}
          variant="ghost"
          size="icon"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}