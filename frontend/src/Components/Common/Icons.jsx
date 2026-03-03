
import React from 'react';

const mergeClassNames = (...classes) => classes.filter(Boolean).join(' ');

export const MoreVerticalIcon = ({ className = 'h-5 w-5', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={mergeClassNames('pointer-events-none', className)}
        aria-hidden="true"
        {...props}
    >
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
);

export const VideoIcon = ({ className = 'h-6 w-6', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className={mergeClassNames(className)}
        aria-hidden="true"
        {...props}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export const PhoneIcon = ({ className = 'h-6 w-6', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className={mergeClassNames(className)}
        aria-hidden="true"
        {...props}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);

export const LockIcon = ({ className = 'h-4 w-4 text-green-500', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={mergeClassNames(className)}
        aria-hidden="true"
        {...props}
    >
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2h2a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2zm2-2a3 3 0 116 0v2H7V7zm6 3H7v6h6v-6z" clipRule="evenodd" />
    </svg>
);

export const UnlockIcon = ({ className = 'h-4 w-4 text-green-600', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={mergeClassNames(className)}
        aria-hidden="true"
        {...props}
    >
        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2h-2V7a5 5 0 00-5-5zm-9 9v5h10v-5H9zm2 0h-2V7a3 3 0 016 0v2h2v5h-2v-5z" />
    </svg>
);

