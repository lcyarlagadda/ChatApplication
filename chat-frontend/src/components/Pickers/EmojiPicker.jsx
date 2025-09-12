import React, { useRef, useEffect } from 'react';
import { emojiCategories } from '../../data/emojiData';

const EmojiPicker = ({ isDark, onEmojiSelect, onClose }) => {
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={emojiPickerRef}
      className={`absolute bottom-12 left-0 w-80 h-80 ${isDark ? 'bg-gray-700' : 'bg-white'} rounded-lg shadow-xl border z-50`}
    >
      <div className="p-4 h-full flex flex-col">
        <h3 className="font-semibold mb-3">Emojis</h3>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(emojiCategories).map(([category, emojis]) => (
            <div key={category} className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{category}</h4>
              <div className="grid grid-cols-8 gap-2">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onEmojiSelect(emoji)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;