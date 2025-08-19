// components/sound-controls/SoundControls.tsx
import React, { useState, useEffect } from 'react';
import { useSound } from './use-sound';

interface SoundControlsProps {
  className?: string;
  showAsFloating?: boolean;
}

export default function SoundControls({ className = '', showAsFloating = false }: SoundControlsProps) {
  const { setVolume, setEnabled, getEnabled, getVolume } = useSound();
  const [isEnabled, setIsEnabled] = useState(true);
  const [volume, setVolumeState] = useState(30);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Sincronizar com o estado do gerenciador de som
    setIsEnabled(getEnabled());
    setVolumeState(getVolume() * 100);
  }, [getEnabled, getVolume]);

  const handleToggleSound = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    setEnabled(newState);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolumeState(newVolume);
    setVolume(newVolume / 100);
  };

  const containerClasses = showAsFloating
    ? `fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border p-3 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-12'}`
    : `flex items-center gap-3 p-3 bg-gray-50 rounded-lg ${className}`;

  if (showAsFloating) {
    return (
      <div className={containerClasses}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 transition-colors"
          title="Controles de Som"
        >
          {isEnabled ? '🔊' : '🔇'}
        </button>

        {isExpanded && (
          <div className="flex flex-col gap-2 ml-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSound}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${isEnabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {isEnabled ? 'Som ON' : 'Som OFF'}
              </button>
            </div>

            {isEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Volume:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500 w-8">{volume}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <button
        onClick={handleToggleSound}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isEnabled
          ? 'bg-green-500 text-white hover:bg-green-600'
          : 'bg-gray-400 text-white hover:bg-gray-500'
          }`}
      >
        {isEnabled ? '🔊 Som Ativado' : '🔇 Som Desativado'}
      </button>

      {isEnabled && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Volume:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-8">{volume}%</span>
        </div>
      )}
    </div>
  );
}