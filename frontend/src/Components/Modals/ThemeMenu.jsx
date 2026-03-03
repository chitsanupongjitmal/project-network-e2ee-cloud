
import React from 'react';
import { chatThemes } from '../../Data/themeData';

const ThemeMenu = ({ onSelectTheme, onClose }) => {
    return (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-30 border p-2">
            <h4 className="text-sm font-semibold text-gray-600 px-2 mb-2">Chat Theme</h4>
            <div className="grid grid-cols-5 gap-2">
                {Object.entries(chatThemes).map(([key, theme]) => (
                    <div key={key} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => onSelectTheme(key)}>
                        <div className={`w-8 h-8 rounded-full ${theme.preview} border-2 border-white ring-1 ring-gray-300`}></div>
                        <p className="text-xs text-gray-500">{theme.name}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ThemeMenu;