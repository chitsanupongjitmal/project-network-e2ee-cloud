import React from 'react';

const ImageModal = ({ src, onClose }) => {
    if (!src) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
            onClick={onClose}
        >
            <div 
                className="relative p-4 bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <img 
                    src={src} 
                    alt="Popup view" 
                    className="object-contain max-w-full max-h-[85vh]"
                />
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ImageModal;