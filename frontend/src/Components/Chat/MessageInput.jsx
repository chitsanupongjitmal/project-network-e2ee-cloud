
import React, { useState, useRef, useEffect } from 'react';
import SendIcon from '../Common/SendIcon';
import EmojiIcon from '../Common/EmojiIcon';
import EmojiPicker from '../Common/EmojiPicker';


const ReplyPreview = ({ message, onCancel }) => {
    if (!message) return null;

    const isImageReply = message.type?.startsWith('encrypted_image') && message.fileInfo;
    const displayText = isImageReply ? (message.decryptedText || 'Photo') : message.decryptedText;

    return (
        <div className="p-2 mb-2 bg-gray-100 rounded-lg border-l-4 border-blue-500 flex justify-between items-center">
            <div className="flex items-center gap-2 min-w-0">
                {isImageReply && (
                    <img src={message.fileInfo.url} alt="reply preview" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-grow min-w-0">
                    <p className="font-bold text-sm text-blue-600">Replying to {message.sender}</p>
                    <p className="text-sm text-gray-600 truncate">{isImageReply && '🖼️ '} {displayText || 'Attachment'}</p>
                </div>
            </div>
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 font-bold text-xl p-1 flex-shrink-0">&times;</button>
        </div>
    );
};



const MessageInput = ({ onSend, onTyping, replyingTo, onCancelReply, isInputDisabled }) => {
    const [text, setText] = useState('');
    const [filesToSend, setFilesToSend] = useState([]);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const emojiContainerRef = useRef(null);

    const handleSelectEmoji = (emoji) => {
        setText(prevText => prevText + emoji);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (emojiContainerRef.current && !emojiContainerRef.current.contains(event.target)) {
                setIsEmojiPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleTypingChange = (e) => {
        setText(e.target.value);
        if (onTyping) {
            if (!typingTimeoutRef.current) {
                onTyping('start');
            }
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                onTyping('stop');
                typingTimeoutRef.current = null;
            }, 2000);
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if ((!text.trim() && filesToSend.length === 0) || isInputDisabled) return;

        if (filesToSend.length > 0) {
            filesToSend.forEach(file => {
                onSend(text, file);
            });
        } else {
            onSend(text, null);
        }

        setText('');
        setFilesToSend([]);
        setIsEmojiPickerOpen(false);
        if (onTyping) {
            clearTimeout(typingTimeoutRef.current);
            onTyping('stop');
            typingTimeoutRef.current = null;
        }
    };
    

    const removeFile = (fileToRemove) => {
      setFilesToSend(prevFiles => prevFiles.filter(file => file !== fileToRemove));
    };
    
    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        if (newFiles.length > 0) {
            setFilesToSend(prev => [...prev, ...newFiles]);
        }
        e.target.value = null;
    };

    const handlePaste = (e) => {
        const item = Array.from(e.clipboardData.items).find(x => x.type.startsWith('image/'));
        if (item) {
            e.preventDefault();
            const file = item.getAsFile();
            setFilesToSend(prevFiles => [...prevFiles, file]);
        }
    };


    return (
        <div className="bg-white p-3 border-t flex-shrink-0">
            <ReplyPreview message={replyingTo} onCancel={onCancelReply} />

            {}
            {filesToSend.length > 0 && (
                <div className="p-2 mb-2 bg-gray-100 rounded-lg border border-gray-200 flex flex-wrap gap-3">
                    {filesToSend.map((file, index) => {
                        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
                        return (
                            <div key={index} className="relative w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                                {previewUrl ? (
                                    <img src={previewUrl} alt={file.name} className="w-full h-full object-cover rounded-lg" onLoad={() => URL.revokeObjectURL(previewUrl)} />
                                ) : (
                                    <div className="text-xs p-1 text-center">📎<br/>{file.name}</div>
                                )}
                                <button type="button" onClick={() => removeFile(file)} className="absolute top-0 right-0 -mt-2 -mr-2 bg-gray-800 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold shadow-md hover:bg-gray-600">&times;</button>
                            </div>
                        );
                    })}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <div className="relative" ref={emojiContainerRef}>
                    {isEmojiPickerOpen && <EmojiPicker onSelectEmoji={handleSelectEmoji} />}
                    <button type="button" onClick={() => setIsEmojiPickerOpen(prev => !prev)} className="text-gray-500 hover:text-gray-700 p-1"> <EmojiIcon /> </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                <button type="button" onClick={() => fileInputRef.current.click()} className="text-gray-500 hover:text-gray-700 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <input
                    type="text" value={text} onChange={handleTypingChange} onPaste={handlePaste}
                    placeholder={isInputDisabled ? "Uploading..." : (filesToSend.length > 0 ? "Add a caption..." : "Type a message...")}
                    className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onFocus={() => setIsEmojiPickerOpen(false)}
                    disabled={isInputDisabled}
                />
                <button type="submit" className="text-blue-500 hover:text-blue-700 disabled:text-gray-400 p-2" disabled={(!text.trim() && filesToSend.length === 0) || isInputDisabled}>
                    <SendIcon />
                </button>
            </form>
        </div>
    );
};

export default MessageInput;