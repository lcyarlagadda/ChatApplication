const ReactionPicker = ({ isDark, onReactionSelect, position = "top", isOwn }) => {
  const reactions = [
    { emoji: "👍", name: "thumbs_up" },
    { emoji: "👎", name: "thumbs_down" },
    { emoji: "❤️", name: "heart" },
    { emoji: "😂", name: "laugh" },
    { emoji: "😢", name: "sad" },
    { emoji: "🎉", name: "celebration" },
    { emoji: "😮", name: "surprised" },
    { emoji: "🔥", name: "fire" },
  ];

  return (
    <div
      className={`absolute ${position === "top" ? "bottom-8" : "top-8"} ${
        isOwn ? "right-0" : "left-0"
      } p-2 rounded-lg shadow-lg border z-50 ${
        isDark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-200"
      }`}
      style={{ maxWidth: "280px" }}
    >
      <div className="grid grid-cols-4 gap-1">
        {reactions.map((reaction) => (
          <button
            key={reaction.name}
            onClick={() => onReactionSelect(reaction.emoji)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg transition-transform hover:scale-110 flex items-center justify-center"
            title={reaction.name.replace("_", " ")}
          >
            {reaction.emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReactionPicker;