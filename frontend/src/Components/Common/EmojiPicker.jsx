
import React from 'react';
import { emojiCategories } from '../../Data/emojiData';

const EmojiPicker = ({ onSelectEmoji }) => {
    return (
        <div className="absolute bottom-full mb-2 w-72 h-80 bg-white rounded-lg shadow-lg border p-2 flex flex-col z-20">
            <h3 className="text-sm font-semibold text-gray-700 px-2 pb-2">Emojis</h3>
            <div className="flex-1 overflow-y-auto">
                {emojiCategories.map(category => (
                    <div key={category.name}>
                        <h4 className="text-xs font-bold text-gray-500 bg-gray-100 p-1 sticky top-0">{category.name}</h4>
                        <div className="grid grid-cols-8 gap-1 p-2">
                            {category.emojis.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => onSelectEmoji(emoji)}
                                    className="text-2xl rounded-md hover:bg-gray-200"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;